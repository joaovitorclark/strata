import type { ParsedFieldLineage } from "../../../src/features/schema/model/dbmlClean.ts";
import type { ParsedRecords } from "../../../src/features/schema/model/records.ts";
import type { SchemaView } from "../../../src/features/schema/model/views.ts";
import type {
  StrataColumn,
  StrataEnum,
  StrataIndex,
  StrataModel,
  StrataRef,
  StrataTable,
} from "../../../src/features/dbt-source/index.ts";

export const PROJECTS = ["vendas", "estoque", "clientes"] as const;
export type Projeto = (typeof PROJECTS)[number];
export type Layer = "bronze" | "silver" | "gold";

export type ChainHop = { table: string; column: string };

export const CHAINS: ChainHop[][] = [
  [
    { table: "bronze.pedidos", column: "vl_total" },
    { table: "silver.pedido", column: "valor_bruto" },
    { table: "gold.fct_vendas", column: "receita_bruta" },
    { table: "gold.agg_vendas_diarias", column: "receita_bruta_dia" },
  ],
  [
    { table: "bronze.movimentacoes", column: "quantidade" },
    { table: "silver.movimentacao", column: "quantidade" },
    { table: "gold.fct_estoque", column: "quantidade" },
    { table: "gold.fct_giro_produto", column: "qtd_movimentada" },
  ],
  [
    { table: "bronze.cadastro", column: "cliente_id" },
    { table: "silver.cliente", column: "cliente_id" },
    { table: "gold.dim_cliente", column: "cliente_id" },
    { table: "gold.dim_cliente_360", column: "cliente_id" },
  ],
];

export const MANUAL_MODELS = new Set<string>([
  "frete",
  "comissao",
  "nota_fiscal",
  "agg_vendas_canal",
  "dim_cupom",
  "lead_time",
  "app_evento",
  "transferencia",
  "agg_estoque_diario",
  "fct_inventario",
  "preferencia",
  "optin",
  "cliente_unico",
  "lgpd_cliente",
  "agg_clientes_ativos",
  "dim_endereco",
  "fct_app_evento",
]);

const STATUS_PEDIDO = ["pendente", "pago", "enviado", "entregue", "cancelado"] as const;
const CANAL_VENDA = ["loja", "e_commerce", "marketplace", "televendas"] as const;
const TIPO_MOV = ["entrada", "saida", "ajuste", "transferencia"] as const;

const PROJECT_COLOR: Record<Projeto, string> = {
  vendas: "#8aadf4",
  estoque: "#a6da95",
  clientes: "#c6a0f6",
};

type ColOpts = {
  pk?: boolean;
  notNull?: boolean;
  unique?: boolean;
  enumName?: string;
  acceptedValues?: string[];
  note?: string;
};

function C(name: string, type: string, opts: ColOpts = {}): StrataColumn {
  const col: StrataColumn = {
    name,
    type,
    pk: opts.pk ?? false,
    notNull: opts.notNull ?? opts.pk ?? false,
  };
  if (opts.unique) col.unique = true;
  if (opts.note) col.note = opts.note;
  if (opts.enumName) col.enumName = opts.enumName;
  if (opts.acceptedValues) col.acceptedValues = opts.acceptedValues;
  return col;
}

function projectTag(projeto: Projeto): string {
  return `strata:${projeto}`;
}

function table(opts: {
  project: Projeto;
  layer: Layer;
  kind: "source" | "model";
  name: string;
  columns: StrataColumn[];
  managed?: boolean;
  compositePks?: string[][];
  indexes?: StrataIndex[];
}): StrataTable {
  const tags = opts.managed ? ["strata:managed", projectTag(opts.project)] : [projectTag(opts.project)];
  const row: StrataTable = {
    id: `${opts.layer}.${opts.name}`,
    name: opts.name,
    // Table id is schema.name (D2). Sources share the bronze schema so ids stay unique and stable
    // across the domain; the dbt source name still carries the project (bronze_<project>).
    schema: opts.layer,
    project: opts.project,
    kind: opts.kind,
    layer: opts.layer,
    columns: opts.columns,
    tags,
    resourceType: opts.kind,
  };
  if (opts.compositePks) row.compositePks = opts.compositePks;
  if (opts.indexes) row.indexes = opts.indexes;
  return row;
}

function bronze(
  project: Projeto,
  name: string,
  columns: StrataColumn[],
  extra: { compositePks?: string[][]; indexes?: StrataIndex[] } = {},
): StrataTable {
  return table({
    project,
    layer: "bronze",
    kind: "source",
    name,
    columns,
    compositePks: extra.compositePks,
    indexes: extra.indexes,
  });
}

function staging(
  src: StrataTable,
  name: string,
  managed: boolean,
  rename: Record<string, string> = {},
): { table: StrataTable; lineage: ParsedFieldLineage[] } {
  const columns = src.columns.map((c) => ({ ...c, name: rename[c.name] ?? c.name }));
  const compositePks = src.compositePks?.map((pk) => pk.map((c) => rename[c] ?? c));
  const t = table({
    project: src.project as Projeto,
    layer: "silver",
    kind: "model",
    name,
    columns,
    managed,
    compositePks,
  });
  const lineage: ParsedFieldLineage[] = t.columns.map((c) => {
    const sourceColumn =
      Object.entries(rename).find(([, v]) => v === c.name)?.[0] ?? c.name;
    return {
      targetTable: t.id,
      targetColumn: c.name,
      sourceTable: src.id,
      sourceColumn,
    };
  });
  return { table: t, lineage };
}

function goldModel(
  project: Projeto,
  name: string,
  columns: StrataColumn[],
  lineage: Array<{ col: string; fromTable: string; fromCol: string }>,
  managed: boolean,
): { table: StrataTable; lineage: ParsedFieldLineage[] } {
  const t = table({ project, layer: "gold", kind: "model", name, columns, managed });
  return {
    table: t,
    lineage: lineage.map((l) => ({
      targetTable: t.id,
      targetColumn: l.col,
      sourceTable: l.fromTable,
      sourceColumn: l.fromCol,
    })),
  };
}

function appEventosColumns(): StrataColumn[] {
  const cols: StrataColumn[] = [
    C("evento_id", "bigint", { pk: true }),
    C("cliente_id", "bigint", { notNull: true }),
    C("dt_evento", "timestamp", { notNull: true }),
    C("nome_evento", "string", { notNull: true }),
    C("plataforma", "string"),
    C("versao_app", "string"),
    C("payload_json", "string"),
    C("dt_carga", "timestamp", { notNull: true }),
  ];
  const blocks: Array<[string, number]> = [
    ["device_", 48],
    ["geo_", 44],
    ["utm_", 44],
    ["sessao_", 44],
  ];
  for (const [prefix, n] of blocks) {
    for (let i = 1; i <= n; i++) {
      cols.push(C(`${prefix}${String(i).padStart(2, "0")}`, i % 7 === 0 ? "bigint" : "string"));
    }
  }
  return cols;
}

function fk(source: string, fromCol: string, target: string, toCol: string): StrataRef {
  return {
    id: `${source}.${fromCol}->${target}.${toCol}`,
    source,
    target,
    fromCol,
    toCol,
    fromRel: "*",
    toRel: "1",
  };
}

function asExternal(table: StrataTable): StrataTable {
  return {
    id: table.id,
    name: table.name,
    schema: table.schema,
    project: table.project,
    kind: "model",
    layer: table.layer,
    group: table.group,
    note: table.note,
    columns: table.columns.map((c) => ({ ...c })),
    compositePks: table.compositePks,
    tags: table.tags,
    resourceType: "model",
    external: true,
    externalProject: table.project,
  };
}

function applyDocs(tables: StrataTable[]): void {
  const sorted = [...tables].sort((a, b) => a.id.localeCompare(b.id));
  const nTables = Math.ceil(sorted.length * 0.6);
  for (let i = 0; i < nTables; i++) {
    sorted[i].note = `Tabela de negócio ${sorted[i].name} no domínio varejo.`;
  }
  const cols: StrataColumn[] = [];
  for (const t of sorted) {
    for (const c of t.columns) cols.push(c);
  }
  const keyed = cols
    .map((c, i) => {
      const owner = sorted.find((t) => t.columns.includes(c));
      return { key: `${owner?.id ?? ""}.${c.name}.${i}`, col: c };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  const nCols = Math.ceil(keyed.length * 0.3);
  for (let i = 0; i < nCols; i++) {
    keyed[i].col.note = `Coluna ${keyed[i].col.name}.`;
  }
}

function positionsFor(tables: StrataTable[]): Record<string, { x: number; y: number }> {
  const layerX: Record<Layer, number> = { bronze: 40, silver: 520, gold: 1000 };
  const byLayer: Record<Layer, StrataTable[]> = { bronze: [], silver: [], gold: [] };
  for (const t of tables) {
    const layer = (t.layer ?? "bronze") as Layer;
    byLayer[layer].push(t);
  }
  const out: Record<string, { x: number; y: number }> = {};
  for (const layer of ["bronze", "silver", "gold"] as Layer[]) {
    const list = [...byLayer[layer]].sort((a, b) => a.name.localeCompare(b.name));
    list.forEach((t, i) => {
      out[t.id] = { x: layerX[layer], y: 40 + i * 96 };
    });
  }
  return out;
}

export type VarejoDomain = {
  tables: StrataTable[];
  refs: StrataRef[];
  lineage: ParsedFieldLineage[];
  records: ParsedRecords[];
  enums: StrataEnum[];
  views: SchemaView[];
  colors: Record<string, string>;
  pins: string[];
  canvasByProject: Record<Projeto, NonNullable<StrataModel["canvas"]>>;
};

function buildDomain(): VarejoDomain {
  const pedidos = bronze("vendas", "pedidos", [
    C("pedido_id", "bigint", { pk: true }),
    C("cliente_id", "bigint", { notNull: true }),
    C("canal_id", "bigint", { notNull: true }),
    C("loja_id", "bigint"),
    C("vendedor_id", "bigint"),
    C("cupom_id", "bigint"),
    C("vl_total", "decimal(18,2)", { notNull: true }),
    C("vl_desconto", "decimal(18,2)"),
    C("vl_frete", "decimal(18,2)"),
    C("status", "string", {
      notNull: true,
      enumName: "status_pedido",
      acceptedValues: [...STATUS_PEDIDO],
    }),
    C("dt_emissao", "timestamp", { notNull: true }),
    C("dt_carga", "timestamp", { notNull: true }),
  ], {
    indexes: [{ name: "idx_pedidos_cliente_dt", columns: ["cliente_id", "dt_emissao"] }],
  });

  const itensPedido = bronze(
    "vendas",
    "itens_pedido",
    [
      C("pedido_id", "bigint", { pk: true }),
      C("item_seq", "int", { pk: true }),
      C("produto_id", "bigint", { notNull: true }),
      C("qtd", "decimal(18,3)", { notNull: true }),
      C("vl_unitario", "decimal(18,2)", { notNull: true }),
      C("vl_total", "decimal(18,2)", { notNull: true }),
    ],
    { compositePks: [["pedido_id", "item_seq"]] },
  );

  const pagamentos = bronze("vendas", "pagamentos", [
    C("pagamento_id", "bigint", { pk: true }),
    C("pedido_id", "bigint", { notNull: true }),
    C("meio", "string", { notNull: true }),
    C("vl_pago", "decimal(18,2)", { notNull: true }),
    C("dt_pagamento", "timestamp", { notNull: true }),
    C("nsu", "string", { unique: true }),
  ]);

  const devolucoes = bronze("vendas", "devolucoes", [
    C("devolucao_id", "bigint", { pk: true }),
    C("pedido_id", "bigint", { notNull: true }),
    C("item_seq", "int"),
    C("motivo", "string"),
    C("vl_estornado", "decimal(18,2)", { notNull: true }),
    C("dt_devolucao", "timestamp", { notNull: true }),
  ]);

  const cupons = bronze("vendas", "cupons", [
    C("cupom_id", "bigint", { pk: true }),
    C("codigo", "string", { unique: true, notNull: true }),
    C("tipo", "string"),
    C("vl_desconto", "decimal(18,2)"),
    C("dt_validade", "date"),
  ]);

  const canais = bronze("vendas", "canais", [
    C("canal_id", "bigint", { pk: true }),
    C("codigo", "string", {
      unique: true,
      notNull: true,
      enumName: "canal_venda",
      acceptedValues: [...CANAL_VENDA],
    }),
    C("nome", "string", { notNull: true }),
  ]);

  const vendedores = bronze("vendas", "vendedores", [
    C("vendedor_id", "bigint", { pk: true }),
    C("nome", "string", { notNull: true }),
    C("loja_id", "bigint"),
    C("ativo", "boolean"),
  ]);

  const lojas = bronze("vendas", "lojas", [
    C("loja_id", "bigint", { pk: true }),
    C("nome", "string", { notNull: true }),
    C("uf", "string"),
    C("cidade", "string"),
  ]);

  const produtosVenda = bronze("vendas", "produtos_venda", [
    C("produto_id", "bigint", { pk: true }),
    C("sku", "string", { unique: true, notNull: true }),
    C("nome", "string", { notNull: true }),
    C("categoria", "string"),
    C("vl_tabela", "decimal(18,2)"),
  ]);

  const clientesVenda = bronze("vendas", "clientes_venda", [
    C("cliente_id", "bigint", { pk: true }),
    C("nome", "string", { notNull: true }),
    C("email", "string", { unique: true }),
    C("documento", "string"),
  ]);

  const promocoes = bronze("vendas", "promocoes", [
    C("promocao_id", "bigint", { pk: true }),
    C("nome", "string", { notNull: true }),
    C("dt_inicio", "date"),
    C("dt_fim", "date"),
    C("perc_desconto", "decimal(5,2)"),
  ]);

  const notasFiscais = bronze("vendas", "notas_fiscais", [
    C("nfe_id", "bigint", { pk: true }),
    C("pedido_id", "bigint", { notNull: true }),
    C("chave", "string", { unique: true, notNull: true }),
    C("vl_nfe", "decimal(18,2)", { notNull: true }),
    C("dt_emissao", "timestamp", { notNull: true }),
  ]);

  const produtos = bronze("estoque", "produtos", [
    C("produto_id", "bigint", { pk: true }),
    C("sku", "string", { unique: true, notNull: true }),
    C("nome", "string", { notNull: true }),
    C("categoria", "string"),
    C("marca", "string"),
  ]);

  const fornecedores = bronze("estoque", "fornecedores", [
    C("fornecedor_id", "bigint", { pk: true }),
    C("nome", "string", { notNull: true }),
    C("cnpj", "string", { unique: true }),
  ]);

  const movimentacoes = bronze("estoque", "movimentacoes", [
    C("mov_id", "bigint", { pk: true }),
    C("produto_id", "bigint", { notNull: true }),
    C("deposito_id", "bigint", { notNull: true }),
    C("tipo", "string", {
      notNull: true,
      enumName: "tipo_movimentacao",
      acceptedValues: [...TIPO_MOV],
    }),
    C("quantidade", "decimal(18,3)", { notNull: true }),
    C("dt_movimento", "timestamp", { notNull: true }),
  ], {
    indexes: [{ name: "idx_mov_produto_dt", columns: ["produto_id", "dt_movimento"] }],
  });

  const inventario = bronze("estoque", "inventario", [
    C("inventario_id", "bigint", { pk: true }),
    C("deposito_id", "bigint", { notNull: true }),
    C("dt_contagem", "date", { notNull: true }),
    C("status", "string"),
  ]);

  const depositos = bronze("estoque", "depositos", [
    C("deposito_id", "bigint", { pk: true }),
    C("nome", "string", { notNull: true }),
    C("uf", "string"),
    C("tipo", "string"),
  ]);

  const unidadesMedida = bronze("estoque", "unidades_medida", [
    C("unidade_id", "bigint", { pk: true }),
    C("sigla", "string", { unique: true, notNull: true }),
    C("nome", "string", { notNull: true }),
  ]);

  const lotes = bronze("estoque", "lotes", [
    C("lote_id", "bigint", { pk: true }),
    C("produto_id", "bigint", { notNull: true }),
    C("codigo", "string", { notNull: true }),
    C("dt_validade", "date"),
  ]);

  const transferencias = bronze("estoque", "transferencias", [
    C("transf_id", "bigint", { pk: true }),
    C("deposito_origem_id", "bigint", { notNull: true }),
    C("deposito_destino_id", "bigint", { notNull: true }),
    C("dt_transf", "timestamp", { notNull: true }),
  ]);

  const perdas = bronze("estoque", "perdas", [
    C("perda_id", "bigint", { pk: true }),
    C("produto_id", "bigint", { notNull: true }),
    C("quantidade", "decimal(18,3)", { notNull: true }),
    C("motivo", "string"),
    C("dt_perda", "date", { notNull: true }),
  ]);

  const compras = bronze("estoque", "compras", [
    C("compra_id", "bigint", { pk: true }),
    C("fornecedor_id", "bigint", { notNull: true }),
    C("produto_id", "bigint", { notNull: true }),
    C("quantidade", "decimal(18,3)", { notNull: true }),
    C("vl_total", "decimal(18,2)", { notNull: true }),
    C("dt_compra", "date", { notNull: true }),
  ]);

  const cadastro = bronze("clientes", "cadastro", [
    C("cliente_id", "bigint", { pk: true }),
    C("nome", "string", { notNull: true }),
    C("email", "string", { unique: true }),
    C("cpf", "string", { unique: true }),
    C("dt_nascimento", "date"),
    C("status", "string"),
  ]);

  const enderecos = bronze("clientes", "enderecos", [
    C("endereco_id", "bigint", { pk: true }),
    C("cliente_id", "bigint", { notNull: true }),
    C("tipo", "string"),
    C("logradouro", "string"),
    C("cidade", "string"),
    C("uf", "string"),
    C("cep", "string"),
  ]);

  const consentimentos = bronze("clientes", "consentimentos", [
    C("consentimento_id", "bigint", { pk: true }),
    C("cliente_id", "bigint", { notNull: true }),
    C("finalidade", "string", { notNull: true }),
    C("aceito", "boolean", { notNull: true }),
    C("dt_consentimento", "timestamp", { notNull: true }),
  ]);

  const appEventos = bronze("clientes", "app_eventos", appEventosColumns());

  const documentos = bronze("clientes", "documentos", [
    C("documento_id", "bigint", { pk: true }),
    C("cliente_id", "bigint", { notNull: true }),
    C("tipo", "string", { notNull: true }),
    C("numero", "string", { notNull: true }),
  ]);

  const contatos = bronze("clientes", "contatos", [
    C("contato_id", "bigint", { pk: true }),
    C("cliente_id", "bigint", { notNull: true }),
    C("tipo", "string"),
    C("valor", "string", { notNull: true }),
  ]);

  const preferencias = bronze("clientes", "preferencias", [
    C("preferencia_id", "bigint", { pk: true }),
    C("cliente_id", "bigint", { notNull: true }),
    C("chave", "string", { notNull: true }),
    C("valor", "string"),
  ]);

  const optins = bronze("clientes", "optins", [
    C("optin_id", "bigint", { pk: true }),
    C("cliente_id", "bigint", { notNull: true }),
    C("canal", "string", { notNull: true }),
    C("aceito", "boolean", { notNull: true }),
    C("dt_optin", "timestamp", { notNull: true }),
  ]);

  const bronzeTables = [
    pedidos,
    itensPedido,
    pagamentos,
    devolucoes,
    cupons,
    canais,
    vendedores,
    lojas,
    produtosVenda,
    clientesVenda,
    promocoes,
    notasFiscais,
    produtos,
    fornecedores,
    movimentacoes,
    inventario,
    depositos,
    unidadesMedida,
    lotes,
    transferencias,
    perdas,
    compras,
    cadastro,
    enderecos,
    consentimentos,
    appEventos,
    documentos,
    contatos,
    preferencias,
    optins,
  ];

  const silverSpecs: Array<{ src: StrataTable; name: string; rename?: Record<string, string> }> = [
    { src: pedidos, name: "pedido", rename: { vl_total: "valor_bruto", vl_desconto: "valor_desconto", vl_frete: "valor_frete" } },
    { src: itensPedido, name: "item_pedido" },
    { src: pagamentos, name: "pagamento" },
    { src: devolucoes, name: "devolucao" },
    { src: cupons, name: "cupom" },
    { src: canais, name: "canal" },
    { src: vendedores, name: "vendedor" },
    { src: lojas, name: "loja" },
    { src: produtosVenda, name: "produto_venda" },
    { src: clientesVenda, name: "cliente_venda" },
    { src: promocoes, name: "promocao" },
    { src: notasFiscais, name: "nota_fiscal" },
    { src: produtos, name: "produto" },
    { src: fornecedores, name: "fornecedor" },
    { src: movimentacoes, name: "movimentacao" },
    { src: inventario, name: "inventario_posicao" },
    { src: depositos, name: "deposito" },
    { src: unidadesMedida, name: "unidade_medida" },
    { src: lotes, name: "lote" },
    { src: transferencias, name: "transferencia" },
    { src: perdas, name: "perda" },
    { src: compras, name: "compra" },
    { src: cadastro, name: "cliente" },
    { src: enderecos, name: "endereco" },
    { src: consentimentos, name: "consentimento" },
    { src: documentos, name: "documento" },
    { src: contatos, name: "contato" },
    { src: preferencias, name: "preferencia" },
    { src: optins, name: "optin" },
  ];

  // Extra silver models (not 1:1 with bronze) to hit the §3 counts.
  const extras: StrataTable[] = [
    table({
      project: "vendas",
      layer: "silver",
      kind: "model",
      name: "frete",
      managed: false,
      columns: [
        C("pedido_id", "bigint", { pk: true }),
        C("vl_frete", "decimal(18,2)"),
        C("uf", "string"),
      ],
    }),
    table({
      project: "vendas",
      layer: "silver",
      kind: "model",
      name: "comissao",
      managed: false,
      columns: [
        C("vendedor_id", "bigint", { pk: true }),
        C("pedido_id", "bigint", { pk: true }),
        C("vl_comissao", "decimal(18,2)"),
      ],
      compositePks: [["vendedor_id", "pedido_id"]],
    }),
    table({
      project: "estoque",
      layer: "silver",
      kind: "model",
      name: "posicao_estoque",
      managed: true,
      columns: [
        C("produto_id", "bigint", { pk: true }),
        C("deposito_id", "bigint", { pk: true }),
        C("quantidade", "decimal(18,3)", { notNull: true }),
      ],
      compositePks: [["produto_id", "deposito_id"]],
    }),
    table({
      project: "estoque",
      layer: "silver",
      kind: "model",
      name: "lead_time",
      managed: false,
      columns: [
        C("produto_id", "bigint", { pk: true }),
        C("fornecedor_id", "bigint", { pk: true }),
        C("dias", "int"),
      ],
      compositePks: [["produto_id", "fornecedor_id"]],
    }),
    table({
      project: "clientes",
      layer: "silver",
      kind: "model",
      name: "app_evento",
      managed: false,
      columns: [
        C("evento_id", "bigint", { pk: true }),
        C("cliente_id", "bigint", { notNull: true }),
        C("dt_evento", "timestamp"),
        C("nome_evento", "string"),
      ],
    }),
    table({
      project: "clientes",
      layer: "silver",
      kind: "model",
      name: "cliente_unico",
      managed: false,
      columns: [
        C("cliente_sk", "string", { pk: true }),
        C("cliente_id", "bigint", { notNull: true }),
        C("email", "string"),
      ],
    }),
    table({
      project: "clientes",
      layer: "silver",
      kind: "model",
      name: "lgpd_cliente",
      managed: false,
      columns: [
        C("cliente_id", "bigint", { pk: true }),
        C("finalidade", "string"),
        C("aceito", "boolean"),
      ],
    }),
  ];

  const silverBuilt = silverSpecs.map((s) =>
    staging(s.src, s.name, !MANUAL_MODELS.has(s.name), s.rename),
  );
  const silverTables = [...silverBuilt.map((s) => s.table), ...extras];
  const silverLineage: ParsedFieldLineage[] = silverBuilt.flatMap((s) => s.lineage);

  const pedido = silverTables.find((t) => t.id === "silver.pedido")!;
  const canal = silverTables.find((t) => t.id === "silver.canal")!;
  const loja = silverTables.find((t) => t.id === "silver.loja")!;
  const devolucao = silverTables.find((t) => t.id === "silver.devolucao")!;
  const movimentacao = silverTables.find((t) => t.id === "silver.movimentacao")!;
  const produto = silverTables.find((t) => t.id === "silver.produto")!;
  const deposito = silverTables.find((t) => t.id === "silver.deposito")!;
  const cliente = silverTables.find((t) => t.id === "silver.cliente")!;
  const posicaoEstoque = extras.find((t) => t.id === "silver.posicao_estoque")!;

  const goldBuilt = [
    goldModel(
      "vendas",
      "fct_vendas",
      [
        C("pedido_id", "bigint", { pk: true }),
        C("cliente_id", "bigint", { notNull: true }),
        C("canal_id", "bigint"),
        C("loja_id", "bigint"),
        C("receita_bruta", "decimal(18,2)", { notNull: true }),
        C("receita_liquida", "decimal(18,2)"),
        C("dt_emissao", "timestamp", { notNull: true }),
      ],
      [
        { col: "pedido_id", fromTable: pedido.id, fromCol: "pedido_id" },
        { col: "cliente_id", fromTable: pedido.id, fromCol: "cliente_id" },
        { col: "canal_id", fromTable: pedido.id, fromCol: "canal_id" },
        { col: "loja_id", fromTable: pedido.id, fromCol: "loja_id" },
        { col: "receita_bruta", fromTable: pedido.id, fromCol: "valor_bruto" },
        { col: "receita_liquida", fromTable: pedido.id, fromCol: "valor_desconto" },
        { col: "dt_emissao", fromTable: pedido.id, fromCol: "dt_emissao" },
      ],
      true,
    ),
    goldModel(
      "vendas",
      "dim_pedido",
      [
        C("pedido_id", "bigint", { pk: true }),
        C("status", "string", {
          enumName: "status_pedido",
          acceptedValues: [...STATUS_PEDIDO],
        }),
        C("dt_emissao", "timestamp"),
      ],
      [
        { col: "pedido_id", fromTable: pedido.id, fromCol: "pedido_id" },
        { col: "status", fromTable: pedido.id, fromCol: "status" },
        { col: "dt_emissao", fromTable: pedido.id, fromCol: "dt_emissao" },
      ],
      true,
    ),
    goldModel(
      "vendas",
      "dim_canal",
      [
        C("canal_id", "bigint", { pk: true }),
        C("codigo", "string"),
        C("nome", "string"),
      ],
      [
        { col: "canal_id", fromTable: canal.id, fromCol: "canal_id" },
        { col: "codigo", fromTable: canal.id, fromCol: "codigo" },
        { col: "nome", fromTable: canal.id, fromCol: "nome" },
      ],
      true,
    ),
    goldModel(
      "vendas",
      "dim_loja",
      [
        C("loja_id", "bigint", { pk: true }),
        C("nome", "string"),
        C("uf", "string"),
        C("cidade", "string"),
      ],
      [
        { col: "loja_id", fromTable: loja.id, fromCol: "loja_id" },
        { col: "nome", fromTable: loja.id, fromCol: "nome" },
        { col: "uf", fromTable: loja.id, fromCol: "uf" },
        { col: "cidade", fromTable: loja.id, fromCol: "cidade" },
      ],
      true,
    ),
    goldModel(
      "vendas",
      "agg_vendas_diarias",
      [
        C("dt_emissao", "date", { pk: true }),
        C("receita_bruta_dia", "decimal(18,2)", { notNull: true }),
        C("qtd_pedidos", "bigint"),
      ],
      [
        { col: "dt_emissao", fromTable: "gold.fct_vendas", fromCol: "dt_emissao" },
        { col: "receita_bruta_dia", fromTable: "gold.fct_vendas", fromCol: "receita_bruta" },
        { col: "qtd_pedidos", fromTable: "gold.fct_vendas", fromCol: "pedido_id" },
      ],
      true,
    ),
    goldModel(
      "vendas",
      "agg_vendas_canal",
      [
        C("canal_id", "bigint", { pk: true }),
        C("receita_bruta", "decimal(18,2)"),
      ],
      [],
      false,
    ),
    goldModel(
      "vendas",
      "fct_devolucao",
      [
        C("devolucao_id", "bigint", { pk: true }),
        C("pedido_id", "bigint", { notNull: true }),
        C("vl_estornado", "decimal(18,2)"),
        C("dt_devolucao", "timestamp"),
      ],
      [
        { col: "devolucao_id", fromTable: devolucao.id, fromCol: "devolucao_id" },
        { col: "pedido_id", fromTable: devolucao.id, fromCol: "pedido_id" },
        { col: "vl_estornado", fromTable: devolucao.id, fromCol: "vl_estornado" },
        { col: "dt_devolucao", fromTable: devolucao.id, fromCol: "dt_devolucao" },
      ],
      true,
    ),
    goldModel(
      "vendas",
      "dim_cupom",
      [
        C("cupom_id", "bigint", { pk: true }),
        C("codigo", "string"),
      ],
      [],
      false,
    ),
    goldModel(
      "estoque",
      "fct_estoque",
      [
        C("produto_id", "bigint", { pk: true }),
        C("deposito_id", "bigint", { pk: true }),
        C("quantidade", "decimal(18,3)", { notNull: true }),
        C("dt_movimento", "timestamp"),
      ],
      [
        { col: "produto_id", fromTable: movimentacao.id, fromCol: "produto_id" },
        { col: "deposito_id", fromTable: movimentacao.id, fromCol: "deposito_id" },
        { col: "quantidade", fromTable: movimentacao.id, fromCol: "quantidade" },
        { col: "dt_movimento", fromTable: movimentacao.id, fromCol: "dt_movimento" },
      ],
      true,
    ),
    goldModel(
      "estoque",
      "dim_produto",
      [
        C("produto_id", "bigint", { pk: true }),
        C("sku", "string"),
        C("nome", "string"),
        C("categoria", "string"),
      ],
      [
        { col: "produto_id", fromTable: produto.id, fromCol: "produto_id" },
        { col: "sku", fromTable: produto.id, fromCol: "sku" },
        { col: "nome", fromTable: produto.id, fromCol: "nome" },
        { col: "categoria", fromTable: produto.id, fromCol: "categoria" },
      ],
      true,
    ),
    goldModel(
      "estoque",
      "dim_deposito",
      [
        C("deposito_id", "bigint", { pk: true }),
        C("nome", "string"),
        C("uf", "string"),
      ],
      [
        { col: "deposito_id", fromTable: deposito.id, fromCol: "deposito_id" },
        { col: "nome", fromTable: deposito.id, fromCol: "nome" },
        { col: "uf", fromTable: deposito.id, fromCol: "uf" },
      ],
      true,
    ),
    goldModel(
      "estoque",
      "fct_giro_produto",
      [
        C("produto_id", "bigint", { pk: true }),
        C("qtd_movimentada", "decimal(18,3)"),
        C("receita_vendas", "decimal(18,2)"),
        C("giro", "decimal(18,4)"),
      ],
      [
        { col: "produto_id", fromTable: "gold.fct_estoque", fromCol: "produto_id" },
        { col: "qtd_movimentada", fromTable: "gold.fct_estoque", fromCol: "quantidade" },
        { col: "receita_vendas", fromTable: "gold.fct_vendas", fromCol: "receita_bruta" },
        { col: "giro", fromTable: "gold.fct_estoque", fromCol: "quantidade" },
      ],
      true,
    ),
    goldModel(
      "estoque",
      "agg_estoque_diario",
      [
        C("dt_movimento", "date", { pk: true }),
        C("quantidade", "decimal(18,3)"),
      ],
      [],
      false,
    ),
    goldModel(
      "estoque",
      "fct_inventario",
      [
        C("inventario_id", "bigint", { pk: true }),
        C("deposito_id", "bigint"),
        C("dt_contagem", "date"),
      ],
      [],
      false,
    ),
    goldModel(
      "clientes",
      "dim_cliente",
      [
        C("cliente_id", "bigint", { pk: true }),
        C("nome", "string"),
        C("email", "string"),
        C("status", "string"),
      ],
      [
        { col: "cliente_id", fromTable: cliente.id, fromCol: "cliente_id" },
        { col: "nome", fromTable: cliente.id, fromCol: "nome" },
        { col: "email", fromTable: cliente.id, fromCol: "email" },
        { col: "status", fromTable: cliente.id, fromCol: "status" },
      ],
      true,
    ),
    goldModel(
      "clientes",
      "dim_cliente_360",
      [
        C("cliente_id", "bigint", { pk: true }),
        C("nome", "string"),
        C("email", "string"),
        C("receita_total", "decimal(18,2)"),
        C("status", "string"),
      ],
      [
        { col: "cliente_id", fromTable: "gold.dim_cliente", fromCol: "cliente_id" },
        { col: "nome", fromTable: "gold.dim_cliente", fromCol: "nome" },
        { col: "email", fromTable: "gold.dim_cliente", fromCol: "email" },
        { col: "receita_total", fromTable: "gold.fct_vendas", fromCol: "receita_bruta" },
        { col: "status", fromTable: "gold.dim_cliente", fromCol: "status" },
      ],
      true,
    ),
    goldModel(
      "clientes",
      "fct_consentimento",
      [
        C("consentimento_id", "bigint", { pk: true }),
        C("cliente_id", "bigint", { notNull: true }),
        C("finalidade", "string"),
        C("aceito", "boolean"),
      ],
      [
        { col: "consentimento_id", fromTable: "silver.consentimento", fromCol: "consentimento_id" },
        { col: "cliente_id", fromTable: "silver.consentimento", fromCol: "cliente_id" },
        { col: "finalidade", fromTable: "silver.consentimento", fromCol: "finalidade" },
        { col: "aceito", fromTable: "silver.consentimento", fromCol: "aceito" },
      ],
      true,
    ),
    goldModel(
      "clientes",
      "agg_clientes_ativos",
      [
        C("status", "string", { pk: true }),
        C("qtd", "bigint"),
      ],
      [],
      false,
    ),
    goldModel(
      "clientes",
      "dim_endereco",
      [
        C("endereco_id", "bigint", { pk: true }),
        C("cliente_id", "bigint"),
        C("cidade", "string"),
        C("uf", "string"),
      ],
      [],
      false,
    ),
    goldModel(
      "clientes",
      "fct_app_evento",
      [
        C("evento_id", "bigint", { pk: true }),
        C("cliente_id", "bigint"),
        C("nome_evento", "string"),
      ],
      [],
      false,
    ),
  ];

  // composite PK on fct_estoque
  const fctEstoque = goldBuilt.find((g) => g.table.name === "fct_estoque")!;
  fctEstoque.table.compositePks = [["produto_id", "deposito_id"]];
  fctEstoque.table.columns = fctEstoque.table.columns.map((c) =>
    c.name === "produto_id" || c.name === "deposito_id" ? { ...c, pk: true, notNull: true } : c,
  );

  const posicaoLineage: ParsedFieldLineage[] = posicaoEstoque.columns.map((c) => ({
    targetTable: posicaoEstoque.id,
    targetColumn: c.name,
    sourceTable: movimentacao.id,
    sourceColumn: c.name === "quantidade" ? "quantidade" : c.name,
  }));

  const goldTables = goldBuilt.map((g) => g.table);
  const goldLineage = goldBuilt.flatMap((g) => g.lineage);

  const tables = [...bronzeTables, ...silverTables, ...goldTables];
  applyDocs(tables);

  const refs: StrataRef[] = [
    fk("bronze.itens_pedido", "pedido_id", "bronze.pedidos", "pedido_id"),
    fk("bronze.itens_pedido", "produto_id", "bronze.produtos_venda", "produto_id"),
    fk("bronze.pagamentos", "pedido_id", "bronze.pedidos", "pedido_id"),
    fk("bronze.devolucoes", "pedido_id", "bronze.pedidos", "pedido_id"),
    fk("bronze.pedidos", "cliente_id", "bronze.clientes_venda", "cliente_id"),
    fk("bronze.pedidos", "canal_id", "bronze.canais", "canal_id"),
    fk("bronze.pedidos", "loja_id", "bronze.lojas", "loja_id"),
    fk("bronze.pedidos", "vendedor_id", "bronze.vendedores", "vendedor_id"),
    fk("bronze.pedidos", "cupom_id", "bronze.cupons", "cupom_id"),
    fk("bronze.notas_fiscais", "pedido_id", "bronze.pedidos", "pedido_id"),
    fk("bronze.vendedores", "loja_id", "bronze.lojas", "loja_id"),
    fk("bronze.movimentacoes", "produto_id", "bronze.produtos", "produto_id"),
    fk("bronze.movimentacoes", "deposito_id", "bronze.depositos", "deposito_id"),
    fk("bronze.inventario", "deposito_id", "bronze.depositos", "deposito_id"),
    fk("bronze.lotes", "produto_id", "bronze.produtos", "produto_id"),
    fk("bronze.perdas", "produto_id", "bronze.produtos", "produto_id"),
    fk("bronze.compras", "fornecedor_id", "bronze.fornecedores", "fornecedor_id"),
    fk("bronze.compras", "produto_id", "bronze.produtos", "produto_id"),
    fk("bronze.enderecos", "cliente_id", "bronze.cadastro", "cliente_id"),
    fk("bronze.consentimentos", "cliente_id", "bronze.cadastro", "cliente_id"),
    fk("bronze.app_eventos", "cliente_id", "bronze.cadastro", "cliente_id"),
    fk("bronze.documentos", "cliente_id", "bronze.cadastro", "cliente_id"),
    fk("bronze.contatos", "cliente_id", "bronze.cadastro", "cliente_id"),
    fk("bronze.preferencias", "cliente_id", "bronze.cadastro", "cliente_id"),
    fk("bronze.optins", "cliente_id", "bronze.cadastro", "cliente_id"),
    fk("silver.item_pedido", "pedido_id", "silver.pedido", "pedido_id"),
    fk("gold.fct_vendas", "canal_id", "gold.dim_canal", "canal_id"),
    fk("gold.fct_vendas", "loja_id", "gold.dim_loja", "loja_id"),
    fk("gold.fct_vendas", "pedido_id", "gold.dim_pedido", "pedido_id"),
    fk("gold.fct_estoque", "produto_id", "gold.dim_produto", "produto_id"),
    fk("gold.fct_estoque", "deposito_id", "gold.dim_deposito", "deposito_id"),
    fk("gold.fct_giro_produto", "produto_id", "gold.dim_produto", "produto_id"),
    fk("gold.dim_cliente_360", "cliente_id", "gold.dim_cliente", "cliente_id"),
  ];

  const lineage = [...silverLineage, ...posicaoLineage, ...goldLineage];

  const records: ParsedRecords[] = [
    {
      table: "bronze.canais",
      columns: ["canal_id", "nome", "descricao"],
      rows: [
        ["1", "loja", "Loja física, shopping"],
        ["2", "e_commerce", "São Paulo, digital"],
        ["3", "marketplace", "Marketplace, parceiros"],
      ],
      raw: "",
    },
    {
      table: "bronze.unidades_medida",
      columns: ["unidade_id", "sigla", "nome"],
      rows: [
        ["1", "un", "Unidade"],
        ["2", "kg", "Quilograma, peso"],
        ["3", "cx", "Caixa, 12 un"],
      ],
      raw: "",
    },
  ];

  const enums: StrataEnum[] = [
    { name: "status_pedido", values: [...STATUS_PEDIDO] },
    { name: "canal_venda", values: [...CANAL_VENDA] },
    { name: "tipo_movimentacao", values: [...TIPO_MOV] },
  ];

  const colors: Record<string, string> = {};
  for (const t of tables) colors[t.id] = PROJECT_COLOR[t.project as Projeto];

  const pins = [
    "bronze.app_eventos.evento_id",
    "bronze.app_eventos.cliente_id",
    "bronze.app_eventos.dt_evento",
    "bronze.app_eventos.nome_evento",
    "bronze.pedidos.pedido_id",
  ];

  function view(
    id: string,
    tableIds: string[],
    allPos: Record<string, { x: number; y: number }>,
  ): SchemaView {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const tid of tableIds) {
      if (allPos[tid]) positions[tid] = allPos[tid];
    }
    return { id, name: id, tables: tableIds, positions };
  }

  const canvasByProject = {} as Record<Projeto, NonNullable<StrataModel["canvas"]>>;
  const views: SchemaView[] = [];
  for (const projeto of PROJECTS) {
    const local = tables.filter((t) => t.project === projeto);
    const pos = positionsFor(local);
    canvasByProject[projeto] = { positions: pos, collapsedGroups: [] };
    if (projeto === "vendas") {
      views.push(
        view("vendas_executivo", [
          "gold.fct_vendas",
          "gold.agg_vendas_diarias",
          "gold.dim_canal",
          "gold.dim_loja",
        ], pos),
        view("linhagem_receita", [
          "bronze.pedidos",
          "silver.pedido",
          "gold.fct_vendas",
          "gold.agg_vendas_diarias",
        ], pos),
      );
    }
    if (projeto === "estoque") {
      views.push(
        view("estoque_operacao", [
          "gold.fct_estoque",
          "gold.dim_produto",
          "gold.dim_deposito",
          "gold.fct_giro_produto",
        ], pos),
      );
    }
    if (projeto === "clientes") {
      views.push(
        view("clientes_lgpd", [
          "silver.lgpd_cliente",
          "gold.dim_cliente",
          "gold.dim_cliente_360",
          "bronze.consentimentos",
        ], pos),
      );
    }
  }

  return {
    tables,
    refs,
    lineage,
    records,
    enums,
    views,
    colors,
    pins,
    canvasByProject,
  };
}

let CACHED: VarejoDomain | undefined;
export function varejoDomain(): VarejoDomain {
  if (!CACHED) CACHED = buildDomain();
  return CACHED;
}

export function domainTables(): StrataTable[] {
  return varejoDomain().tables;
}

export function allLineageFields(): ParsedFieldLineage[] {
  return varejoDomain().lineage;
}

function layerGroupsFor(tables: StrataTable[]): StrataModel["layerGroups"] {
  const members = new Map<string, string[]>();
  for (const t of tables) {
    if (!t.layer) continue;
    const list = members.get(t.layer) ?? [];
    list.push(t.id);
    members.set(t.layer, list);
  }
  return [...members.entries()].map(([name, ids]) => ({
    id: name.toLowerCase(),
    name,
    tables: ids,
  }));
}

function enumsUsed(tables: StrataTable[], enums: StrataEnum[]): StrataEnum[] {
  const names = new Set(
    tables.flatMap((t) => t.columns.map((c) => c.enumName).filter((n): n is string => !!n)),
  );
  return enums.filter((e) => names.has(e.name));
}

export function strataModelFor(projeto: Projeto): StrataModel {
  const d = varejoDomain();
  const local = d.tables.filter((t) => t.project === projeto);
  const localIds = new Set(local.map((t) => t.id));
  const lineage = d.lineage.filter((l) => localIds.has(l.targetTable));
  const refs = d.refs.filter((r) => localIds.has(r.source));
  const externalIds = new Set<string>();
  for (const l of lineage) {
    if (!localIds.has(l.sourceTable)) externalIds.add(l.sourceTable);
  }
  for (const r of refs) {
    if (!localIds.has(r.target)) externalIds.add(r.target);
  }
  const externals = d.tables.filter((t) => externalIds.has(t.id)).map(asExternal);
  const tables = [...local, ...externals];
  return {
    project: projeto,
    tables,
    refs,
    records: d.records.filter((r) => localIds.has(r.table)),
    layerGroups: layerGroupsFor(local),
    lineageFields: lineage,
    rolenames: [],
    colors: Object.fromEntries(Object.entries(d.colors).filter(([k]) => localIds.has(k))),
    pins: d.pins.filter((p) => {
      const last = p.lastIndexOf(".");
      return last > 0 && localIds.has(p.slice(0, last));
    }),
    views: d.views
      .map((v) => ({
        ...v,
        tables: v.tables.filter((id) => localIds.has(id)),
        positions: v.positions
          ? Object.fromEntries(Object.entries(v.positions).filter(([id]) => localIds.has(id)))
          : undefined,
      }))
      .filter((v) => v.tables.length),
    enums: enumsUsed(local, d.enums),
    canvas: d.canvasByProject[projeto],
  };
}
