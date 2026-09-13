-- @layer: bronze
-- @group: vendas
CREATE TABLE loja.cliente (
  id NUMBER(19),
  nome VARCHAR2(255),
  email VARCHAR2(255),
  CONSTRAINT pk_cliente PRIMARY KEY (id)
);
COMMENT ON TABLE loja.cliente IS 'Dimensão de clientes';

-- @group: vendas
-- @fk: cliente_id -> loja.cliente.id
CREATE TABLE loja.pedido (
  id NUMBER(19),
  cliente_id NUMBER(19),
  total NUMBER(18,2),
  criado_em TIMESTAMP,
  CONSTRAINT pk_pedido PRIMARY KEY (id),
  CONSTRAINT fk_pedido_1 FOREIGN KEY (cliente_id)
    REFERENCES loja.cliente (id)
);
-- @lineage loja.pedido
--   cliente_id <- loja.cliente.id

-- @layercolors
--   bronze: #b08d57
