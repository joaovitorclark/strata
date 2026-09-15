select * from {{ source('bronze_vendas', 'itens_pedido') }}
