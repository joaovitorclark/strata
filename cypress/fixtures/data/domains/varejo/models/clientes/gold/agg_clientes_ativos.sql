select
  coalesce(status, 'desconhecido') as status,
  count(*) as qtd
from {{ ref('cliente') }}
group by 1
