select * from {{ source('bronze_clientes', 'contatos') }}
