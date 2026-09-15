select * from {{ source('bronze_vendas', 'produtos_venda') }}
