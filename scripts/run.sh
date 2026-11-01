#!/usr/bin/env bash
# Starts the FastAPI backend (port 8000) and the Vite frontend (port 5173). Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d backend/.venv ] || [ ! -d frontend/node_modules ]; then
  echo "Dependencies missing. Run: bash scripts/setup.sh" >&2
  exit 1
fi

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

(cd backend && .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000) &
(cd frontend && npm run dev -- --host 127.0.0.1) &

sleep 3
echo
echo "SyscallScope is running:"
echo "  App:      http://localhost:5173"
echo "  API docs: http://localhost:8000/docs"
echo "Press Ctrl+C to stop."
wait
