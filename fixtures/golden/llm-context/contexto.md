# Contexto de modelo de dados (LocalDrawDB)

> Gerado em 2026-09-10. Tabelas: 2. Relacionamentos: 1.

## Visão geral
- Tabelas: 2
- Relacionamentos (FK): 1
- Camadas: 1

## Camadas (layers)

| camada | cor |
|---|---|
| bronze | #b08d57 |

## Tabelas

### loja.cliente
- **Descrição**: Dimensão de clientes
- **TableGroup**: vendas
- **Camada**: bronze

| coluna | tipo | constraints | descrição |
|---|---|---|---|
| `id` (bigint) [PK] | bigint | — |  |
| `nome` (string) | string | — |  |
| `email` (string) | string | — |  |

### loja.pedido
- **TableGroup**: vendas

| coluna | tipo | constraints | descrição |
|---|---|---|---|
| `id` (bigint) [PK] | bigint | — |  |
| `cliente_id` (bigint) | bigint | — |  |
| `total` (decimal(18,2)) | decimal(18,2) | — |  |
| `criado_em` (timestamp) | timestamp | — |  |

## Relacionamentos

- loja.pedido.cliente_id > loja.cliente.id

## JSON estruturado

Abaixo, o mesmo conteúdo em JSON — útil para parsing automático pelo agente.

```json
{
  "tables": [
    {
      "name": "cliente",
      "schema": "loja",
      "columns": [
        {
          "name": "id",
          "type": "bigint",
          "pk": true,
          "nullable": true
        },
        {
          "name": "nome",
          "type": "string",
          "pk": false,
          "nullable": true
        },
        {
          "name": "email",
          "type": "string",
          "pk": false,
          "nullable": true
        }
      ],
      "note": "Dimensão de clientes",
      "group": "vendas",
      "layer": "bronze"
    },
    {
      "name": "pedido",
      "schema": "loja",
      "columns": [
        {
          "name": "id",
          "type": "bigint",
          "pk": true,
          "nullable": true
        },
        {
          "name": "cliente_id",
          "type": "bigint",
          "pk": false,
          "nullable": true
        },
        {
          "name": "total",
          "type": "decimal",
          "args": "18,2",
          "pk": false,
          "nullable": true
        },
        {
          "name": "criado_em",
          "type": "timestamp",
          "pk": false,
          "nullable": true
        }
      ],
      "group": "vendas"
    }
  ],
  "refs": [
    {
      "from": {
        "table": "loja.pedido",
        "column": "cliente_id"
      },
      "to": {
        "table": "loja.cliente",
        "column": "id"
      },
      "kind": ">"
    }
  ],
  "lineage": [
    {
      "target": "loja.pedido",
      "sources": [
        "loja.cliente"
      ]
    }
  ],
  "layerColors": {
    "bronze": "#b08d57"
  }
}
```