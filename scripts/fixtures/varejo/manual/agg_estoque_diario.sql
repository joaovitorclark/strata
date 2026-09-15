select
  cast(dt_movimento as date) as dt_movimento,
  sum(quantidade) as quantidade
from {{ ref('fct_estoque') }}
group by 1
