select
  transf_id,
  deposito_origem_id,
  deposito_destino_id,
  dt_transf
from {{ source('bronze_estoque', 'transferencias') }}
