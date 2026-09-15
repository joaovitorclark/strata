with base as (
  select cliente_id, finalidade, aceito, dt_consentimento
  from {{ source('bronze_clientes', 'consentimentos') }}
),
recente as (
  select
    cliente_id,
    finalidade,
    aceito,
    row_number() over (partition by cliente_id order by dt_consentimento desc) as rn
  from base
)
select cliente_id, finalidade, aceito
from recente
where rn = 1
