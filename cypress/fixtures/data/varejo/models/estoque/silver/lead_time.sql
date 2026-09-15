with compras as (
  select produto_id, fornecedor_id, dt_compra
  from {{ source('bronze_estoque', 'compras') }}
)
select
  produto_id,
  fornecedor_id,
  7 as dias
from compras
group by produto_id, fornecedor_id
