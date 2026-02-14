#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pick_python() {
  for bin in python3.12 python3.11 python3.10 python3.9 python3; do
    if command -v "$bin" >/dev/null 2>&1; then
      echo "$bin"
      return 0
    fi
  done
  return 1
}

PY_BIN="$(pick_python || true)"
if [ -z "${PY_BIN:-}" ]; then
  echo "No python3 interpreter found on PATH."
  exit 1
fi

TARGET_VER="$("$PY_BIN" -c 'import sys; print(f\"{sys.version_info.major}.{sys.version_info.minor}\")')"
echo "Using interpreter: $PY_BIN ($TARGET_VER)"

if [ -d .venv ]; then
  CURRENT_VER="$(.venv/bin/python -c 'import sys; print(f\"{sys.version_info.major}.{sys.version_info.minor}\")' 2>/dev/null || echo unknown)"
  if [ "$CURRENT_VER" != "$TARGET_VER" ]; then
    echo "Existing .venv uses Python $CURRENT_VER; recreating with Python $TARGET_VER"
    rm -rf .venv
  fi
fi

if [ ! -d .venv ]; then
  "$PY_BIN" -m venv .venv
fi

source .venv/bin/activate
python -m pip --version
pip install --retries 10 --timeout 60 -r backend/requirements.txt

echo "Backend virtualenv is ready at $ROOT_DIR/.venv"
