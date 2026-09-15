select
  {{ dbt_utils.generate_surrogate_key(['cliente_id', 'email']) }} as cliente_sk,
  cliente_id,
  email
from {{ source('bronze_clientes', 'cadastro') }}
