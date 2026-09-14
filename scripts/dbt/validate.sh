#!/usr/bin/env bash
# G9: dbt parse on fixtures/dbt-source/kitchen-sink with the latest stable
# dbt-core + dbt-duckdb. Fails if parse exits non-zero or prints a deprecation
# warning. Versions and output land in docs/superpowers/dbt-validate/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VENV="$ROOT/.venv-dbt"
FIXTURE="$ROOT/fixtures/dbt-source/kitchen-sink"
OUT="$ROOT/docs/superpowers/dbt-validate"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for scripts/dbt/validate.sh" >&2
  exit 1
fi

python3 -m venv "$VENV"
# shellcheck disable=SC1091
source "$VENV/bin/activate"
python3 -m pip install -U pip >/dev/null
python3 -m pip install dbt-core dbt-duckdb

mkdir -p "$OUT"
python3 -m pip show dbt-core dbt-duckdb > "$OUT/versions.txt"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/strata-dbt-validate.XXXXXX")"
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

set +e
(cd "$TMP" && dbt parse --project-dir . --profiles-dir .) > "$OUT/parse.txt" 2>&1
STATUS=$?
set -e

echo "exit=$STATUS" >> "$OUT/parse.txt"

if grep -Ei "deprecat" "$OUT/parse.txt" >/dev/null; then
  echo "dbt parse emitted a deprecation warning — see $OUT/parse.txt" >&2
  exit 1
fi

if [ "$STATUS" -ne 0 ]; then
  echo "dbt parse failed (exit $STATUS) — see $OUT/parse.txt" >&2
  exit "$STATUS"
fi

echo "dbt parse ok — $OUT/parse.txt"
