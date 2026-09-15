select id, nome from {{ source('raw', 'alpha') }}
union all
select id, nome from {{ source('raw', 'beta') }}
