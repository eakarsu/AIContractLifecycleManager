#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$root"
[[ -f .env ]] || { echo "Missing .env; copy .env.example." >&2; exit 1; }
[[ -d backend/node_modules && -d frontend/node_modules ]] || { echo "Run ./scripts/bootstrap.sh first." >&2; exit 1; }
set -a; source .env; set +a
(cd backend && npm start) & backend_pid=$!
(cd frontend && BROWSER=none PORT="${FRONTEND_PORT:-3000}" npm start) & frontend_pid=$!
cleanup() { kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$backend_pid" "$frontend_pid"
