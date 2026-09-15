-- manual jinja: do not rewrite
select {{ var('cutoff') }} as cutoff
from {{ ref('widget') }}
where true
