#!/usr/bin/env bash
# Feeds fail2ban's currently-banned IP count per jail into node_exporter's
# textfile collector — a spike here is a real attack signal. Gracefully
# outputs nothing (not a fake zero) if fail2ban isn't installed/active on
# this host, so it's safe to deploy the same script on every box regardless
# of whether fail2ban is actually in use there. Run via cron every minute
# as root:
#
#   * * * * * /path/to/fail2ban-status.sh /path/to/textfiles/dir
set -euo pipefail

OUT_DIR="${1:?Usage: fail2ban-status.sh <textfiles-output-dir>}"
mkdir -p "$OUT_DIR"
TMP_FILE="${OUT_DIR}/.fail2ban_status.prom.tmp"
FINAL_FILE="${OUT_DIR}/fail2ban_status.prom"

if ! command -v fail2ban-client >/dev/null 2>&1 || ! systemctl is-active --quiet fail2ban 2>/dev/null; then
    rm -f "$FINAL_FILE"
    exit 0
fi

{
    echo "# HELP pow_fail2ban_banned_ips Currently banned IPs per fail2ban jail"
    echo "# TYPE pow_fail2ban_banned_ips gauge"
    for jail in $(fail2ban-client status 2>/dev/null | grep 'Jail list' | sed 's/.*:\s*//' | tr ',' ' '); do
        jail="$(echo "$jail" | xargs)"
        [ -z "$jail" ] && continue
        count="$(fail2ban-client status "$jail" 2>/dev/null | grep 'Currently banned' | grep -oE '[0-9]+' | head -1)"
        echo "pow_fail2ban_banned_ips{jail=\"${jail}\"} ${count:-0}"
    done
} > "$TMP_FILE"

mv "$TMP_FILE" "$FINAL_FILE"
chmod 644 "$FINAL_FILE"
