#!/usr/bin/env bash
# Feeds PM2 restart counts into node_exporter's textfile collector as
# pow_pm2_restart_total{name="..."} — PM2 restart counts aren't natively
# scraped by anything else here. Run via cron every minute as root:
#
#   * * * * * /root/pow-observability/scripts/pm2-restart-count.sh
#
# (Adjust the path if this stack isn't deployed at /root/pow-observability.)
set -euo pipefail

OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/node-exporter-textfiles"
mkdir -p "$OUT_DIR"
TMP_FILE="${OUT_DIR}/.pm2_restarts.prom.tmp"
FINAL_FILE="${OUT_DIR}/pm2_restarts.prom"

{
    echo "# HELP pow_pm2_restart_total Cumulative restart count per PM2 process"
    echo "# TYPE pow_pm2_restart_total counter"
    pm2 jlist | python3 -c '
import json, sys
for p in json.load(sys.stdin):
    name = p.get("name", "unknown").replace("\"", "")
    restarts = p.get("pm2_env", {}).get("restart_time", 0)
    print(f"pow_pm2_restart_total{{name=\"{name}\"}} {restarts}")
'
} > "$TMP_FILE"

# Atomic write — node_exporter's textfile collector reads files periodically
# and a partial write mid-read would be silently ignored or error out.
mv "$TMP_FILE" "$FINAL_FILE"
