select * from {{ source('bronze_vendas', 'promocoes') }}
