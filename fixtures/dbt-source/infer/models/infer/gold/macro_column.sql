select
  id,
  {{ some_unknown_macro('x') }} as computed
from {{ source('raw', 'alpha') }}
