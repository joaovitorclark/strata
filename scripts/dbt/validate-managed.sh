#!/usr/bin/env bash
# G7: dbt parse a copy of kitchen-sink after stamping one managed model; every
# managed node in manifest.json has tag strata:managed and
# config.meta.strata.generator == "strata"; `dbt ls --select tag:strata:managed`
# lists exactly those names.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VENV="$ROOT/.venv-dbt"
FIXTURE="${1:-$ROOT/fixtures/dbt-source/kitchen-sink}"
OUT="$ROOT/docs/superpowers/dbt-validate"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for scripts/dbt/validate-managed.sh" >&2
  exit 1
fi

python3 -m venv "$VENV"
# shellcheck disable=SC1091
source "$VENV/bin/activate"
python3 -m pip install -U pip >/dev/null
python3 -m pip install dbt-core dbt-duckdb

mkdir -p "$OUT"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/strata-dbt-validate-managed.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

cp -R "$FIXTURE/." "$TMP/"
cat > "$TMP/profiles.yml" <<'EOF'
strata:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: ":memory:"
      threads: 1
EOF

"$ROOT/node_modules/.bin/tsx" "$ROOT/scripts/dbt/stamp-managed.ts" "$TMP" vendas gold.dim_cliente

set +e
(cd "$TMP" && dbt parse --project-dir . --profiles-dir .) > "$OUT/parse-managed.txt" 2>&1
STATUS=$?
set -e
echo "exit=$STATUS" >> "$OUT/parse-managed.txt"

if [ "$STATUS" -ne 0 ]; then
  echo "dbt parse failed (exit $STATUS) — see $OUT/parse-managed.txt" >&2
  exit "$STATUS"
fi

(cd "$TMP" && dbt ls --quiet --resource-type model --select tag:strata:managed --output name \
  --project-dir . --profiles-dir .) > "$OUT/ls-managed.txt" 2>> "$OUT/parse-managed.txt"

python3 - "$TMP/target/manifest.json" "$OUT/ls-managed.txt" <<'PY'
import json, sys
manifest_path, ls_path = sys.argv[1], sys.argv[2]
manifest = json.load(open(manifest_path, encoding="utf-8"))
managed = []
for node in manifest.get("nodes", {}).values():
    if node.get("resource_type") != "model":
        continue
    cfg = node.get("config") or {}
    tags = list(cfg.get("tags") or node.get("tags") or [])
    meta = cfg.get("meta") or node.get("meta") or {}
    strata = meta.get("strata") if isinstance(meta, dict) else {}
    if not isinstance(strata, dict):
        strata = {}
    if "strata:managed" in tags or strata.get("managed") is True:
        managed.append((node.get("name"), tags, strata))

if not managed:
    print("no managed models in manifest", file=sys.stderr)
    sys.exit(1)

for name, tags, strata in managed:
    if "strata:managed" not in tags:
        print(f"{name}: missing tag strata:managed", file=sys.stderr)
        sys.exit(1)
    if strata.get("generator") != "strata":
        print(f"{name}: generator={strata.get('generator')!r} != 'strata'", file=sys.stderr)
        sys.exit(1)

ls_names = sorted(
    line.strip()
    for line in open(ls_path, encoding="utf-8")
    if line.strip() and "\x1b" not in line and "Running with" not in line and "Found " not in line
)
manifest_names = sorted(name for name, _, _ in managed)
if ls_names != manifest_names:
    print(f"dbt ls {ls_names} != manifest {manifest_names}", file=sys.stderr)
    sys.exit(1)
print("validate-managed ok —", ", ".join(manifest_names))
PY
