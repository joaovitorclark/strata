select * from {{ ref('dim_cliente') }}
-- depends_on: {{ ref('fct_vendas') }}
