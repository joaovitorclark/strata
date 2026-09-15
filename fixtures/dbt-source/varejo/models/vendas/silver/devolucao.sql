select * from {{ source('bronze_vendas', 'devolucoes') }}
