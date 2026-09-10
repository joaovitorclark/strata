# AGENTS.md — Strata

> Orientation for AI agents and humans working in this repository.
> **Status: bootstrapping.** This repo currently holds *context and vision docs only* — no application code has been migrated yet, and these are **not implementation specs**. Read them before proposing any work.

## What Strata is

**Strata** is the next generation of [**LocalDrawDB**](https://github.com/joaovitorclark/localdrawdb) — a **local-first database & data-lakehouse schema modeler**. The working application lives (for now) in the `localdrawdb` repo; this repo is where Strata is being (re)born with:

- a **new visual identity** (Catppuccin theme, dark-first);
- a **new UX paradigm** that deliberately breaks away from the dbdiagram.io "code-left / diagram-right" look;
- **DBT as the priority functional format** (instead of today's SQL-with-commented-tags);
- **git-based project management kept and improved** (the one area where LocalDrawDB is already ahead of Structura);
- an **architecture engineered to later plug into the [Structura](https://github.com/clarkjoao/Structura) platform** with minimal friction.

The full app that must be transformed is preserved on the backup branch `cursor/backup-localdrawdb-6af2` in the `localdrawdb` repo.

## The two north-star documents

Read both before doing anything substantial. They are context, meant to be turned into specs later.

1. **[`docs/strata-transition.md`](docs/strata-transition.md)** — how **LocalDrawDB becomes Strata**: identity, visual language, UX/layout, DBT-first behavior, git project management, and stack-alignment targets.
2. **[`docs/convergence-and-platform-vision.md`](docs/convergence-and-platform-vision.md)** — the **future fusion with Structura** and the broader **plural-platform** vision: shared engine, interop contracts, import pathways, deployment model, and governance.

## Non-negotiable north stars

Keep every decision consistent with these:

1. **DBT-first.** The primary, functional import/export target is a real **dbt** project (models `.sql` + `schema.yml` + `dbt_project.yml`, metadata under `meta`). Legacy SQL-with-tags is secondary/compat only.
2. **Git-native project management is a differentiator — keep it and improve it.** Do not regress it. It should eventually become a platform-level capability.
3. **Local-first now, SaaS later.** Both Strata and Structura must run fully locally today; a paid online service comes later. Never design in a way that *requires* a server for core editing.
4. **Mirror Structura's interop contracts, don't fork them.** Match its engine and public contracts so Strata can be imported into Structura later (see doc 2).
5. **Visual identity = Catppuccin, dark-first.** Macchiato for dark, Latte for light. Mauve is the primary accent. Pixel/color polish is handled in a **dedicated UX effort** — do not treat the exploratory mockups in `docs/assets/` as final.
6. **Break from dbdiagram.io.** Canvas-first; the DBML source editor lives in an on-demand slide-up drawer, not a permanent split pane.

## Relationship to Structura

Structura (owned by a sibling maintainer, `clarkjoao/Structura`) is the **host platform** Strata will join. Strata is the **first external domain** to be absorbed; more domains are planned (e.g. a container control plane, an orchestrator). Treat Structura's public contracts (node descriptor registry, `IStoragePort`, Plugin API `1.2.0`, discriminated-union component model, io importer/exporter contracts) as the integration surface to align to.

## How to use these docs

- Treat them as **durable context**, not a task list.
- When work is greenlit, derive **specs** from them (a `docs/specs/` or `docs/superpowers/specs/` folder), then plans.
- If a decision here becomes stale, update the doc in the same PR that changes the code.
