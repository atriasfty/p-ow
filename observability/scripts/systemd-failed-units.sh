#!/usr/bin/env bash
# Feeds the count of failed systemd units into node_exporter's textfile
# collector as pow_systemd_failed_units — nothing else surfaces this
# (confirmed via `systemctl --failed` that atria-claude-healthcheck.service
# was silently failed on atria1 with zero alerting on it before this).
# Generic — same script runs on any host. Run via cron every minute as root:
#
#   * * * * * /path/to/systemd-failed-units.sh /path/to/textfiles/dir
set -euo pipefail

OUT_DIR="${1:?Usage: systemd-failed-units.sh <textfiles-output-dir>}"
mkdir -p "$OUT_DIR"
TMP_FILE="${OUT_DIR}/.systemd_failed.prom.tmp"
FINAL_FILE="${OUT_DIR}/systemd_failed.prom"

COUNT="$(systemctl --failed --no-legend 2>/dev/null | wc -l)"

{
    echo "# HELP pow_systemd_failed_units Count of systemd units currently in a failed state"
    echo "# TYPE pow_systemd_failed_units gauge"
    echo "pow_systemd_failed_units ${COUNT}"
} > "$TMP_FILE"

mv "$TMP_FILE" "$FINAL_FILE"
chmod 644 "$FINAL_FILE"
