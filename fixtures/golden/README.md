# Golden exporter fixtures

Captured from LocalDrawDB at commit `343ae98` on 2026-09-10, before the freeze.

Source schema: `sample.dbml`, copied verbatim from `src/App.tsx`'s `SAMPLE` constant.

These are the objective parity gate for the migration. A Strata exporter is correct when its
output for `sample.dbml` is byte-identical to the file here. If a difference is intentional,
it must be justified in a PR and the fixture regenerated deliberately — never silently.

This capture ran against a copy of the data dir (`LOCALDRAWDB_DATA_DIR=/tmp/strata-fixture-data`, `LOCALDRAWDB_DOMAIN=local`, `PORT=5175`) so it is reproducible.
