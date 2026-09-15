select * from {{ source('bronze_vendas', 'vendedores') }}
