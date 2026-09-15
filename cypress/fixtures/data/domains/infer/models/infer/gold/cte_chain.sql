with cte1 as (
  select id, nome from {{ source('raw', 'alpha') }}
),
cte2 as (
  select id, nome from cte1
)
select id, nome from cte2
