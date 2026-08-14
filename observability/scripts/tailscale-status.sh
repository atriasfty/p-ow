#!/usr/bin/env bash
# Feeds Tailscale's own backend state into node_exporter's textfile
# collector. atria1's entire node_exporter scrape depends on Tailscale
# staying up (see prometheus.yml's `node` job comment) — HostNodeExporterDown
# only shows the symptom (scrape failed), this disambiguates "Tailscale
# dropped" from "container crashed" from "box is actually down". Generic —
# same script runs on any host. Run via cron every minute as root:
#
#   * * * * * /path/to/tailscale-status.sh /path/to/textfiles/dir
set -euo pipefail

OUT_DIR="${1:?Usage: tailscale-status.sh <textfiles-output-dir>}"
mkdir -p "$OUT_DIR"
TMP_FILE="${OUT_DIR}/.tailscale_status.prom.tmp"
FINAL_FILE="${OUT_DIR}/tailscale_status.prom"

if ! command -v tailscale >/dev/null 2>&1; then
    rm -f "$FINAL_FILE"
    exit 0
fi

STATE="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("BackendState","Unknown"))' 2>/dev/null || echo "Unknown")"
UP=0
[ "$STATE" = "Running" ] && UP=1

{
    echo "# HELP pow_tailscale_up Whether the local Tailscale daemon reports BackendState=Running (1) or not (0)"
    echo "# TYPE pow_tailscale_up gauge"
    echo "pow_tailscale_up ${UP}"
} > "$TMP_FILE"

mv "$TMP_FILE" "$FINAL_FILE"
chmod 644 "$FINAL_FILE"
