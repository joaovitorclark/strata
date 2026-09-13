# Wave W — what to validate

**For:** an agent validating Cursor's last migration-era wave. Not the UX work — that is
[`ux-direction.md`](ux-direction.md) and a different thread.

**Context:** the migration is finished and the parity inventory closed at 254 ☑ · 0 ☐ · 6 dropped of
260. Wave W is three tasks left running after that session closed. None of them is design work: two
are small fixes that unblock the next phase's development loop, and one is a survey whose output
feeds the UX rework.

**Validate by running, not by reading the report.** That rule produced most of what this project
found; the report is a claim, the command is the evidence.

---

## Task 56 — the Vite `/api` proxy

**What it fixes.** `vite.config.ts` lost LocalDrawDB's `/api` → Fastify proxy when Plan 1's Task 1
wrote the file from scratch. Without it `npm run dev` serves the frontend on 8080 with no API behind
it and every request 404s. It went unnoticed because everything was tested through `npm run start`
or `npm run e2e:serve`, which serve the app and the API on one port.

**Validate.** Two terminals:

```bash
npm run dev:server     # Fastify
npm run dev            # Vite on 8080
```

Open `http://localhost:8080` and **load a real project** — not just the shell. The failure mode is a
page that renders chrome and no data, which looks fine at a glance.

Also confirm the proxy respects the API port env var rather than hard-coding 5174.

---

## Task 57 — `/api/meta` reports the wrong data directory

**What it fixes.** `/api/meta` returns the `DATA_DIR` constant instead of the resolved
`baseDataDir()`, so it lies whenever `STRATA_DATA_DIR` is set. Cosmetic, but it is the kind of thing
that costs an hour of debugging.

**Validate.**

```bash
STRATA_DATA_DIR=/tmp/whatever STRATA_DOMAIN=local PORT=5175 npm run start
curl -s http://127.0.0.1:5175/api/meta
```

`dataDir` must report `/tmp/whatever`, not the repo's `data/`.

---

## Task 58 — the dead-affordance survey

**The one that matters.** Output goes to `docs/dead-affordances.md`.

**What it is for.** A dead affordance is a feature the product thinks it has and does not. Five
turned up during the migration, all with the same shape — something defined or handled on one side
of a seam, never produced on the other:

| | |
| --- | --- |
| `LineagePorts` | component built, never mounted |
| `TableInfoPopover` | the ⓘ affordance never added |
| `removeSelectedRef` | callback never passed |
| `focusTableWithPan` | never called from `SchemaTree`, the surface that needs it most |
| `fl:` handles | JSX never rendered, while `Canvas.tsx:533,546` already contains the logic to accept those connections |

An earlier sweep looked for components never referenced outside tests, found only unused shadcn
primitives, and was recorded as conclusive. It was too narrow — it catches the first row and misses
the other four. Task 58 surveys three shapes across `src/features/` and `src/infrastructure/`:

- **(a)** an identifier consumed with no producer — every string literal compared or switched on
  (handle prefixes, action names, node and edge types) traced back to the code that emits it;
- **(b)** a callback prop no call site ever passes;
- **(c)** an export nothing outside a test calls. *Tests do not count as consumers* — that is what
  hid `focusTableWithPan`.

### Validating it

**1. Confirm nothing was fixed.** The task said report only. Check:

```bash
git log --oneline --stat -3
```

Task 58's commit should touch `docs/dead-affordances.md` and nothing else. **If it changed source
files, that is a failed task** — not because the fixes are wrong, but because almost everything in
the survey lives in the canvas, the canvas is about to be redesigned, and a fix now is both thrown
away and possibly in the way of a deliberate redesign. Report what it touched and leave it for a
human to decide whether to revert.

**2. Spot-check the findings.** Take two or three entries and verify both sides in the source — the
thing that exists, and the absence of what should call it. The list is about to be planned against,
so it needs to be trustworthy, and a survey that reports false positives is worse than no survey.

**3. Sanity-check the shape.** If it found nothing under (a), be suspicious: `fl:` is a known
instance and should appear. If it reports dozens under (c), it is probably counting barrel re-exports
or types — those are not affordances.

---

## When it is done

Report to the maintainer:

- whether `npm run dev` now loads real data;
- whether `/api/meta` tells the truth;
- the count of dead affordances by shape, with the two or three you verified yourself;
- **whether Task 58 stayed report-only**, and if not, exactly what it touched.

Then stop. Everything after this is the UX phase, which is a different conversation and a different
way of working — no waves, no plans, no inventory as contract.
