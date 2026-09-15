with base as (
  select pedido_id, vendedor_id, valor_bruto
  from {{ ref('pedido') }}
)
select
  vendedor_id,
  pedido_id,
  valor_bruto * 0.03 as vl_comissao
from base
where vendedor_id is not null
