select * from {{ source('bronze', 'produtos_venda') }}
