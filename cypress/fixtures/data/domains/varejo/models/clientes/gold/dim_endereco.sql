select
  endereco_id,
  cliente_id,
  cidade,
  uf
from {{ ref('endereco') }}
