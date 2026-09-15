select * from {{ source('bronze_estoque', 'perdas') }}
