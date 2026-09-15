select
  nfe_id,
  pedido_id,
  chave,
  vl_nfe,
  dt_emissao
from {{ source('bronze_vendas', 'notas_fiscais') }}
