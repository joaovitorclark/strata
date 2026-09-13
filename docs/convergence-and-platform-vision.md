# Convergence & Platform Vision — Strata × Structura, and beyond

> **Context document, not a spec.** It describes the long-term vision (a plural diagramming/modeling platform) and the concrete **interop contracts** Strata must mirror so it can later be imported into [Structura](https://github.com/clarkjoao/Structura). Near-term product changes for Strata itself live in [`strata-transition.md`](strata-transition.md).

## 1. The vision — a plural platform

The end state is **one platform that hosts many modeling/diagramming domains**:

- **Structura is the host platform.** It already has the architecture for this: a node **descriptor registry**, a **plugin system**, a **storage-port** abstraction, i18n, collaboration, and an LLM assistant.
- **Strata is the first external domain to be absorbed** (database / lakehouse schema modeling, DBT-first).
- **More domains will follow** — e.g. a **container control plane**, an **orchestrator** view, and others. Think of Structura as a *pluralistic canvas platform* where each domain is a module/plugin sharing one engine.

Strategic consequence: **do not build Strata as a throwaway silo.** Build it so its domain (nodes, panels, importers/exporters, storage) can be *lifted* into Structura, and so the patterns it establishes (especially **git-native project management**) can generalize to the whole platform.

## 2. Guiding principle — mirror now, merge later

For now the two repos stay **independent** (faster iteration). But Strata mirrors Structura's public contracts from day one, so importing later is a matter of **registering modules**, not rewriting them.

> **Mirror, don't fork.** Match the engine and the contracts. Diverge only where Strata genuinely needs more (rich DB metadata, dbt, git projects) — and do that *additively*.

## 3. The shared engine (already common)

Both apps are built on essentially the same core:

| Concern | Technology (shared target) |
| --- | --- |
| UI framework | React 18 |
| Language | TypeScript |
| Build | Vite |
| State | Zustand (+ Immer, sliced) |
| Canvas | `@xyflow/react` (React Flow v12) |
| Styling | Tailwind CSS + shadcn/ui (CSS-variable tokens) |
| Tests | Vitest |

Aligning Strata to these (see transition doc §8) removes most of the friction before we even talk about contracts.

## 4. Interop contracts to mirror

These are Structura's public integration surfaces. Strata should conform to them.

### 4.1 Node descriptor registry
Structura renders diagram components through a **`NodeTypeDescriptor`** registry (`resolveNodeDescriptor(comp) → descriptor.buildData(...) → React Flow node`). Descriptor fields include `rfType`, `component`, `matches(type)`, `zIndex`, `connectable`, `canHaveParent`, `canBeParent`, `buildData(comp, ctx)`, `buildStyle(comp, ctx)`, `defaultSize`, `defaultData`. New node types are added by implementing a descriptor and registering it before the catch-all.
- **Strata action:** author table / relationship / lineage / layer-group nodes as descriptors with this exact shape, so they can be registered into Structura's registry.

### 4.2 Component model (discriminated union + type guards)
Structura stores components as a discriminated union with a `type` discriminator and type guards. **It already ships a `db-table` type**:

```ts
interface DbColumn {
  id: string; name: string; dataType: string;
  isPrimaryKey?: boolean; isForeignKey?: boolean;
  foreignTableId?: string; nullable?: boolean; unique?: boolean;
}
interface DbTableComponent extends BaseComponent {
  type: "db-table"; tableName: string; columns: DbColumn[];
  collapsed?: boolean; /* ... */
}
```

Plugin/domain types are namespaced `"<pluginId>/<name>"` (no built-in type contains `/`, which keeps the union discriminable); components of an absent plugin degrade gracefully and preserve their opaque `pluginData`.
- **Strata action:** align tables to `DbTableComponent`/`DbColumn`; express Strata-only concepts (lineage, medallion layer groups, dbt metadata) either as **additive fields** or as **`strata/…` namespaced types**. Keep type guards.

### 4.3 Storage port
Persistence sits behind **`IStoragePort`** (`save`/`load`/`getItem`/`setItem`/`removeItem`/`delete`/`keys`/`length`) with swappable adapters (LocalStorage, InMemory, and a browser **FileSystem** adapter already exist in Structura).
- **Strata action:** wrap today's **Fastify + filesystem + git** persistence as an **`IStoragePort` adapter** (e.g. an HTTP/local adapter). Core editing must stay adapter-agnostic. This is what keeps Strata local-first *and* drop-in for Structura, and later enables server/SaaS adapters.

### 4.4 Plugin API (v1.2.0)
Structura exposes a versioned plugin API (`STRUCTURA_PLUGIN_API_VERSION = "1.2.0"`) with capabilities:
`canvas:node-types`, `io:importers`, `io:exporters`, `ui:panels`, `ui:overlays`, `events:diagram`, `diagram:read`, `diagram:write`, `storage`, `network`.
It offers `registerNodeType`, `registerImporter`, `registerExporter`, `registerPanel`, `onDiagramChange`, diagram read/patch helpers, plugin-scoped `storage`, and `overlay` (toast/modal). Plugin node types **must** be namespaced `"<pluginId>/<name>"`.
- **Known limitation:** the current plugin API hands plugins a *lean* `PluginComponentSnapshot` (id, type, label, description, parentId, position, size, tags, serviceId) and lean importer inputs — it does **not** surface rich domain data (columns, refs, lineage, dbt metadata). A pure sandboxed plugin cannot yet carry Strata's full model.
- **Strata action:** design importers/exporters/panels to these contracts anyway; and treat **co-evolving the plugin API** (e.g. exposing `pluginData` in snapshots/inputs) as a coordination item with the Structura maintainer.

### 4.5 Import/export contributions
Importers/exporters follow `ImporterContribution` / `ExporterContribution` (id, label, extensions, `import(contents, ctx)` / `export(diagram)`), registered via an io-registry.
- **Strata action:** implement **DBML** and **dbt** as importer/exporter contributions in this shape.

## 5. The two import pathways (keep both open, target native)

1. **Plugin drop-in** — package Strata's domain as a Structura plugin (`strata/table`, `strata/relationship`, dbt/DBML io, inspector panels). Lowest friction, no fork. **Blocked on** richer plugin data (see §4.4) for full fidelity → needs API co-evolution.
2. **Native feature in core** — contribute Strata's modeling as a first-class Structura feature, **extending the existing `db-table`** and adding relationship/lineage/dbt. Richest integration; requires a PR and coordination.

**Recommendation:** mirror the **core contracts now** (serves both), and **target the native-feature path** as the eventual merge, falling back to/also enabling the plugin path.

## 6. Git-native project management as a platform capability

Strata brings something Structura lacks: **git-backed project management** (versioned domains/projects, branch/commit/push/PR, data isolation). The vision is to **promote this to a platform-level capability** so *every* future domain (schema, container control plane, orchestrator, …) gets versioned, collaboratable projects out of the box. Design it cleanly enough in Strata that it can be generalized, not hard-wired to database modeling.

## 7. Deployment model — local-first now, SaaS later

- **Now:** both Strata and Structura run **fully locally**. Core editing must never *require* a server.
- **Later:** a **paid online service**. The pieces are already converging: Structura has real-time collaboration (WebRTC + Yjs); the storage-port abstraction makes server/multi-tenant adapters possible; git-native projects give a natural sync/versioning story. SaaS is a future layer on top of the same engine, not a rewrite.

## 8. Governance — preventing drift

Because the two repos evolve independently (and under sibling maintainers), guard the interop surface:

- **Pin shared dependency versions** to match Structura (React, Vite, Zustand, Immer, `@xyflow/react`, Tailwind, shadcn).
- **Vendor Structura's shadcn setup** (`components.json` + `components/ui`) so UI primitives stay identical (Catppuccin values layer on top).
- Keep a **`CONTRACTS.md`** in Strata pinning the targeted contract versions (descriptor shape, `IStoragePort`, Plugin API `1.2.0`, component-model expectations) and diff against Structura periodically.
- **Adopt Structura's conventions** (its `AGENTS.md` hard rules, `features/` layout, "no React in the domain") as Strata's own.

## 9. High-level roadmap (phases, not specs)

1. **Phase 0 — Rename & stack.** LocalDrawDB → Strata; Tailwind + shadcn + tokens; `reactflow` v11 → `@xyflow/react` v12; align tsconfig/eslint/prettier/path alias/Vitest.
2. **Phase 1 — `features/` + React-free domain.** Extract the schema model (tables, columns, refs, lineage, groups) as a domain core; Zustand+Immer slices.
3. **Phase 2 — Descriptor & model alignment.** Re-author nodes as `NodeTypeDescriptor`s; align to `DbTableComponent`/`DbColumn` (+ additive Strata fields / `strata/…` types).
4. **Phase 3 — Storage port.** Put Fastify+filesystem+git behind `IStoragePort`; keep local-first, prep server adapters.
5. **Phase 4 — dbt IO.** DBML + dbt importer/exporter contributions; make dbt the primary format.
6. **Phase 5 — Packageable module/plugin.** Single registration entry point (nodes + panels + io + storage).
7. **Phase 6 — Convergence.** Import into Structura via the chosen pathway (native feature and/or plugin), co-evolving the plugin API as needed.

## 10. Open questions for the Structura maintainer

- Extend the plugin API to carry **rich domain data** (`pluginData` in snapshots/inputs)?
- **Extend the built-in `db-table`** vs. keep Strata modeling as **`strata/…` namespaced** types?
- When (if ever) to extract a **shared engine package / monorepo** (the path from two apps to a common core)?
- Target **SaaS architecture** (auth, multi-tenant storage adapter, collaboration scaling).
- Should **git-native project management** be promoted into Structura core as a shared capability?
