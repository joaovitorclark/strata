{% if true %}
select id, nome from {{ source('raw', 'alpha') }}
{% endif %}
