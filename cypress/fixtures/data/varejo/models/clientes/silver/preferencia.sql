select
  preferencia_id,
  cliente_id,
  chave,
  valor
from {{ source('bronze_clientes', 'preferencias') }}
