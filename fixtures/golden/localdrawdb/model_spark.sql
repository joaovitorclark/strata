-- @layer: bronze
-- @group: vendas
CREATE TABLE IF NOT EXISTS loja.cliente (
  id BIGINT NOT NULL,
  nome STRING,
  email STRING,
  PRIMARY KEY (id)
) USING DELTA;

-- @group: vendas
-- @origen: loja.cliente
-- @fk: cliente_id -> loja.cliente.id
CREATE TABLE IF NOT EXISTS loja.pedido (
  id BIGINT NOT NULL,
  cliente_id BIGINT,
  total DECIMAL(18,2),
  criado_em TIMESTAMP,
  PRIMARY KEY (id)
) USING DELTA;

-- @layercolors
--   bronze: #b08d57
