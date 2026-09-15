select
  evento_id,
  cliente_id,
  nome_evento
from {{ source('bronze_clientes', 'app_eventos') }}
