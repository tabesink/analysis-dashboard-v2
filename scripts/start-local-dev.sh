#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
FRONTEND_FALLBACK_PORT=$((FRONTEND_PORT + 1))

# Local development mode:
# - Backend binds to localhost with uvicorn reload (DEBUG=true)
# - Frontend uses Next.js dev server with hot reload
# - Code changes apply without restarting the app
export APP_ENV=development
export HOST=127.0.0.1
export DEBUG=true
export SETTINGS_YAML_PATH="${REPO_ROOT}/server/settings.yaml"
export ADMIN_SECRET="${ADMIN_SECRET:-admin123}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-me}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_FALLBACK_PORT},http://127.0.0.1:${FRONTEND_FALLBACK_PORT}}"
export PORT="${BACKEND_PORT}"
# Resolve API calls from the browser hostname (e.g. 127.0.0.1:3001 -> 127.0.0.1:8000).
# Unset stale client/.env values such as NEXT_PUBLIC_API_URL=http://<lan-host>:8000.
unset NEXT_PUBLIC_API_URL
unset NEXT_PUBLIC_BACKEND_BASE_URL
export NEXT_PUBLIC_API_PORT="${BACKEND_PORT}"

if ss -ltn | awk '{print $4}' | grep -Eq "[:.]${BACKEND_PORT}$"; then
  echo "Backend port ${BACKEND_PORT} is already in use. Stop existing process first."
  exit 1
fi
frontend_primary_free=true
if ss -ltn | awk '{print $4}' | grep -Eq "[:.]${FRONTEND_PORT}$"; then
  frontend_primary_free=false
fi
if ss -ltn | awk '{print $4}' | grep -Eq "[:.]${FRONTEND_FALLBACK_PORT}$"; then
  if [[ "${frontend_primary_free}" == false ]]; then
    echo "Frontend ports ${FRONTEND_PORT} and ${FRONTEND_FALLBACK_PORT} are both in use. Stop existing process first."
    exit 1
  fi
fi

cleanup() {
  local exit_code=$?
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi
  wait >/dev/null 2>&1 || true
  exit "${exit_code}"
}
trap cleanup EXIT INT TERM

cd "${REPO_ROOT}"
echo "Starting backend on 127.0.0.1:${BACKEND_PORT} (reload enabled)..."
# Ensure uv resolves dependencies from server/pyproject.toml.
uv run --project "${REPO_ROOT}/server" python -m server &
BACKEND_PID=$!

echo "Starting frontend dev server on 127.0.0.1:${FRONTEND_PORT} (fallback: ${FRONTEND_FALLBACK_PORT})..."
cd "${REPO_ROOT}/client"
# Ensure newly added dependencies are present before generate/dev.
if ! npm ls --depth=0 js-yaml >/dev/null 2>&1; then
  echo "Installing frontend dependencies (missing js-yaml)..."
  npm install
fi
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: ${BACKEND_PID}"
echo "Frontend PID: ${FRONTEND_PID}"
echo "Local app URL: http://127.0.0.1:${FRONTEND_PORT}"
echo "API URL: resolved from browser host on port ${BACKEND_PORT}"
echo "Admin login: username=admin  password=${ADMIN_SECRET}"
echo "Hot reload: backend (uvicorn) + frontend (Next.js dev server)"

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
