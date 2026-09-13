CREATE TABLE IF NOT EXISTS loja.cliente (
  id BIGINT,
  nome STRING,
  email STRING
)
USING DELTA
COMMENT 'Dimensão de clientes';

CREATE TABLE IF NOT EXISTS loja.pedido (
  id BIGINT,
  cliente_id BIGINT,
  total DECIMAL(18,2),
  criado_em TIMESTAMP
)
USING DELTA;

