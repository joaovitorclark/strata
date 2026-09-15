select * from {{ source('bronze_vendas', 'pedidos') }}
