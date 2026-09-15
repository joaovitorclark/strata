select * from {{ source('bronze_estoque', 'unidades_medida') }}
