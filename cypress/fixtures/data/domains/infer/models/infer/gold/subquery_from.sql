select x.id
from (select id from {{ source('raw', 'alpha') }}) x
