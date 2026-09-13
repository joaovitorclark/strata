# Strata Migration — Foundation (Stages 0–3) Implementation Plan

> **For agentic workers (Cursor / Grok / Composer):** Tasks are grouped into **waves**. Every task in
> a wave is independent of its siblings and may be run by a separate agent in parallel. A wave does
> not start until every task in the previous wave is green. Steps use checkbox (`- [ ]`) syntax for
> tracking. Read `## Global Constraints` before every task — they apply to all of them.

**Goal:** Stand up the Strata repository on the new stack and move LocalDrawDB's 11,001-line server
and 4,296-line domain core into it verbatim, with all 54 of their test files green.

**Architecture:** Port order is chosen so the existing test suite is green from the first commit.
The React-free layers (`server/`, `src/dsl/`) move first and unchanged, because they carry the tests
that make every later stage safe. The React layer is not touched in this plan.

**Tech Stack:** Vite 8, React 18, TypeScript 6 (strict), Tailwind 3.4 + shadcn/ui, Zustand 5 +
Immer 11, Vitest 4, Fastify 4, Prettier 3.9.6.

**Spec:** [`docs/superpowers/specs/2026-09-10-strata-migration-design.md`](../specs/2026-09-10-strata-migration-design.md)

---

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include this section.

**Paths.** `$STRATA` = this repository's root. `$LDB` = the frozen LocalDrawDB checkout, normally
`../localdrawdb`. LocalDrawDB is **frozen** — never write to it. Read only.

**Verbatim means verbatim.** When a task says *port verbatim*, the only permitted edits are:
(1) import path rewrites to the `@/` alias and the new layout, (2) type errors caused solely by the
TypeScript 5.6 → 6 bump, (3) Prettier formatting. You may **not** rename identifiers, extract
functions, split files, reorder code, delete "dead" code, add or remove comments, or change error
messages. If ported code looks wrong, **leave it exactly as it is** and write the concern in your
task report.

**Never adapt an assertion.** If a ported test is red, the port is wrong — not the test. Adapting a
test assertion to make it pass is a failed task. Adapting a test *harness* call for the Vitest 2 → 4
API is allowed and must be called out in the report.

**No React under `model/`.** `import ... from "react"` anywhere in `src/features/*/model/` is a
failed task.

**Never hand-edit `src/components/ui/`.** Those are shadcn-generated. Wrap them instead.

**TypeScript strict stays green.** `npm run typecheck` is a gate, not a suggestion.

**Prettier `printWidth: 100`,** enforced by `npm run format:check`.

**i18n locales are `en` and `pt-BR`, and `pt-BR` is the fallback** — not `en`.

**Theme names are `dark` and `light`.** The strings "Macchiato" and "Latte" must never appear in
`src/`. Verify with `grep -ri "macchiato\|latte" src/` returning nothing.

**Do not invent a colour.** Every colour comes from `design-system/globals.css`. If you need one
that does not exist, stop and report.

**Pinned versions.** Exactly these — do not let a package manager float them upward:

```
react@^18.3.1  react-dom@^18.3.1  @xyflow/react@^12.10.1  zustand@^5.0.11  immer@^11.1.16
tailwindcss@^3.4.19  tailwindcss-animate@^1.0.7  autoprefixer@^10.5.4  postcss@^8.5.26
vite@^8.2.1  @vitejs/plugin-react@^6.0.5  typescript@^6.0.3  vitest@^4.1.1  prettier@3.9.6
eslint@^10.8.1  lucide-react@^1.28.0  i18next@^25.10.0  react-i18next@^16.6.0
clsx@^2.1.1  tailwind-merge@^2.6.0  class-variance-authority@^0.7.1
jsdom@^29.1.1  @testing-library/react@^16.0.0
@types/react@^18.3.23  @types/react-dom@^18.3.7  @types/node@^26.2.0
```

**Out of scope — stop and report if a task pulls you here:** dbt as primary format, `IStoragePort`,
indexes as a column marker, TableGroups, the git diff drawer tab, Cypress.

---

## File Structure

| Path | Responsibility | Created by |
| --- | --- | --- |
| `package.json`, `vite.config.ts`, `tsconfig*.json` | build + type gates | Task 1 |
| `fixtures/golden/` | 9 exporter outputs captured from LocalDrawDB — parity evidence | Task 2 |
| `docs/parity-inventory.md` | the parity contract Stage 5 is gated on | Task 3 |
| `src/test/setup.ts`, `vitest.config.ts` | test harness | Task 4 |
| `src/index.css`, `tailwind.config.ts`, `components.json`, `src/lib/utils.ts`, `src/components/ui/` | design system | Task 5 |
| `src/i18n/` | locales, `pt-BR` fallback | Task 6 |
| `server/` | Fastify + filesystem + git, verbatim | Task 7 |
| `src/features/schema/model/` | DBML domain core, verbatim, React-free | Task 8 |
| `src/infrastructure/api/` | the single seam `IStoragePort` replaces later | Task 9 |
| `src/features/schema/store/` | Zustand + Immer slices | Task 10 |

---

## Wave A — independent, 3 agents in parallel

Task 1 gates Wave B. Tasks 2 and 3 write only to `fixtures/` and `docs/` and gate nothing in this
plan — but Task 3 gates **Plan 2**, so it must not be skipped.

---

### Task 1: Repository scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`,
  `tsconfig.server.json`, `.prettierrc.json`, `eslint.config.js`, `index.html`,
  `src/main.tsx`, `src/App.tsx`, `.gitignore`

**Interfaces:**
- Produces: the `@/` alias resolving to `src/`; npm scripts `dev`, `typecheck`, `lint`, `format`,
  `format:check`, `test`, `build`. Every later task depends on these script names.

- [ ] **Step 1: Initialise the package**

```bash
cd $STRATA
npm init -y
npm pkg set name="strata" private=true type="module" version="0.1.0"
npm pkg set engines.node=">=20.0.0"
```

- [ ] **Step 2: Install pinned dependencies**

```bash
npm i react@18.3.1 react-dom@18.3.1
npm i -D vite@8.2.1 @vitejs/plugin-react@6.0.5 typescript@6.0.3 \
  @types/react@18.3.23 @types/react-dom@18.3.7 @types/node@26.2.0 \
  prettier@3.9.6 eslint@10.8.1
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  server: { port: 8080 },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 4: Write `tsconfig.json` (app)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Write `tsconfig.node.json` and `tsconfig.server.json`**

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "noEmit": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

`tsconfig.server.json` — the server runs under `tsx`, not the bundler:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["server"]
}
```

- [ ] **Step 6: Write `.prettierrc.json`, `eslint.config.js` and `.gitignore`**

`.prettierrc.json`:

```json
{ "printWidth": 100, "semi": true, "singleQuote": false, "trailingComma": "all" }
```

`eslint.config.js`:

```js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "fixtures"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
);
```

Its plugins:

```bash
npm i -D @eslint/js globals typescript-eslint eslint-plugin-react-hooks
```

`.gitignore`:

```
node_modules
dist
.DS_Store
*.local
data/
```

`data/` is ignored because the server writes user projects there and that directory keeps its own
git repository — see `server/paths.ts` and the `gitDataDirIsolation` test guarded in Task 7.

- [ ] **Step 7: Add npm scripts**

```bash
npm pkg set scripts.dev="vite"
npm pkg set scripts.typecheck="tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.server.json --noEmit"
npm pkg set scripts.lint="eslint ."
npm pkg set scripts.format="prettier --write ."
npm pkg set scripts."format:check"="prettier --check ."
npm pkg set scripts.build="npm run typecheck && vite build"
```

Note: `tsconfig.server.json` is included in `typecheck` from the start so Task 7's gate has
something to run. Until Task 7 lands, `server/` does not exist and `tsc` will report no inputs —
that is expected and not a failure.

- [ ] **Step 8: Write the minimal app entry**

`index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Strata</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`:

```tsx
export default function App() {
  return <div>Strata</div>;
}
```

- [ ] **Step 9: Verify the gate**

Run: `npm run build`
Expected: PASS — typecheck clean, `dist/` produced.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Strata on Vite 8 + React 18 + TypeScript 6"
```

---

### Task 2: Capture golden exporter fixtures

Runs against the **frozen** LocalDrawDB. This is parity evidence that cannot be recreated later if
LocalDrawDB is archived. Read-only with respect to `$LDB`.

**Files:**
- Create: `fixtures/golden/sample.dbml`, `fixtures/golden/<format>.<ext>` × 9,
  `fixtures/golden/README.md`

**Interfaces:**
- Produces: `fixtures/golden/` — consumed by Plan 2's Stage 6 parity gate.

- [ ] **Step 1: Identify the source schema**

Use LocalDrawDB's built-in sample. Copy the `SAMPLE` template literal from `$LDB/src/App.tsx`
(search for `const SAMPLE =`) into `$STRATA/fixtures/golden/sample.dbml` exactly as written,
including the `TableGroup`, `LayerGroup`, `Ref` and `Lineage` blocks.

- [ ] **Step 2: Start LocalDrawDB**

```bash
cd $LDB && npm install && npm run dev:server
```

- [ ] **Step 3: Export each of the nine formats**

The endpoint is `POST /api/export` on port **5174** (`server/index.ts:12`), body
`{ dbml, format, dialect? }`, defined in `server/routes/exportRoutes.ts:18`.

**Important:** the response is `{ "files": ["<path>", ...] }` — the server **writes the export to
disk and returns the paths**. The response body is not the export content. Copy the files it names.

```bash
cd $STRATA/fixtures/golden
DBML=$(python3 -c 'import json,sys; print(json.dumps(open("sample.dbml").read()))')

# Eight formats take no dialect.
for FMT in dbt erwin llm-context mermaid oracle-ddl postgres-ddl spark-ddl xlsx; do
  echo "== $FMT"
  curl -sS -X POST http://127.0.0.1:5174/api/export \
    -H 'Content-Type: application/json' \
    -d "{\"dbml\":$DBML,\"format\":\"$FMT\"}" \
    -o "response-$FMT.json"
  cat "response-$FMT.json"
done

# `localdrawdb` additionally takes a dialect — capture the spark variant.
curl -sS -X POST http://127.0.0.1:5174/api/export \
  -H 'Content-Type: application/json' \
  -d "{\"dbml\":$DBML,\"format\":\"localdrawdb\",\"dialect\":\"spark\"}" \
  -o response-localdrawdb.json
cat response-localdrawdb.json
```

- [ ] **Step 3b: Copy the produced files into the fixture directory**

For each `response-<FMT>.json`, read its `files` array and copy every path it names into
`fixtures/golden/<FMT>/`, preserving relative structure (`dbt` is a directory tree of
`models/**/*.sql` plus `schema.yml` and `dbt_project.yml`; `xlsx` is a single binary file).

```bash
cd $STRATA/fixtures/golden
for FMT in dbt erwin llm-context localdrawdb mermaid oracle-ddl postgres-ddl spark-ddl xlsx; do
  mkdir -p "$FMT"
  python3 - "$FMT" <<'PY'
import json, shutil, sys, os
fmt = sys.argv[1]
files = json.load(open(f"response-{fmt}.json"))["files"]
for f in files:
    dest = os.path.join(fmt, os.path.basename(f))
    shutil.copy2(f, dest)
    print(f"{fmt}: {dest}")
PY
done
rm -f response-*.json
```

- [ ] **Step 4: Verify all nine exist and are non-empty**

Run: `find fixtures/golden -mindepth 1 -maxdepth 1 -type d | wc -l && find fixtures/golden -type f -size 0`
Expected: `9`, and the second `find` prints nothing.

- [ ] **Step 5: Record provenance**

Write `fixtures/golden/README.md`:

```markdown
# Golden exporter fixtures

Captured from LocalDrawDB at commit `343ae98` on 2026-09-10, before the freeze.

Source schema: `sample.dbml`, copied verbatim from `src/App.tsx`'s `SAMPLE` constant.

These are the objective parity gate for the migration. A Strata exporter is correct when its
output for `sample.dbml` is byte-identical to the file here. If a difference is intentional,
it must be justified in a PR and the fixture regenerated deliberately — never silently.
```

- [ ] **Step 6: Commit**

```bash
git add fixtures/golden
git commit -m "test: capture golden exporter fixtures from LocalDrawDB @343ae98"
```

---

### Task 3: Extract the parity inventory

**This task gates Plan 2 entirely.** `$LDB/src/App.tsx` is 1,905 lines and is the only place the
command palette's action list exists; Stage 5 deletes it. Extract before it is lost.

**Files:**
- Create: `docs/parity-inventory.md`

**Interfaces:**
- Produces: `docs/parity-inventory.md` — the checklist Plan 2's Stage 5 gate is defined against.

- [ ] **Step 1: Extract palette actions**

Read `$LDB/src/App.tsx`. Find the `actions` array passed to `buildCommands` (imported from
`./palette/registry`). For every entry record: `label`, `shortcut` (if any), and one sentence
describing what `run` does.

- [ ] **Step 2: Extract keyboard gestures**

Read `$LDB/src/help/gestures.ts`. Record every entry of `CANVAS_GESTURES` and everything
`shortcutsFromCommands` derives.

- [ ] **Step 3: Extract canvas actions**

Read `$LDB/src/canvas/actions.ts`. Record every method on the `CanvasActions` type — these are the
canvas's entire public behaviour surface.

- [ ] **Step 4: Extract panel controls**

For each of `ColumnPanel`, `LayersPanel`, `ProblemsPanel`, `RecordsPanel`, `GitPanel`,
`DomainPicker`, `CredentialsWizard`, `StatusLog`, `TableInfoPopover`, `SelectionBar`,
`PageImportWizard`, `ColumnMappings`, `DbmlDiff` — record every interactive control and its effect.

- [ ] **Step 5: Extract exporters, git operations, and API surface**

Exporters: the nine `case` labels in `$LDB/server/exportDispatch.ts`, each with its options and any
warning it can raise (see `$LDB/src/exportWarnings.ts`).
Git: every operation in `$LDB/src/domains/GitPanel.tsx` and `$LDB/server/git.ts` exposed to a user.
API: every endpoint called from `$LDB/src/api.ts`.

- [ ] **Step 6: Write the inventory**

`docs/parity-inventory.md`, one row per user-visible behaviour:

```markdown
# Strata Parity Inventory

Extracted from LocalDrawDB @ `343ae98` on 2026-09-10. This is the contract for Plan 2's Stage 5:
migration is complete when every row is verified in Strata.

One row = one thing a user can do. Do not merge rows. Do not delete a row because it seems
unimportant — mark it deliberately dropped, with a reason, and it becomes a decision someone can
review.

| # | Area | Behaviour | Source | Verified |
|---|------|-----------|--------|----------|
| 1 | Palette | "Add table" (⌘⇧A) creates a table at viewport centre | src/App.tsx:1421 | ☐ |
| 2 | Canvas | Drag a column handle onto another table creates a Ref | src/canvas/actions.ts:88 | ☐ |
```

Areas: `Palette`, `Shortcut`, `Canvas`, `Panel:<name>`, `Export`, `Git`, `API`, `Editor`.
Every row must carry a `file:line` in `Source` — a row without one is unverifiable.

- [ ] **Step 7: Verify coverage**

Run: `grep -c "^| [0-9]" docs/parity-inventory.md`
Expected: at least 80 rows. Fewer means the extraction was not exhaustive — go back to Step 1.

- [ ] **Step 8: Commit**

```bash
git add docs/parity-inventory.md
git commit -m "docs: extract parity inventory from LocalDrawDB @343ae98"
```

---

## Wave B — after Task 1, 3 agents in parallel

---

### Task 4: Test harness

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `npm run test` running Vitest 4 with the `@/` alias and a jsdom environment. Tasks 7 and
  8 depend on this script existing and on the alias resolving inside test files.

- [ ] **Step 1: Install**

```bash
npm i -D vitest@4.1.1 jsdom@29.1.1 @testing-library/react@16.0.0
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
    globals: true,
  },
});
```

`include` covers `server/` too — Task 7's ported tests live there and must run from the same command.

- [ ] **Step 3: Write `src/test/setup.ts`**

```ts
import "@testing-library/react";
```

- [ ] **Step 4: Add the script**

```bash
npm pkg set scripts.test="vitest run"
npm pkg set scripts."test:watch"="vitest"
```

- [ ] **Step 5: Write a smoke test proving the alias resolves**

`src/test/setup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import App from "@/App";

describe("test harness", () => {
  it("resolves the @/ alias", () => {
    expect(typeof App).toBe("function");
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm run test`
Expected: PASS — 1 test.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "test: set up Vitest 4 with jsdom and the @/ alias"
```

---

### Task 5: Design system wiring

Moves the values from `design-system/` (a reference example) into the live app.

**Files:**
- Create: `src/index.css`, `tailwind.config.ts`, `postcss.config.js`, `components.json`,
  `src/lib/utils.ts`, `src/components/ui/*`
- Modify: `src/main.tsx` (import the stylesheet)

**Interfaces:**
- Produces: `cn(...classes)` exported from `@/lib/utils`; all tokens from
  `docs/identity.md` §3 available as Tailwind classes and CSS variables.

- [ ] **Step 1: Install**

```bash
npm i -D tailwindcss@3.4.19 tailwindcss-animate@1.0.7 autoprefixer@10.5.4 postcss@8.5.26
npm i clsx@2.1.1 tailwind-merge@2.6.0 class-variance-authority@0.7.1 lucide-react@1.28.0
```

- [ ] **Step 2: Copy the token files**

```bash
cp design-system/globals.css src/index.css
cp design-system/tailwind.config.ts tailwind.config.ts
```

Then in `tailwind.config.ts` set `content` to `["./index.html", "./src/**/*.{ts,tsx}"]`.
**Do not change any colour value.** `design-system/globals.css` is the source of truth and its
values are already verified for WCAG AA (see `docs/identity.md` §3).

- [ ] **Step 3: Write `postcss.config.js`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 4: Write `src/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Vendor Structura's `components.json`**

Copy it from the Structura checkout and change only `tailwind.css` to `src/index.css`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 6: Generate the shadcn components Plan 2 needs**

```bash
npx shadcn@latest add button input select label checkbox switch separator \
  dialog sheet popover tooltip dropdown-menu tabs scroll-area badge command sonner
```

Generated files land in `src/components/ui/`. **Do not edit them afterwards.**

- [ ] **Step 7: Import the stylesheet**

Add to the top of `src/main.tsx`:

```tsx
import "@/index.css";
```

- [ ] **Step 8: Prove the tokens resolve in both themes**

`src/test/tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/index.css", "utf8");

describe("design tokens", () => {
  it("defines every semantic token in the light block before any override", () => {
    for (const token of [
      "--background", "--foreground", "--card", "--primary", "--primary-foreground",
      "--muted-foreground", "--border", "--ring", "--surface", "--success", "--warning",
      "--layer-bronze", "--layer-silver", "--layer-gold",
      "--rel-fk", "--rel-lineage", "--key-pk", "--syn-keyword",
    ]) {
      expect(css.indexOf(`${token}:`), `${token} missing`).toBeGreaterThan(-1);
    }
  });

  it("uses dark/light naming, never Catppuccin flavour names, in app source", () => {
    expect(css.includes(".dark")).toBe(true);
  });
});
```

- [ ] **Step 9: Run the gates**

Run: `npm run test && npm run build && grep -ri "macchiato\|latte" src/ || true`
Expected: tests PASS, build PASS, and the `grep` prints nothing from `src/`.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: wire the Catppuccin token system and shadcn primitives"
```

---

### Task 6: i18n scaffold

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/pt-BR.json`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: a configured `i18next` instance imported for side effects from `@/i18n`; components in
  Plan 2 use `useTranslation()` from `react-i18next`.

- [ ] **Step 1: Install**

```bash
npm i i18next@25.10.0 react-i18next@16.6.0
```

- [ ] **Step 2: Write the locale files**

`src/i18n/locales/pt-BR.json`:

```json
{
  "app": { "name": "Strata" },
  "theme": { "dark": "Escuro", "light": "Claro" },
  "common": { "cancel": "Cancelar", "save": "Salvar", "close": "Fechar" }
}
```

`src/i18n/locales/en.json`:

```json
{
  "app": { "name": "Strata" },
  "theme": { "dark": "Dark", "light": "Light" },
  "common": { "cancel": "Cancel", "save": "Save", "close": "Close" }
}
```

- [ ] **Step 3: Write `src/i18n/index.ts`**

`pt-BR` is the fallback, matching Structura. This is deliberate — do not change it to `en`.

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/i18n/locales/en.json";
import ptBR from "@/i18n/locales/pt-BR.json";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, "pt-BR": { translation: ptBR } },
  lng: "pt-BR",
  fallbackLng: "pt-BR",
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 4: Import it**

Add to `src/main.tsx`, above the `App` import:

```tsx
import "@/i18n";
```

- [ ] **Step 5: Test the fallback direction**

`src/i18n/__tests__/i18n.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";

describe("i18n", () => {
  it("falls back to pt-BR, not en", () => {
    expect(i18n.options.fallbackLng).toEqual(["pt-BR"]);
  });

  it("resolves a key in both locales", () => {
    expect(i18n.t("theme.dark")).toBe("Escuro");
    expect(i18n.getFixedT("en")("theme.dark")).toBe("Dark");
  });
});
```

- [ ] **Step 6: Run**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add i18n with en and pt-BR, pt-BR as fallback"
```

---

## Wave C — after Task 4, 2 agents in parallel

Both tasks copy tests **first** so the suite is red before the implementation arrives. That red is
the migration's proof that the tests are really running.

---

### Task 7: Port `server/` verbatim

11,001 lines, 64 files, 34 test files. Risk is near zero — it is not React and it is fully covered.

**Files:**
- Create: `server/**` (copied from `$LDB/server/**`)
- Modify: `package.json` (server deps + `dev:server` script)

**Interfaces:**
- Produces: the Fastify app on the same routes LocalDrawDB served, so Task 9's API client is
  unchanged. Consumed by Task 9.

- [ ] **Step 1: Install the server dependencies**

```bash
npm i fastify@^4.28.1 @fastify/static@^7.0.4 @dbml/core@^3.9.5 js-yaml@^4.1.0 \
  node-sql-parser@^5.3.1 xlsx@^0.18.5 dagre@^0.8.5
npm i -D tsx@^4.19.1 cross-env@^7.0.3 @types/js-yaml@^4.0.9 @types/dagre@^0.7.54
npm pkg set scripts."dev:server"="tsx watch server/index.ts"
npm pkg set scripts.start="cross-env NODE_ENV=production tsx server/index.ts"
```

- [ ] **Step 2: Copy the tests only, and watch them fail**

```bash
mkdir -p server/__tests__
cp -R $LDB/server/__tests__/. server/__tests__/
cp -R $LDB/server/__fixtures__/. server/__fixtures__/ 2>/dev/null || true
```

- [ ] **Step 3: Run to verify they fail**

Run: `npm run test -- server/`
Expected: FAIL — 34 files erroring on unresolved imports (`Cannot find module '../routes'` and
similar). If they *pass*, the tests are not running; stop and report.

- [ ] **Step 4: Copy the implementation verbatim**

```bash
cp -R $LDB/server/*.ts server/
cp -R $LDB/server/ddl server/
```

Per Global Constraints, the only edits allowed now are import paths, TS 6 type errors, and Prettier.
One extra edit is explicitly permitted here: any hard-coded `"localdrawdb"` string used in
**data-directory resolution** (see `server/paths.ts`) becomes `"strata"`. Change nothing else that
matches that string.

- [ ] **Step 5: Run the full server suite**

Run: `npm run test -- server/`
Expected: PASS — **all 34 test files green.**

The suite covers round-trips (`roundtrip`, `dbtRoundtrip`, `dbtMetaRoundtrip`, `colorsRoundtrip`,
`lineageRoundtrip`), git (`git`, `gitDataDirIsolation.integration`, `isGitRepo.integration`,
`prUrl`), exporters (`oracleDdl`, `postgresDdl`, `exportDdl`, `sqlExport`, `xlsx`, `llmContext`),
imports (`sqlImport`, `dbtImport`, `dbtImportRoute`, `routesImport`), and projects/domains
(`projects`, `projectsRoutes`, `domains`, `domainRoutes`, `domainContext`, `pinnedProject`, `files`,
`filesActiveDomain`).

**If any test is red, the port is wrong — not the test.** The only permitted adaptation is a Vitest
2 → 4 harness API change, and every such change must be listed in your task report.

- [ ] **Step 6: Confirm the git isolation guarantee specifically**

Run: `npm run test -- server/__tests__/gitDataDirIsolation.integration.test.ts`
Expected: PASS. This protects LocalDrawDB commit `5f40224` — the fix that keeps `data/`'s git out of
the application's own repository. It is the single easiest thing to lose in this port.

- [ ] **Step 7: Typecheck under TS 6**

Run: `npm run typecheck`
Expected: PASS. Fix **types only**. If a type fix would change runtime behaviour, stop and report.

- [ ] **Step 8: Commit**

```bash
git add server package.json package-lock.json
git commit -m "feat(server): port Fastify + filesystem + git layer verbatim from LocalDrawDB"
```

---

### Task 8: Port the DBML domain core verbatim

4,296 lines, 35 files, 20 test files. The core is already React-free — this task moves it, it does
not extract it.

**Files:**
- Create: `src/features/schema/model/**` (from `$LDB/src/dsl/**`),
  `src/features/schema/model/layers.ts`, `exportWarnings.ts`, `projectMessages.ts`
- Create: `src/features/schema/__tests__/**` (from `$LDB/src/dsl/__tests__/**`)

**Interfaces:**
- Produces: `parseDbml`, `validateModel`, `organize`, `splitDbmlBlocks`, and the mutation helpers
  from `edit.ts` (`appendRef`, `removeRef`, `removeTable`, `renameTable`, `renameColumnAllRefs`,
  `addColumn`, `setTableLayer`, `addLayerGroup`, `addLineageEntry`, `removeLineageEntry`,
  `addFieldLineageEntry`, `removeFieldLineageEntry`, `updateFieldLineageEntry`, `setTableColor`,
  `setGroupColor`, `isCompleteTableId`), all importable from `@/features/schema/model/*`.
  Consumed by Task 10 and by every Plan 2 canvas task.

- [ ] **Step 1: Copy the tests only**

```bash
mkdir -p src/features/schema/__tests__
cp $LDB/src/dsl/__tests__/*.test.ts src/features/schema/__tests__/
```

- [ ] **Step 2: Rewrite their import paths**

In the copied test files, rewrite relative imports of the form `../<name>` to
`@/features/schema/model/<name>`. Change nothing else in them.

- [ ] **Step 3: Run to verify they fail**

Run: `npm run test -- src/features/schema`
Expected: FAIL — 20 files erroring on unresolved `@/features/schema/model/*` imports.

- [ ] **Step 4: Copy the implementation verbatim**

```bash
mkdir -p src/features/schema/model
cp $LDB/src/dsl/*.ts src/features/schema/model/
cp $LDB/src/layers.ts $LDB/src/exportWarnings.ts $LDB/src/projectMessages.ts \
   src/features/schema/model/
```

Rewrite import paths only. No other edits.

- [ ] **Step 5: Run the suite**

Run: `npm run test -- src/features/schema`
Expected: PASS — **all 20 test files green**: `parseDbt`, `edit`, `reconcile`,
`reconcileCorruption.repro`, `validateModel`, `lineageFields`, `renameDetect`, `renameCrlf`,
`propagateKeyRename`, `rolenames`, `rolenameEdit`, `rolenameClassify`, `tableGroupMembership`,
`largeDiagram`, `blocks`, `colors`, `dbmlNotes`, `lineLocate`, `normalize`, `v4`.

- [ ] **Step 6: Enforce the React-free rule**

Run: `grep -rE "from ['\"]react" src/features/schema/model/ && echo "VIOLATION" || echo "clean"`
Expected: prints `clean`. Any hit is a failed task.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Types only — never logic.

- [ ] **Step 8: Commit**

```bash
git add src/features/schema package.json
git commit -m "feat(schema): port the React-free DBML domain core verbatim from LocalDrawDB"
```

---

## Wave D — after Tasks 7 and 8, sequential

---

### Task 9: Infrastructure seam for the API client

`src/api.ts` is the only place the app talks to the server. Isolating it now means Phase 3
(`IStoragePort`) changes one folder instead of hunting call sites.

**Files:**
- Create: `src/infrastructure/api/client.ts`, `src/infrastructure/api/types.ts`,
  `src/infrastructure/api/index.ts`, `src/infrastructure/api/__tests__/client.test.ts`

**Interfaces:**
- Consumes: the Fastify routes from Task 7.
- Produces, all from `@/infrastructure/api` — Plan 2 imports **only** from this barrel:
  - functions `loadProject`, `saveProject`, `loadProjectById`, `normalizeSizes`
  - `exportFormat(dbml, format, dialect?)` → `POST /api/export`, returns `{ files: string[] }`
  - its thin wrappers, which must keep their exact names because Plan 2's export menu calls them:
    `exportDdl`, `exportDbt`, `exportErwin`, `exportMermaid`, `exportPng`, `exportInput`,
    `exportLocalDrawDB` (an alias of `exportInput`)
  - types `CanvasState`, `DomainMeta`, `GitStatus`, `ProjectMeta`, `LineageLink`, `TableSize`,
    `CanvasPage`, `ExportFormat`, `InputDialect`

- [ ] **Step 1: Copy the tests**

```bash
mkdir -p src/infrastructure/api/__tests__
cp $LDB/src/__tests__/api.domains.test.ts src/infrastructure/api/__tests__/client.test.ts
```

Rewrite its imports to `@/infrastructure/api`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- src/infrastructure`
Expected: FAIL — unresolved `@/infrastructure/api`.

- [ ] **Step 3: Split `api.ts` into types and client**

Copy `$LDB/src/api.ts` (347 lines). Move its exported `type` and `interface` declarations into
`types.ts`; the functions into `client.ts`. **This is a move, not a rewrite** — function bodies are
untouched.

- [ ] **Step 4: Write the barrel**

`src/infrastructure/api/index.ts`:

```ts
export * from "@/infrastructure/api/types";
export {
  loadProject,
  saveProject,
  loadProjectById,
  exportFormat,
  normalizeSizes,
} from "@/infrastructure/api/client";
```

- [ ] **Step 5: Run**

Run: `npm run test -- src/infrastructure && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Guard the seam**

`src/infrastructure/api/__tests__/seam.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

describe("api seam", () => {
  it("is the only place that calls fetch", () => {
    const offenders = walk("src")
      .filter((p) => !p.startsWith(join("src", "infrastructure", "api")))
      .filter((p) => /\bfetch\s*\(/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });
});
```

This test is what keeps the seam a seam once Plan 2 starts adding components.

- [ ] **Step 7: Run and commit**

Run: `npm run test`
Expected: PASS.

```bash
git add src/infrastructure && git commit -m "refactor(api): isolate the server client behind one seam"
```

---

### Task 10: Convert interaction state to Zustand + Immer slices

The one intentional structural change before Plan 2. `$LDB/src/store/interaction.ts` is 139 lines of
plain Zustand; Structura's convention is sliced stores with Immer.

**Files:**
- Create: `src/features/schema/store/interactionSlice.ts`, `src/features/schema/store/index.ts`,
  `src/features/schema/store/__tests__/interaction.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 7–9.
- Produces: `useSchemaStore` from `@/features/schema/store`, exposing the same state keys and
  actions `$LDB/src/store/interaction.ts` exposed (including `selectedColumn` and its setter, which
  `model/edit.ts` call sites read). Consumed by every Plan 2 canvas and panel task.

- [ ] **Step 1: Install Immer and the Zustand middleware**

```bash
npm i zustand@5.0.11 immer@11.1.16
```

- [ ] **Step 2: Read the current store and list its surface**

Read `$LDB/src/store/interaction.ts`. Write down every state key and every action name. The
converted store must expose **exactly** these names — renaming any of them breaks Plan 2's call
sites and is out of scope.

- [ ] **Step 3: Write the failing test**

`src/features/schema/store/__tests__/interaction.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useSchemaStore } from "@/features/schema/store";

describe("schema interaction store", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  it("starts with no column selected", () => {
    expect(useSchemaStore.getState().selectedColumn).toBeNull();
  });

  it("selects and clears a column immutably", () => {
    const before = useSchemaStore.getState();
    useSchemaStore.getState().setSelectedColumn({ tableId: "loja.pedido", columnName: "id" });
    const after = useSchemaStore.getState();

    expect(after.selectedColumn).toEqual({ tableId: "loja.pedido", columnName: "id" });
    expect(after).not.toBe(before);

    useSchemaStore.getState().setSelectedColumn(null);
    expect(useSchemaStore.getState().selectedColumn).toBeNull();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm run test -- src/features/schema/store`
Expected: FAIL — unresolved `@/features/schema/store`.

- [ ] **Step 5: Write the slice**

`src/features/schema/store/interactionSlice.ts` — port every key and action found in Step 2 into
this shape. `selectedColumn` is shown; add the rest identically.

```ts
import type { StateCreator } from "zustand";

export type SelectedColumn = { tableId: string; columnName: string } | null;

export type InteractionSlice = {
  selectedColumn: SelectedColumn;
  setSelectedColumn: (value: SelectedColumn) => void;
};

export const createInteractionSlice: StateCreator<
  InteractionSlice,
  [["zustand/immer", never]],
  [],
  InteractionSlice
> = (set) => ({
  selectedColumn: null,
  setSelectedColumn: (value) =>
    set((state) => {
      state.selectedColumn = value;
    }),
});
```

- [ ] **Step 6: Compose the store**

`src/features/schema/store/index.ts`:

```ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createInteractionSlice, type InteractionSlice } from "./interactionSlice";

export type SchemaStore = InteractionSlice;

export const useSchemaStore = create<SchemaStore>()(
  immer((...a) => ({ ...createInteractionSlice(...a) })),
);
```

- [ ] **Step 7: Run**

Run: `npm run test -- src/features/schema/store && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Run the whole suite and the build**

Run: `npm run build && npm run test && npm run format:check`
Expected: all PASS. This is the **Wave D exit gate** and the end of this plan.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(schema): convert interaction state to a Zustand + Immer slice"
```

---

## Plan exit criteria

Before declaring this plan done, all of the following must be true:

- [ ] `npm run build` green
- [ ] `npm run test` green — **at least 56 test files**: 34 server + 20 schema + the harness, token,
      i18n, api-seam and store tests added here
- [ ] `npm run format:check` green
- [ ] `grep -rE "from ['\"]react" src/features/schema/model/` prints nothing
- [ ] `grep -ri "macchiato\|latte" src/` prints nothing
- [ ] `fixtures/golden/` holds nine exporter outputs plus `sample.dbml`
- [ ] `docs/parity-inventory.md` holds at least 80 rows, each with a `file:line` source

**Not yet migrated, by design:** the entire React layer — `src/canvas` (6,223 lines), `src/App.tsx`
(1,905), `src/editor`, `src/domains`, `src/records`, `src/palette`, `src/help`, `src/components`.
That is Plan 2, which is written once Task 3's parity inventory exists.

---

## Execution handoff

The implementer is Cursor (Grok / Composer), not this session. Suggested dispatch:

| Wave | Tasks | Agents | Blocked by |
| --- | --- | --- | --- |
| A | 1, 2, 3 | 3 parallel | — |
| B | 4, 5, 6 | 3 parallel | Task 1 |
| C | 7, 8 | 2 parallel | Task 4 |
| D | 9, then 10 | 1 sequential | Tasks 7, 8 |

Give each agent **only its own task section plus `## Global Constraints`**. Tasks are written to be
self-contained; an agent that needs a file another task owns has hit a plan bug — it should report
that rather than edit across the boundary.
