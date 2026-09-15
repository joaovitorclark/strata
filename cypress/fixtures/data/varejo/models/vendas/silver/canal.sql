select * from {{ source('bronze_vendas', 'canais') }}
