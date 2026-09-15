with loja as (
  select canal_id, receita_bruta from {{ ref('fct_vendas') }} where canal_id is not null
),
marketplace as (
  select canal_id, receita_bruta from {{ ref('fct_vendas') }} where canal_id is not null
)
select canal_id, sum(receita_bruta) as receita_bruta
from (
  select * from loja
  union all
  select * from marketplace
) u
group by canal_id
