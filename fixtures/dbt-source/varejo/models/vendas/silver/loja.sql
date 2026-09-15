select * from {{ source('bronze_vendas', 'lojas') }}
