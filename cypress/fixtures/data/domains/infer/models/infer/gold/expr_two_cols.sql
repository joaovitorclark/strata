select id, valor + extra as total from {{ source('raw', 'alpha') }}
