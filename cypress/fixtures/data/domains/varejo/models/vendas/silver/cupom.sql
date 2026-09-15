select * from {{ source('bronze_vendas', 'cupons') }}
