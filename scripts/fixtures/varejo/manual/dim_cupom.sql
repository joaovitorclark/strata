select cupom_id, codigo
from {{ ref('cupom') }}
