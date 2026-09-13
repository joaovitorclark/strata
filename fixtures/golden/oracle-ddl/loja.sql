-- LocalDrawDB: DDL Oracle

CREATE TABLE loja.cliente (
  id NUMBER(19) NOT NULL,
  nome VARCHAR2(255),
  email VARCHAR2(255),
  PRIMARY KEY (id)
);

CREATE TABLE loja.pedido (
  id NUMBER(19) NOT NULL,
  cliente_id NUMBER(19),
  total NUMBER(18,2),
  criado_em TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE loja.pedido ADD CONSTRAINT fk_loja_pedido_cliente_id FOREIGN KEY (cliente_id) REFERENCES loja.cliente (id);
