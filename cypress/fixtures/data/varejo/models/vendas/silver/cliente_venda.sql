select * from {{ source('bronze_vendas', 'clientes_venda') }}
