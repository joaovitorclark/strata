-- LocalDrawDB: DDL PostgreSQL

CREATE TABLE loja.cliente (
  id BIGINT NOT NULL,
  nome TEXT,
  email TEXT,
  PRIMARY KEY (id)
);

CREATE TABLE loja.pedido (
  id BIGINT NOT NULL,
  cliente_id BIGINT,
  total NUMERIC(18,2),
  criado_em TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE loja.pedido ADD CONSTRAINT fk_loja_pedido_cliente_id FOREIGN KEY (cliente_id) REFERENCES loja.cliente (id);
