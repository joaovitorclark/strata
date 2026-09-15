with nfe as (
  select pedido_id, vl_nfe, dt_emissao
  from {{ source('bronze_vendas', 'notas_fiscais') }}
),
ranked as (
  select
    pedido_id,
    vl_nfe as vl_frete,
    row_number() over (partition by pedido_id order by dt_emissao) as rn
  from nfe
)
select pedido_id, vl_frete, cast(null as varchar) as uf
from ranked
where rn = 1
