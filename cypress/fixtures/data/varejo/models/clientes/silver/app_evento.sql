with eventos as (
  select evento_id, cliente_id, dt_evento, nome_evento
  from {{ source('bronze_clientes', 'app_eventos') }}
)
select
  evento_id,
  cliente_id,
  dt_evento,
  nome_evento
from eventos
