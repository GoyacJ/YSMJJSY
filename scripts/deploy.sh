#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SERVICE_NAME="${SERVICE_NAME:-ysmjjsy}"
ENV_FILE="${ENV_FILE:-/etc/ysmjjsy.env}"
DATA_DIR="${DATA_DIR:-/var/lib/ysmjjsy}"
PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"
RUN_USER="${RUN_USER:-$(id -un)}"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
NPM_BIN="${NPM_BIN:-$(command -v npm)}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run as root: sudo bash scripts/deploy.sh" >&2
    exit 1
  fi
}

ensure_env_file() {
  if [[ -f "${ENV_FILE}" ]]; then
    return
  fi

  local generated_secret
  generated_secret="$(openssl rand -hex 32 2>/dev/null || date +%s%N)"

  install -m 600 /dev/null "${ENV_FILE}"
  cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
HOST=${HOST}
PORT=${PORT}
NUXT_MINIMAX_API_KEY=
NUXT_MINIMAX_GROUP_ID=
NUXT_UNLOCK_CODE=100522
NUXT_SESSION_SECRET=${generated_secret}
NUXT_SQLITE_PATH=${DATA_DIR}/app.sqlite
EOF

  echo "Created ${ENV_FILE}."
  echo "Fill NUXT_MINIMAX_API_KEY and NUXT_MINIMAX_GROUP_ID, then run this script again."
  exit 1
}

load_and_validate_env() {
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  local missing=()
  [[ -n "${NUXT_MINIMAX_API_KEY:-}" ]] || missing+=("NUXT_MINIMAX_API_KEY")
  [[ -n "${NUXT_MINIMAX_GROUP_ID:-}" ]] || missing+=("NUXT_MINIMAX_GROUP_ID")
  [[ -n "${NUXT_UNLOCK_CODE:-}" ]] || missing+=("NUXT_UNLOCK_CODE")
  [[ -n "${NUXT_SESSION_SECRET:-}" ]] || missing+=("NUXT_SESSION_SECRET")
  [[ -n "${NUXT_SQLITE_PATH:-}" ]] || missing+=("NUXT_SQLITE_PATH")

  if ((${#missing[@]} > 0)); then
    printf 'Missing required env in %s: %s\n' "${ENV_FILE}" "${missing[*]}" >&2
    exit 1
  fi
}

install_service() {
  cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=YSMJJSY Nuxt app
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${NODE_BIN} .output/server/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}"
}

main() {
  need_root

  if [[ ! -f "${APP_DIR}/package.json" ]]; then
    echo "APP_DIR is not a project directory: ${APP_DIR}" >&2
    exit 1
  fi

  ensure_env_file
  load_and_validate_env

  mkdir -p "${DATA_DIR}"
  chown -R "${RUN_USER}:${RUN_USER}" "${DATA_DIR}"

  cd "${APP_DIR}"
  "${NPM_BIN}" ci
  "${NPM_BIN}" run build

  install_service
  systemctl restart "${SERVICE_NAME}"
  sleep 2
  systemctl --no-pager --full status "${SERVICE_NAME}"
  curl --fail --silent --show-error "http://${HOST}:${PORT}/" >/dev/null

  echo "Deployment finished: ${SERVICE_NAME} is running on ${HOST}:${PORT}"
}

main "$@"
