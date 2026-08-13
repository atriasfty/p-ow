#!/usr/bin/env bash
# POW observability stack — one-time bring-up on the actual prod VPS.
# Run as root (matches how deploy.sh/PM2 already operate on this box):
#   cd observability && sudo ./setup.sh
#
# Idempotent — safe to re-run after pulling config changes; it will just
# `docker compose up -d` again to apply them.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ "$(id -u)" -ne 0 ]]; then
    echo "Run this as root (sudo ./setup.sh) — it needs to read PM2's log" >&2
    echo "directory and manage Docker." >&2
    exit 1
fi

if ! command -v docker &>/dev/null; then
    echo "Docker isn't installed. Install it first:" >&2
    echo "  curl -fsSL https://get.docker.com | sh" >&2
    exit 1
fi

if ! docker compose version &>/dev/null; then
    echo "The 'docker compose' plugin isn't available (checked: docker compose version)." >&2
    echo "Install the compose plugin for your distro, then re-run this script." >&2
    exit 1
fi

# --- .env: generate on first run, never overwrite an existing one ---
if [[ ! -f .env ]]; then
    GF_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
    cat > .env <<EOF
GF_SECURITY_ADMIN_PASSWORD=${GF_PASS}
EOF
    chmod 600 .env
    echo "Generated .env with a new Grafana admin password: ${GF_PASS}"
    echo "(saved in observability/.env — save it somewhere else too, it won't be printed again)"
else
    echo ".env already exists — leaving it as-is."
fi

# --- PM2 log dir sanity check ---
PM2_LOG_DIR="${PM2_LOG_DIR:-/root/.pm2/logs}"
if [[ ! -d "$PM2_LOG_DIR" ]]; then
    echo "WARNING: PM2 log dir '$PM2_LOG_DIR' doesn't exist yet." >&2
    echo "If PM2 runs as a different user here, set PM2_LOG_DIR=/path/to/.pm2/logs" >&2
    echo "in observability/.env before re-running, or Promtail just won't find" >&2
    echo "anything to tail (harmless, but no logs will show up in Loki)." >&2
fi

# --- Config files must be readable by whatever non-root UID each image's
# --- default process runs as. No host-specific ACL assumptions here —
# --- just make the (non-secret) config tree world-readable. Only .env
# --- carries anything sensitive, and that stays 600 (read by the Docker
# --- daemon itself, which runs as root, not by a container process).
find "$SCRIPT_DIR" -type d -not -path '*/.git*' -exec chmod 755 {} +
find "$SCRIPT_DIR" -type f -not -name '.env' -not -path '*/.git*' -exec chmod 644 {} +
chmod +x "$SCRIPT_DIR/setup.sh"

echo "Starting stack..."
docker compose up -d

echo "Waiting for services to settle..."
sleep 10

echo
echo "=== Status ==="
docker compose ps

echo
echo "=== Health checks ==="
check() {
    local name="$1" url="$2"
    if curl -sf --max-time 3 "$url" >/dev/null 2>&1; then
        echo "  OK   $name ($url)"
    else
        echo "  FAIL $name ($url) — check: docker compose logs $name"
    fi
}
check prometheus "http://127.0.0.1:9090/-/healthy"
check alertmanager "http://127.0.0.1:9093/-/healthy"
check loki "http://127.0.0.1:3100/ready"
check grafana "http://127.0.0.1:3300/api/health"

echo
echo "=== Resource usage (compare against README.md's ~714MB ceiling) ==="
docker stats --no-stream $(docker compose ps -q) 2>/dev/null || true

echo
echo "Next steps:"
echo "  1. In the Cloudflare Zero Trust dashboard, on this box's existing"
echo "     tunnel, add a Public Hostname -> http://127.0.0.1:3300 for Grafana."
echo "  2. Log into Grafana as 'admin' with the password from observability/.env."
echo "  3. Prometheus currently only scrapes itself + node_exporter — the"
echo "     pow-* jobs in prometheus/prometheus.yml are commented out until"
echo "     Phase 2 (app /metrics endpoints) ships."
