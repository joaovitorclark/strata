-- LocalDrawDB: script para Reverse Engineer from Script (erwin Data Modeler)

CREATE TABLE loja.cliente (
  id BIGINT NOT NULL,
  nome VARCHAR(255),
  email VARCHAR(255),
  PRIMARY KEY (id)
);

CREATE TABLE loja.pedido (
  id BIGINT NOT NULL,
  cliente_id BIGINT,
  total DECIMAL(18,2),
  criado_em TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE loja.pedido ADD CONSTRAINT fk_loja_pedido_cliente_id FOREIGN KEY (cliente_id) REFERENCES loja.cliente (id);
