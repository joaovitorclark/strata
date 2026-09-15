select * from {{ source('bronze', 'itens_pedido') }}
