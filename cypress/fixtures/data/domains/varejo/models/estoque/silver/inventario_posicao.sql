select * from {{ source('bronze_estoque', 'inventario') }}
