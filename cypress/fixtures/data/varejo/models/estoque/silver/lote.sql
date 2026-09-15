select * from {{ source('bronze_estoque', 'lotes') }}
