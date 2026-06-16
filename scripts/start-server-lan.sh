#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
LAN_HOSTNAME="$(hostname | tr '[:upper:]' '[:lower:]')"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

# Non-container LAN mode:
# - Backend uses development env so HTTP auth cookies can be set on LAN
# - Backend binds to all interfaces for remote access
export APP_ENV=development
export HOST=0.0.0.0
export PORT="${BACKEND_PORT}"
export DEBUG=false
export SETTINGS_YAML_PATH="${REPO_ROOT}/server/settings.yaml"
export ADMIN_SECRET="${ADMIN_SECRET:-admin123}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-me}"
# Resolve API calls from the browser hostname (e.g. mtc-aiml-02:3001 -> mtc-aiml-02:8000).
# Unset stale client/.env values such as NEXT_PUBLIC_API_URL=http://<lan-host>:8000.
unset NEXT_PUBLIC_API_URL
unset NEXT_PUBLIC_BACKEND_BASE_URL
export NEXT_PUBLIC_API_PORT="${BACKEND_PORT}"
DEFAULT_CORS_ORIGINS="http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://${LAN_HOSTNAME}:${FRONTEND_PORT}"
if [[ -n "${LAN_IP}" ]]; then
  DEFAULT_CORS_ORIGINS="${DEFAULT_CORS_ORIGINS},http://${LAN_IP}:${FRONTEND_PORT}"
fi
export CORS_ORIGINS="${CORS_ORIGINS:-${DEFAULT_CORS_ORIGINS}}"

collect_file_lock_pids() {
  local file=$1
  [[ -f "${file}" ]] || return 0
  if command -v lsof >/dev/null 2>&1; then
    lsof -t "${file}" 2>/dev/null || true
    return 0
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser "${file}" 2>&1 | grep -oE '[0-9]+' || true
  fi
}

assert_databases_available() {
  local db pid
  local -a lock_pids=()
  for db in "${REPO_ROOT}/data/dashboard.db" "${REPO_ROOT}/data/identity.db"; do
    while IFS= read -r pid; do
      [[ -n "${pid}" ]] && lock_pids+=("${pid}")
    done < <(collect_file_lock_pids "${db}")
  done
  if ((${#lock_pids[@]} > 0)); then
    local unique_pids
    unique_pids="$(printf '%s\n' "${lock_pids[@]}" | sort -u | tr '\n' ' ')"
    echo "Another server instance holds a database lock (PID(s): ${unique_pids})."
    echo "Stop it first, for example: kill ${unique_pids}"
    echo "Or stop all dashboard servers: pkill -f 'python -m server'"
    exit 1
  fi
}

wait_for_backend() {
  local pid=$1
  local port=$2
  local deadline=$((SECONDS + 45))
  echo "Waiting for backend health on 127.0.0.1:${port}..."
  while (( SECONDS < deadline )); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      echo "Backend process ${pid} exited before becoming ready."
      wait "${pid}" 2>/dev/null || true
      return 1
    fi
    if curl -sf "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      echo "Backend is ready."
      return 0
    fi
    sleep 0.5
  done
  echo "Backend did not become ready within 45s."
  return 1
}

if ss -ltn | awk '{print $4}' | grep -Eq "[:.]${BACKEND_PORT}$"; then
  echo "Backend port ${BACKEND_PORT} is already in use. Stop existing process first."
  exit 1
fi
if ss -ltn | awk '{print $4}' | grep -Eq "[:.]${FRONTEND_PORT}$"; then
  echo "Frontend port ${FRONTEND_PORT} is already in use. Stop existing process first."
  exit 1
fi

assert_databases_available

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
echo "Starting backend on 0.0.0.0:${BACKEND_PORT}..."
# uv warns when VIRTUAL_ENV points at a different project; server/.venv is canonical.
unset VIRTUAL_ENV
# Ensure uv resolves dependencies from server/pyproject.toml.
uv run --project "${REPO_ROOT}/server" python -m server &
BACKEND_PID=$!

if ! wait_for_backend "${BACKEND_PID}" "${BACKEND_PORT}"; then
  echo "Aborting: backend failed to start. Fix the error above before retrying."
  exit 1
fi

echo "Building frontend for production..."
cd "${REPO_ROOT}/client"
# Ensure newly added dependencies are present before generate/build.
if ! npm ls --depth=0 js-yaml >/dev/null 2>&1; then
  echo "Installing frontend dependencies (missing js-yaml)..."
  npm install
fi
npm run build

echo "Starting frontend on 0.0.0.0:${FRONTEND_PORT}..."
npm run prepare:standalone
HOSTNAME=0.0.0.0 PORT="${FRONTEND_PORT}" node .next/standalone/server.js &
FRONTEND_PID=$!

echo "Backend PID: ${BACKEND_PID}"
echo "Frontend PID: ${FRONTEND_PID}"
echo "App URL: http://${LAN_HOSTNAME}:${FRONTEND_PORT}"
if [[ -n "${LAN_IP}" ]]; then
  echo "LAN IP URL: http://${LAN_IP}:${FRONTEND_PORT}"
fi
echo "API URL: resolved from browser host on port ${BACKEND_PORT}"
echo "Admin login: username=admin  password=${ADMIN_SECRET}"

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
