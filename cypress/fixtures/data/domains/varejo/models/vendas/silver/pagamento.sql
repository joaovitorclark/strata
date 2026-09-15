select * from {{ source('bronze_vendas', 'pagamentos') }}
