#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d .venv ]; then
  echo "Missing .venv. Run ./scripts/bootstrap_backend.sh first."
  exit 1
fi

source .venv/bin/activate
exec uvicorn backend.api.main:app --reload --port 8000
