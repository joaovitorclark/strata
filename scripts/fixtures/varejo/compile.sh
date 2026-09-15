#!/usr/bin/env bash
# Compile managed varejo models (tag strata:managed). Does not change validate.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
VENV="$ROOT/.venv-dbt"
FIXTURE="$ROOT/fixtures/dbt-source/varejo"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi

if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"
python3 -m pip install -U pip >/dev/null
python3 -m pip install dbt-core dbt-duckdb >/dev/null

TMP="$(mktemp -d "${TMPDIR:-/tmp}/strata-varejo-compile.XXXXXX")"
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
(cd "$TMP" && dbt compile --project-dir . --profiles-dir . --select tag:strata:managed) > "$TMP/compile.txt" 2>&1
STATUS=$?
set -e

echo "exit=$STATUS" >> "$TMP/compile.txt"
cat "$TMP/compile.txt"

if [ "$STATUS" -ne 0 ]; then
  echo "dbt compile managed failed (exit $STATUS)" >&2
  exit "$STATUS"
fi

echo "dbt compile managed ok"
