select * from {{ source('bronze', 'lotes') }}
