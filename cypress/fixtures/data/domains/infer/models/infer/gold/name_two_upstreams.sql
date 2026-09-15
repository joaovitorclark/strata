select a.id
from {{ source('raw', 'alpha') }} a
join {{ source('raw', 'beta') }} b on a.id = b.id
