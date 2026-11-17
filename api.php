<?php
// API simples com PHP e MySQL (projeto escolar).
// O GitHub Pages não executa este arquivo; usar XAMPP para a versão com banco.
declare(strict_types=1);
date_default_timezone_set('America/Sao_Paulo');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $result, int $status = 200): void {
    http_response_code($status);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function requireField(array $body, string $key): string {
    return trim((string)($body[$key] ?? ''));
}
function positiveInt($value, int $minimum, int $maximum, string $name): int {
    if (filter_var($value, FILTER_VALIDATE_INT) === false || (int)$value < $minimum || (int)$value > $maximum) {
        throw new InvalidArgumentException($name . ' inválido.');
    }
    return (int)$value;
}
function getDatabase(): PDO {
    $c = require __DIR__ . '/config.php';
    $dsn = 'mysql:host=' . $c['host'] . ';port=' . $c['port'] . ';dbname=' . $c['database'] . ';charset=utf8mb4';
    return new PDO($dsn, $c['username'], $c['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
}
function readBody(): array {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) throw new InvalidArgumentException('Envie dados JSON válidos.');
    return $payload;
}

$action = $_GET['action'] ?? '';
try {
    $db = getDatabase();
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'state') {
        $products = $db->query('SELECT id, name, category, price, stock, min_stock, active FROM products ORDER BY id DESC')->fetchAll();
        $orders = $db->query('SELECT id, client_type, table_name, client_name, pickup_time, notes, status, payment_method, paid_at, created_at, total FROM orders ORDER BY id DESC LIMIT 250')->fetchAll();
        $items = $db->query('SELECT order_id, product_id, product_name, unit_price, quantity FROM order_items ORDER BY id ASC')->fetchAll();
        $groups = [];
        foreach ($items as $item) $groups[(int)$item['order_id']][] = $item;
        foreach ($orders as &$order) $order['items'] = $groups[(int)$order['id']] ?? [];
        unset($order);
        respond(['ok' => true, 'products' => $products, 'orders' => $orders]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'Ação não encontrada.'], 404);
    $body = readBody();

    if ($action === 'save_product') {
        $name = requireField($body, 'name');
        $category = requireField($body, 'category');
        $price = (float)($body['price'] ?? 0);
        if ($name === '' || mb_strlen($name) > 85) throw new InvalidArgumentException('Nome do produto inválido.');
        if (!in_array($category, ['Espetinhos tradicionais','Espetinhos especiais','Jantinhas','Chopp','Outras bebidas','Outros'], true)) throw new InvalidArgumentException('Categoria inválida.');
        if (!is_finite($price) || $price <= 0 || $price > 10000) throw new InvalidArgumentException('Preço inválido.');
        $stock = positiveInt($body['stock'] ?? null, 0, 100000, 'Estoque');
        $minimum = positiveInt($body['min_stock'] ?? null, 0, 100000, 'Estoque mínimo');
        if (!empty($body['id'])) {
            $id = positiveInt($body['id'], 1, 999999999, 'Código do produto');
            $q = $db->prepare('UPDATE products SET name=?, category=?, price=?, stock=?, min_stock=? WHERE id=? AND active=1');
            $q->execute([$name,$category,$price,$stock,$minimum,$id]);
        } else {
            $q = $db->prepare('INSERT INTO products (name, category, price, stock, min_stock) VALUES (?,?,?,?,?)');
            $q->execute([$name,$category,$price,$stock,$minimum]);
        }
        respond(['ok' => true]);
    }
    if ($action === 'delete_product') {
        $id = positiveInt($body['id'] ?? null, 1, 999999999, 'Código do produto');
        $q = $db->prepare('UPDATE products SET active=0 WHERE id=?');
        $q->execute([$id]);
        respond(['ok' => true]);
    }
    if ($action === 'create_order') {
        $type = requireField($body, 'client_type');
        $table = requireField($body, 'table_name');
        $customer = requireField($body, 'client_name');
        $pickup = requireField($body, 'pickup_time');
        $notes = requireField($body, 'notes');
        if (!in_array($type, ['Mesa','Retirada'], true)) throw new InvalidArgumentException('Tipo de pedido inválido.');
        if ($type === 'Mesa' && ($table === '' || mb_strlen($table)>35)) throw new InvalidArgumentException('Informe a mesa.');
        if ($type === 'Retirada' && ($customer === '' || mb_strlen($customer)>70)) throw new InvalidArgumentException('Informe o cliente.');
        if ($pickup !== '' && !preg_match('/^([01][0-9]|2[0-3]):[0-5][0-9]$/', substr($pickup,0,5))) throw new InvalidArgumentException('Horário de retirada inválido.');
        if (mb_strlen($notes)>300) throw new InvalidArgumentException('Observação muito longa.');
        if (!isset($body['items']) || !is_array($body['items']) || count($body['items'])<1 || count($body['items'])>50) throw new InvalidArgumentException('Adicione de 1 a 50 itens.');
        $db->beginTransaction();
        try {
            $clean = [];
            $total = 0.0;
            $findProduct = $db->prepare('SELECT id, name, price, stock, active FROM products WHERE id=? FOR UPDATE');
            $decrease = $db->prepare('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?');
            foreach ($body['items'] as $item) {
                if (!is_array($item)) throw new InvalidArgumentException('Item inválido.');
                $id = positiveInt($item['product_id'] ?? null, 1, 999999999, 'Produto');
                $quantity = positiveInt($item['quantity'] ?? null, 1, 99, 'Quantidade');
                $findProduct->execute([$id]);
                $p = $findProduct->fetch();
                if (!$p || (int)$p['active'] !== 1) throw new InvalidArgumentException('Produto não encontrado no cardápio.');
                if ((int)$p['stock'] < $quantity) throw new InvalidArgumentException('Estoque insuficiente de ' . $p['name'] . '.');
                $decrease->execute([$quantity,$id,$quantity]);
                if ($decrease->rowCount() !== 1) throw new InvalidArgumentException('Estoque insuficiente para o pedido.');
                $clean[] = ['id' => $id,'name' => $p['name'],'unit_price' => (float)$p['price'],'quantity' => $quantity];
                $total += (float)$p['price'] * $quantity;
            }
            $insertOrder = $db->prepare('INSERT INTO orders (client_type, table_name, client_name, pickup_time, notes, status, total) VALUES (?,?,?,?,?,?,?)');
            $insertOrder->execute([$type,$type==='Mesa'?$table:null,$type==='Retirada'?$customer:null,$type==='Retirada'&&$pickup!==''?$pickup:null,$notes,'Pendente',round($total,2)]);
            $orderId = (int)$db->lastInsertId();
            $insertItem = $db->prepare('INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES (?,?,?,?,?)');
            foreach ($clean as $item) $insertItem->execute([$orderId,$item['id'],$item['name'],$item['unit_price'],$item['quantity']]);
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
        respond(['ok'=>true, 'id'=>$orderId]);
    }
    if ($action === 'update_status') {
        $id = positiveInt($body['id'] ?? null, 1, 999999999, 'Pedido');
        $status = requireField($body, 'status');
        if (!in_array($status,['Pendente','Em preparo','Pronto','Entregue'],true)) throw new InvalidArgumentException('Status inválido.');
        $q = $db->prepare('UPDATE orders SET status=? WHERE id=?');
        $q->execute([$status,$id]);
        respond(['ok'=>true]);
    }
    if ($action === 'pay_order') {
        $id = positiveInt($body['id'] ?? null, 1, 999999999, 'Pedido');
        $method = requireField($body, 'payment_method');
        if (!in_array($method,['Pix','Dinheiro','Débito','Crédito'],true)) throw new InvalidArgumentException('Pagamento inválido.');
        $q = $db->prepare('UPDATE orders SET payment_method=?, paid_at=NOW() WHERE id=? AND paid_at IS NULL');
        $q->execute([$method,$id]);
        if ($q->rowCount()!==1) throw new InvalidArgumentException('Pedido não encontrado ou já pago.');
        respond(['ok'=>true]);
    }
    respond(['ok'=>false,'error'=>'Ação não encontrada.'],404);
} catch (InvalidArgumentException $e) {
    respond(['ok'=>false,'error'=>$e->getMessage()],400);
} catch (PDOException $e) {
    error_log('HL Chopp MySQL: '.$e->getMessage());
    respond(['ok'=>false,'error'=>'Falha no banco MySQL. Confira o XAMPP e a importação do database.sql.'],500);
} catch (Throwable $e) {
    error_log('HL Chopp erro: '.$e->getMessage());
    respond(['ok'=>false,'error'=>'Não foi possível concluir a operação.'],500);
}
