#!/usr/bin/env bash
set -euo pipefail

# Diffusion Lighthouse — update pipeline
# Usage:
#   bash scripts/update_all.sh
#   bash scripts/update_all.sh --no-citations
#   bash scripts/update_all.sh --serve
#   bash scripts/update_all.sh --no-citations --serve

NO_CITATIONS=0
SERVE=0

for arg in "$@"; do
  case "$arg" in
    --no-citations) NO_CITATIONS=1 ;;
    --serve) SERVE=1 ;;
    *) echo "Unknown arg: $arg" && exit 1 ;;
  esac
done

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Diffusion Lighthouse update =="
cd "$root_dir"

echo ""
echo "[1/4] Validate YAML"
# If your validator is different, swap this line to your actual validate command.
python -m scripts.validate

echo ""
if [[ "$NO_CITATIONS" -eq 1 ]]; then
  echo "[2/4] Update citations: SKIPPED (--no-citations)"
else
  echo "[2/4] Update citations (best-effort)"
  # If this occasionally fails due to blocks, the whole pipeline shouldn't die.
  # You can remove the '|| true' if you prefer hard-fail.
  python scripts/update_citations.py || {
    echo "WARN: citation updater failed (blocked/rate-limited). Continuing build..."
  }
fi

echo ""
echo "[3/4] Build dataset (writes site/public/data/papers.json)"
python scripts/build_dataset.py

echo ""
echo "[4/4] Doctor checks (stale build, missing links, etc.)"
python scripts/doctor.py

echo ""
echo "✅ Done."

if [[ "$SERVE" -eq 1 ]]; then
  echo ""
  echo "Serving site/ at http://localhost:8000"
  echo "Ctrl+C to stop."
  cd "$root_dir/site"
  python -m http.server 8000
fi
