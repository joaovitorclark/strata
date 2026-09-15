select
  inventario_id,
  deposito_id,
  dt_contagem
from {{ ref('inventario_posicao') }}
