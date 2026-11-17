const USE_MYSQL = window.HL_MODE === 'mysql';
const STORAGE_KEY = 'hlchopp_escolar_2026_v1';
const CATEGORIES = ['Espetinhos tradicionais','Espetinhos especiais','Jantinhas','Chopp','Outras bebidas','Outros'];
const STATUSES = ['Pendente','Em preparo','Pronto','Entregue'];
const SAMPLE_PRODUCTS = [
  {id:1,name:'Espetinho de carne',category:'Espetinhos tradicionais',price:12,stock:30,min_stock:5,active:1},
  {id:2,name:'Espetinho de frango',category:'Espetinhos tradicionais',price:11,stock:25,min_stock:5,active:1},
  {id:3,name:'Espetinho de coração',category:'Espetinhos especiais',price:13,stock:20,min_stock:5,active:1},
  {id:4,name:'Jantinha tradicional',category:'Jantinhas',price:23,stock:18,min_stock:4,active:1},
  {id:5,name:'Chopp 500 ml',category:'Chopp',price:12,stock:40,min_stock:10,active:1},
  {id:6,name:'Refrigerante lata',category:'Outras bebidas',price:7,stock:32,min_stock:8,active:1}
];
let data = {products:[],orders:[]};
let cart = [];
let activePage = 'dashboard';
const $ = id => document.getElementById(id);
const money = n => Number(n || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const escapeHTML = x => String(x == null ? '' : x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = x => Number(x);
const formatDate = x => { const d = new Date(String(x).replace(' ','T')); return Number.isNaN(d.getTime())?'--':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); };
const sameDay = x => { const d=new Date(String(x||'').replace(' ','T')); return !Number.isNaN(d.getTime())&&d.toDateString()===new Date().toDateString(); };
const nowLocal = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`; };
const availableProducts = () => data.products.filter(p=>Number(p.active)!==0);
const productById = id => data.products.find(p=>Number(p.id)===Number(id));
const recentOrders = () => data.orders.slice().sort((a,b)=>Number(b.id)-Number(a.id));
const empty = message => `<div class="empty">${escapeHTML(message)}</div>`;
function alertMessage(message){const el=$('toast');el.textContent=message;el.style.display='block';clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>el.style.display='none',3200);}
function showError(message){$('errorBanner').hidden=!message;$('errorBanner').textContent=message||'';}
function localSave(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
function localLoad(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));if(raw&&Array.isArray(raw.products)&&Array.isArray(raw.orders))return raw;}catch(e){}return {products:SAMPLE_PRODUCTS.map(p=>({...p})),orders:[]};}
async function fetchState(showErrors=true){
  if(!USE_MYSQL){data=localLoad();renderAll();return true;}
  try{const res=await fetch('api.php?action=state',{cache:'no-store'});const result=await res.json();if(!res.ok||!result.ok)throw new Error(result.error||'Não foi possível consultar o banco.');data={products:result.products,orders:result.orders};showError('');renderAll();return true;}
  catch(e){if(showErrors)showError('Não foi possível carregar o MySQL. Confira o XAMPP, o arquivo config.php e a importação de database.sql. Detalhe: '+e.message);return false;}
}
async function action(name,body){
  if(USE_MYSQL){const res=await fetch('api.php?action='+encodeURIComponent(name),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let result;try{result=await res.json()}catch(e){throw new Error('Resposta inválida do servidor PHP.');}if(!res.ok||!result.ok)throw new Error(result.error||'Falha ao salvar.');await fetchState();return result;}
  const next = JSON.parse(JSON.stringify(data));
  if(name==='save_product'){
    const p={...body,price:number(body.price),stock:number(body.stock),min_stock:number(body.min_stock),active:1};
    if(body.id){const item=next.products.find(x=>Number(x.id)===Number(body.id));if(!item)throw new Error('Produto não encontrado.');Object.assign(item,p,{id:item.id});}
    else{p.id=Math.max(0,...next.products.map(x=>Number(x.id)))+1;next.products.push(p);}
  }else if(name==='delete_product'){
    const p=next.products.find(x=>Number(x.id)===Number(body.id));if(!p)throw new Error('Produto não encontrado.');p.active=0;
  }else if(name==='create_order'){
    if(!Array.isArray(body.items)||!body.items.length)throw new Error('Adicione produtos ao pedido.');
    const ordered=[];
    for(const entry of body.items){const p=next.products.find(x=>Number(x.id)===Number(entry.product_id)&&Number(x.active)!==0);const qty=Number(entry.quantity);if(!p||!Number.isInteger(qty)||qty<1||qty>99)throw new Error('Item inválido.');if(Number(p.stock)<qty)throw new Error(`Estoque insuficiente de ${p.name}.`);ordered.push({product_id:p.id,product_name:p.name,unit_price:Number(p.price),quantity:qty});p.stock-=qty;}
    const id=Math.max(0,...next.orders.map(o=>Number(o.id)))+1;next.orders.push({id,client_type:body.client_type,table_name:body.table_name||'',client_name:body.client_name||'',pickup_time:body.pickup_time||'',notes:body.notes||'',status:'Pendente',payment_method:null,created_at:nowLocal(),paid_at:null,items:ordered,total:ordered.reduce((v,i)=>v+i.quantity*i.unit_price,0)});
  }else if(name==='update_status'){
    const order=next.orders.find(o=>Number(o.id)===Number(body.id));if(!order)throw new Error('Pedido não encontrado.');if(!STATUSES.includes(body.status))throw new Error('Status inválido.');order.status=body.status;
  }else if(name==='pay_order'){
    const order=next.orders.find(o=>Number(o.id)===Number(body.id));if(!order)throw new Error('Pedido não encontrado.');if(order.paid_at)throw new Error('Pedido já pago.');if(!['Pix','Dinheiro','Débito','Crédito'].includes(body.payment_method))throw new Error('Forma de pagamento inválida.');order.payment_method=body.payment_method;order.paid_at=nowLocal();
  }else throw new Error('Ação não conhecida.');
  data=next;localSave();renderAll();return {ok:true};
}
function friendlyError(e){alertMessage('Erro: '+e.message);}
function navigate(page){if(!$(page))return;activePage=page;document.querySelectorAll('.screen').forEach(e=>e.classList.toggle('active',e.id===page));document.querySelectorAll('[data-page]').forEach(e=>e.classList.toggle('active',e.dataset.page===page));const descriptions={dashboard:['Visão geral','Acompanhe o movimento do estabelecimento.'],neworder:['Novo pedido','Registre pedidos de mesas e retiradas.'],orders:['Acompanhamento de pedidos','Controle cada etapa dos pedidos.'],kitchen:['Churrasqueira','Pedidos que precisam ser preparados.'],menu:['Cardápio','Cadastre e organize os produtos.'],stock:['Estoque','Consulte as quantidades disponíveis.'],cashier:['Caixa','Registre pagamentos e feche contas.'],reports:['Relatórios','Visualize as vendas do dia.']};$('pageTitle').textContent=descriptions[page][0];$('pageDescription').textContent=descriptions[page][1];renderAll();window.scrollTo({top:0,behavior:'smooth'});}
function summaryRow(order){const name=order.client_type==='Retirada'?`Retirada · ${order.client_name}`:order.table_name;return `<div class="data-row"><div class="row-main"><strong>#${order.id} · ${escapeHTML(name)}</strong><small>${formatDate(order.created_at)} · ${escapeHTML(order.status)}</small></div><div class="row-end"><strong>${money(order.total)}</strong></div></div>`;}
function soldProducts(orders){const tally={};orders.forEach(o=>(o.items||[]).forEach(item=>{const name=item.product_name;tally[name]=(tally[name]||0)+Number(item.quantity);}));return Object.entries(tally).sort((a,b)=>b[1]-a[1]);}
function renderDashboard(){
  const todayOrders=data.orders.filter(o=>sameDay(o.created_at));const paidToday=data.orders.filter(o=>sameDay(o.paid_at));
  $('statOrders').textContent=todayOrders.length;$('statRevenue').textContent=money(paidToday.reduce((t,o)=>t+Number(o.total),0));$('statPending').textContent=data.orders.filter(o=>o.status==='Pendente').length;$('statCooking').textContent=data.orders.filter(o=>o.status==='Em preparo').length;
  $('recentList').innerHTML=recentOrders().slice(0,5).map(summaryRow).join('')||empty('Nenhum pedido registrado ainda.');
  const top=soldProducts(todayOrders).slice(0,5);$('topProducts').innerHTML=top.length?top.map(([name,count],i)=>`<div class="data-row"><div class="row-main"><strong>${i+1}. ${escapeHTML(name)}</strong><small>Quantidade vendida</small></div><div class="row-end"><strong>${count} un.</strong></div></div>`).join(''):empty('As vendas aparecerão aqui após registrar pedidos.');
}
function renderProductSelect(){const select=$('orderProduct'),chosen=select.value;select.innerHTML=availableProducts().map(p=>`<option value="${p.id}" ${Number(p.stock)<=0?'disabled':''}>${escapeHTML(p.name)} · ${money(p.price)} · estoque: ${p.stock}</option>`).join('')||'<option value="">Cadastre um produto antes</option>';if(availableProducts().some(p=>String(p.id)===chosen&&Number(p.stock)>0))select.value=chosen;}
function renderCart(){const total=cart.reduce((s,i)=>s+Number(i.price)*Number(i.quantity),0);$('cartTotal').textContent=money(total);$('cartList').innerHTML=cart.length?cart.map((i,n)=>`<div class="data-row"><div class="row-main"><strong>${i.quantity}x ${escapeHTML(i.name)}</strong><small>${money(i.price)} por unidade</small></div><div class="row-end"><strong>${money(i.quantity*i.price)}</strong><button type="button" class="btn mini danger" data-cart-remove="${n}">×</button></div></div>`).join(''):empty('Adicione um produto para começar.');}
function renderMenu(){const groups=CATEGORIES.filter(c=>availableProducts().some(p=>p.category===c));const list=groups.map(c=>`<div class="nav-caption" style="padding:16px 0 3px">${escapeHTML(c).toUpperCase()}</div>`+availableProducts().filter(p=>p.category===c).map(p=>`<div class="data-row"><div class="row-main"><strong>${escapeHTML(p.name)}</strong><small>Estoque: ${p.stock} un.</small></div><div class="row-end"><strong>${money(p.price)}</strong><button class="btn mini outline" data-edit-product="${p.id}">Editar</button><button class="btn mini danger" data-delete-product="${p.id}">Excluir</button></div></div>`).join('')).join('');$('productList').innerHTML=list||empty('Nenhum produto cadastrado.');}
function renderStock(){const products=availableProducts().slice().sort((a,b)=>Number(a.stock)-Number(b.stock));$('stockList').innerHTML=products.length?products.map(p=>`<div class="inventory-item"><div><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.category)} · mínimo: ${p.min_stock}</small></div><b>${p.stock} un.</b><span class="tag ${Number(p.stock)<=Number(p.min_stock)?'low':'ok'}">${Number(p.stock)<=Number(p.min_stock)?'Estoque baixo':'Disponível'}</span></div>`).join(''):empty('Cadastre os produtos no cardápio.');}
function tagStatus(status){return `<span class="tag ${status==='Em preparo'?'prep':status==='Pronto'?'ready':status==='Entregue'?'done':''}">${escapeHTML(status)}</span>`;}
function ticket(order,button){const label=order.client_type==='Retirada'?`Retirada: ${order.client_name}`:order.table_name;const detail=(order.items||[]).map(i=>`<li>${i.quantity}x ${escapeHTML(i.product_name)}</li>`).join('');let action='';if(button){const next=STATUSES[STATUSES.indexOf(order.status)+1];if(next)action=`<button class="btn primary" data-next-status="${order.id}" data-status="${escapeHTML(next)}">${order.status==='Pendente'?'Iniciar preparo':order.status==='Em preparo'?'Marcar pronto':'Marcar entregue'}</button>`;}
return `<article class="ticket"><div class="ticket-head"><strong>Pedido #${order.id}</strong><small>${formatDate(order.created_at)}</small></div><h4>${escapeHTML(label)}</h4>${order.client_type==='Retirada'&&order.pickup_time?`<small class="muted">Retirar às ${escapeHTML(order.pickup_time.slice(0,5))}</small>`:''}<ul>${detail}</ul>${order.notes?`<p class="notes">Obs.: ${escapeHTML(order.notes)}</p>`:''}<div class="bill"><span>${tagStatus(order.status)}</span><strong>${money(order.total)}</strong></div>${action}</article>`;}
function renderOrders(){const list=recentOrders();$('kanban').innerHTML=STATUSES.map(status=>{const orders=list.filter(o=>o.status===status);return `<div class="kanban-col"><div class="kanban-title">${status}<b>${orders.length}</b></div>${orders.map(o=>ticket(o,true)).join('')||empty('Nenhum pedido')}</div>`;}).join('');}
function renderKitchen(){const list=recentOrders().filter(o=>['Pendente','Em preparo'].includes(o.status));$('kitchenList').innerHTML=list.map(o=>ticket(o,true)).join('')||empty('Nenhum pedido aguardando preparo.');}
function renderCashier(){const open=recentOrders().filter(o=>!o.paid_at),paid=recentOrders().filter(o=>o.paid_at);const billName=o=>o.client_type==='Mesa'?o.table_name:'Retirada · '+o.client_name;
  $('openBills').innerHTML=open.map(o=>`<div class="data-row"><div class="row-main"><strong>#${o.id} · ${escapeHTML(billName(o))}</strong><small>${escapeHTML(o.status)} · ${formatDate(o.created_at)}</small><div class="payment-area"><select class="payment-select" aria-label="Forma de pagamento" id="payMethod${o.id}"><option>Pix</option><option>Dinheiro</option><option>Débito</option><option>Crédito</option></select><button class="btn mini primary" data-pay="${o.id}">Receber</button></div></div><div class="row-end"><strong>${money(o.total)}</strong></div></div>`).join('')||empty('Nenhuma conta em aberto.');
  $('paidBills').innerHTML=paid.slice(0,30).map(o=>`<div class="data-row"><div class="row-main"><strong>#${o.id} · ${escapeHTML(billName(o))}</strong><small>${escapeHTML(o.payment_method)} · ${formatDate(o.paid_at)}</small></div><div class="row-end"><strong>${money(o.total)}</strong></div></div>`).join('')||empty('Nenhum pagamento registrado.');
}
function renderBars(target,entries){const max=Math.max(1,...entries.map(x=>x[1]));$(target).innerHTML=entries.length?entries.map(([label,v])=>`<div class="chart-row"><span title="${escapeHTML(label)}">${escapeHTML(label)}</span><div class="chart-rail"><div class="chart-fill" style="width:${Math.min(100,100*Number(v)/max)}%"></div></div><b>${v}</b></div>`).join(''):empty('Ainda não há dados neste período.');}
function renderReports(){const orders=data.orders.filter(o=>sameDay(o.created_at));const paid=data.orders.filter(o=>sameDay(o.paid_at));$('reportOrders').textContent=orders.length;$('reportOrdered').textContent=money(orders.reduce((t,o)=>t+Number(o.total),0));$('reportPaid').textContent=money(paid.reduce((t,o)=>t+Number(o.total),0));$('reportOpen').textContent=data.orders.filter(o=>!o.paid_at).length;renderBars('salesBars',soldProducts(orders).slice(0,7));const hours={};orders.forEach(o=>{const d=new Date(String(o.created_at).replace(' ','T'));if(!Number.isNaN(d.getTime())){const h=String(d.getHours()).padStart(2,'0')+'h';hours[h]=(hours[h]||0)+1;}});renderBars('timeBars',Object.entries(hours).sort((a,b)=>a[0].localeCompare(b[0])));}
function renderAll(){renderDashboard();renderProductSelect();renderCart();renderMenu();renderStock();renderOrders();renderKitchen();renderCashier();renderReports();$('updatedAt').textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
function resetProductForm(){$('productForm').reset();$('editingId').value='';$('productFormTitle').textContent='Cadastrar produto';$('saveProductBtn').textContent='Salvar produto';}
$('orderType').addEventListener('change',()=>{const pickup=$('orderType').value==='Retirada';$('tableField').hidden=pickup;$('customerField').hidden=!pickup;$('pickupField').hidden=!pickup;$('tableName').required=!pickup;$('customerName').required=pickup;});
$('addToCart').addEventListener('click',()=>{const product=productById($('orderProduct').value);const quantity=Number($('orderQuantity').value);if(!product||!Number.isInteger(quantity)||quantity<1||quantity>99){alertMessage('Selecione produto e quantidade válida.');return;}const already=cart.filter(i=>Number(i.product_id)===Number(product.id)).reduce((s,i)=>s+i.quantity,0);if(quantity+already>Number(product.stock)){alertMessage('Quantidade maior que o estoque disponível.');return;}const item=cart.find(i=>Number(i.product_id)===Number(product.id));if(item)item.quantity+=quantity;else cart.push({product_id:product.id,name:product.name,price:Number(product.price),quantity});renderCart();});
$('orderForm').addEventListener('submit',async e=>{e.preventDefault();const pickup=$('orderType').value==='Retirada';if(!cart.length){alertMessage('Adicione pelo menos um produto.');return;}const body={client_type:pickup?'Retirada':'Mesa',table_name:pickup?'':$('tableName').value.trim(),client_name:pickup?$('customerName').value.trim():'',pickup_time:pickup?$('pickupTime').value:'',notes:$('orderNotes').value.trim(),items:cart.map(i=>({product_id:i.product_id,quantity:i.quantity}))};if(pickup&&!body.client_name||!pickup&&!body.table_name){alertMessage('Informe o cliente ou mesa.');return;}try{await action('create_order',body);cart=[];e.target.reset();$('orderType').dispatchEvent(new Event('change'));renderAll();alertMessage('Pedido registrado com sucesso!');navigate('orders');}catch(err){friendlyError(err);}});
$('productForm').addEventListener('submit',async e=>{e.preventDefault();const body={id:$('editingId').value?Number($('editingId').value):null,name:$('productName').value.trim(),category:$('productCategory').value,price:Number($('productPrice').value),stock:Number($('productStock').value),min_stock:Number($('productMin').value)};if(!body.name||!Number.isFinite(body.price)||body.price<=0||![body.stock,body.min_stock].every(x=>Number.isInteger(x)&&x>=0)){alertMessage('Confira os dados do produto.');return;}try{await action('save_product',body);resetProductForm();alertMessage('Produto salvo!');}catch(err){friendlyError(err);}});
$('cancelProductEdit').addEventListener('click',resetProductForm);
document.addEventListener('click',async e=>{
  const pageButton=e.target.closest('[data-page],[data-goto]');if(pageButton){navigate(pageButton.dataset.page||pageButton.dataset.goto);return;}
  const remove=e.target.closest('[data-cart-remove]');if(remove){cart.splice(Number(remove.dataset.cartRemove),1);renderCart();return;}
  const edit=e.target.closest('[data-edit-product]');if(edit){const p=productById(edit.dataset.editProduct);if(!p)return;navigate('menu');$('editingId').value=p.id;$('productName').value=p.name;$('productCategory').value=p.category;$('productPrice').value=p.price;$('productStock').value=p.stock;$('productMin').value=p.min_stock;$('productFormTitle').textContent='Editar produto';$('saveProductBtn').textContent='Atualizar produto';$('productName').focus();return;}
  const del=e.target.closest('[data-delete-product]');if(del){if(!confirm('Remover este produto do cardápio? Pedidos antigos serão preservados.'))return;try{await action('delete_product',{id:Number(del.dataset.deleteProduct)});alertMessage('Produto removido do cardápio.');}catch(err){friendlyError(err);}return;}
  const next=e.target.closest('[data-next-status]');if(next){try{await action('update_status',{id:Number(next.dataset.nextStatus),status:next.dataset.status});alertMessage('Status atualizado!');}catch(err){friendlyError(err);}return;}
  const pay=e.target.closest('[data-pay]');if(pay){const id=Number(pay.dataset.pay),method=$('payMethod'+id).value;if(!confirm('Confirmar o recebimento de '+method+' para o pedido #'+id+'?'))return;try{await action('pay_order',{id,payment_method:method});alertMessage('Pagamento registrado!');}catch(err){friendlyError(err);}return;}
});
window.addEventListener('storage',e=>{if(!USE_MYSQL&&e.key===STORAGE_KEY){data=localLoad();renderAll();}});
$('today').textContent=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
$('modeTag').textContent=USE_MYSQL?'PHP + MySQL':'Demonstração GitHub';
fetchState();
if(USE_MYSQL)setInterval(()=>{if(!document.hidden)fetchState(false);},8000);
