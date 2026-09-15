#!/usr/bin/env bash
# D4 G4/G5: dbt compile of the 5 transform models + sqlglot (compiled ≡ toDbtSql; spark parse).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VENV="$ROOT/.venv-dbt"
FIXTURE="$ROOT/fixtures/dbt-source/transform"
OUT="$ROOT/docs/superpowers/dbt-validate"
MODELS="rename_simples expr_cast left_join where_filter group_agg"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for scripts/dbt/validate-transform.sh" >&2
  exit 1
fi

python3 -m venv "$VENV"
# shellcheck disable=SC1091
source "$VENV/bin/activate"
python3 -m pip install -U pip >/dev/null
python3 -m pip install dbt-core dbt-duckdb sqlglot

mkdir -p "$OUT"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/strata-dbt-transform.XXXXXX")"
SPARK="$TMP/spark"
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

mkdir -p "$SPARK"
(cd "$ROOT" && npx tsx scripts/dbt/emit-transform-sql.ts "$SPARK")

set +e
(cd "$TMP" && dbt compile --project-dir . --profiles-dir . --select $MODELS) > "$OUT/transform-compile.txt" 2>&1
STATUS=$?
set -e
echo "exit=$STATUS" >> "$OUT/transform-compile.txt"

if [ "$STATUS" -ne 0 ]; then
  echo "dbt compile failed (exit $STATUS) — see $OUT/transform-compile.txt" >&2
  exit "$STATUS"
fi

COMPILED="$TMP/target/compiled/strata/models/demo/gold"
python3 "$ROOT/scripts/dbt/compare-transform.py" "$COMPILED" "$SPARK"
echo "validate-transform ok — $OUT/transform-compile.txt"
