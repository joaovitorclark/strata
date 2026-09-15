select * from {{ source('bronze', 'pedidos') }}
