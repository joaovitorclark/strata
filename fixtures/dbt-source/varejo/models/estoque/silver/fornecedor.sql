select * from {{ source('bronze_estoque', 'fornecedores') }}
