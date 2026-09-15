select * from {{ ref('fct_estoque') }}
-- depends_on: {{ ref('fct_vendas') }}
