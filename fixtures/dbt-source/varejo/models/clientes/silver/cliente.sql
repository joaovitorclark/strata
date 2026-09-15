select * from {{ source('bronze_clientes', 'cadastro') }}
