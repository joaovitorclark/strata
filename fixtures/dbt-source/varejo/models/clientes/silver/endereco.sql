select * from {{ source('bronze_clientes', 'enderecos') }}
