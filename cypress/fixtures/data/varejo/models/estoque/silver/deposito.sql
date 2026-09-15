select * from {{ source('bronze_estoque', 'depositos') }}
