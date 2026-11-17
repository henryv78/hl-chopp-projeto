"""POO em Python aplicada aos pedidos da H&L Chopp.

Este arquivo lê os pedidos do mesmo sistema PHP/MySQL por meio da API JSON.
Execute após iniciar o XAMPP: python poo/relatorio.py
Sem XAMPP, para estudar as classes: python poo/relatorio.py --demo
"""
import json
import sys
from urllib.request import urlopen
from urllib.error import URLError


class Produto:
    def __init__(self, nome, preco):
        self.nome = nome
        self.preco = float(preco)


class ItemPedido:
    def __init__(self, produto, quantidade):
        self.produto = produto
        self.quantidade = int(quantidade)

    def subtotal(self):
        return self.produto.preco * self.quantidade


class Pedido:
    def __init__(self, numero, cliente, status):
        self.numero = numero
        self.cliente = cliente
        self.status = status
        self.itens = []

    def adicionar_item(self, item):
        self.itens.append(item)

    def calcular_total(self):
        return sum(item.subtotal() for item in self.itens)

    def quantidade_de_itens(self):
        return sum(item.quantidade for item in self.itens)

    def mostrar_resumo(self):
        total = f"R$ {self.calcular_total():.2f}".replace('.', ',')
        return f"Pedido #{self.numero} | {self.cliente} | {self.status} | {self.quantidade_de_itens()} itens | {total}"


def criar_pedidos(dados):
    pedidos = []
    for registro in dados:
        nome = registro.get('table_name') or registro.get('client_name') or 'Cliente'
        pedido = Pedido(registro['id'], nome, registro['status'])
        for linha in registro.get('items', []):
            produto = Produto(linha['product_name'], linha['unit_price'])
            pedido.adicionar_item(ItemPedido(produto, linha['quantity']))
        pedidos.append(pedido)
    return pedidos


def carregar_dados(url):
    with urlopen(url, timeout=10) as resposta:
        dados = json.load(resposta)
    if not dados.get('ok'):
        raise ValueError('A API não retornou pedidos válidos.')
    return dados['orders']


def executar():
    if '--demo' in sys.argv:
        print('DEMONSTRAÇÃO: valores fictícios apenas para testar a programação.')
        registros = [{
            'id': 1, 'table_name': 'Mesa 03', 'status': 'Pendente',
            'items': [
                {'product_name': 'Espetinho de carne', 'unit_price': 12, 'quantity': 2},
                {'product_name': 'Refrigerante', 'unit_price': 7, 'quantity': 1}
            ]
        }]
    else:
        url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost/HL-Chopp-Projeto-Escolar/api.php?action=state'
        print('Lendo dados compartilhados com o site PHP/MySQL...')
        try:
            registros = carregar_dados(url)
        except (URLError, ValueError, OSError) as erro:
            print('Não foi possível acessar a API do XAMPP:', erro)
            print('Inicie Apache e MySQL, importe database.sql e confirme a URL no navegador.')
            print('Para testar as classes sem servidor, execute: python poo/relatorio.py --demo')
            return

    pedidos = criar_pedidos(registros)
    if not pedidos:
        print('Nenhum pedido cadastrado ainda.')
        return
    print('\nRELATÓRIO DA H&L CHOPP - POO EM PYTHON')
    print('-' * 58)
    for pedido in pedidos:
        print(pedido.mostrar_resumo())
    print('-' * 58)
    print('Total de pedidos:', len(pedidos))
    print('Valor de todos os pedidos: R$', f'{sum(p.calcular_total() for p in pedidos):.2f}'.replace('.', ','))


if __name__ == '__main__':
    executar()
