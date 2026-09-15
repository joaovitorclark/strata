select id as customer_id, nome from {{ source('raw', 'alpha') }}
