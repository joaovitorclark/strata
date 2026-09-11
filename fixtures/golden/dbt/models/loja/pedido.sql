{{ config(materialized='view') }}

-- TODO: substituir pela lógica real de transformação

with cliente as (
    select * from {{ source('loja', 'cliente') }}
)

select
    id,
    cliente_id,
    total,
    criado_em
from cliente
