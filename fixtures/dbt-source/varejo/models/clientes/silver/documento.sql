select * from {{ source('bronze_clientes', 'documentos') }}
