select
  optin_id,
  cliente_id,
  canal,
  aceito,
  dt_optin
from {{ source('bronze_clientes', 'optins') }}
