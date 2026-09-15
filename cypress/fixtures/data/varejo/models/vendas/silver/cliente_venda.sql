select * from {{ source('bronze', 'clientes_venda') }}
