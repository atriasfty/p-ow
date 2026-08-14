#!/usr/bin/env bash
# Feeds `docker system df` numbers into node_exporter's textfile collector —
# orphaned images/volumes can silently eat disk long before HostDiskPressure
# ever fires on the underlying filesystem. Generic — same script runs on any
# host with Docker. Run via cron every 5 minutes as root (cheap, but no need
# to run every minute like the others):
#
#   */5 * * * * /path/to/docker-disk-usage.sh /path/to/textfiles/dir
set -euo pipefail

OUT_DIR="${1:?Usage: docker-disk-usage.sh <textfiles-output-dir>}"
mkdir -p "$OUT_DIR"
TMP_FILE="${OUT_DIR}/.docker_disk.prom.tmp"
FINAL_FILE="${OUT_DIR}/docker_disk.prom"

if ! command -v docker >/dev/null 2>&1; then
    rm -f "$FINAL_FILE"
    exit 0
fi

# --format json gives byte-precise sizes; falls back to size-string parsing
# on older Docker versions that don't support it.
JSON="$(docker system df --format '{{json .}}' 2>/dev/null || true)"

{
    echo "# HELP pow_docker_disk_usage_bytes Docker disk usage by type (images/containers/volumes/build-cache), total vs reclaimable"
    echo "# TYPE pow_docker_disk_usage_bytes gauge"
    if [ -n "$JSON" ]; then
        echo "$JSON" | python3 -c '
import sys, json, re

def to_bytes(s):
    s = s.strip()
    m = re.match(r"([\d.]+)\s*([A-Za-z]+)", s)
    if not m:
        return 0
    val, unit = float(m.group(1)), m.group(2).upper()
    mult = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}.get(unit, 1)
    return int(val * mult)

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        row = json.loads(line)
    except json.JSONDecodeError:
        continue
    kind = row.get("Type", "unknown").lower().replace(" ", "_")
    size = to_bytes(row.get("Size", "0B"))
    reclaimable = row.get("Reclaimable", "0B").split("(")[0]
    reclaimable = to_bytes(reclaimable)
    print(f"pow_docker_disk_usage_bytes{{type=\"{kind}\",kind=\"total\"}} {size}")
    print(f"pow_docker_disk_usage_bytes{{type=\"{kind}\",kind=\"reclaimable\"}} {reclaimable}")
'
    fi
} > "$TMP_FILE"

mv "$TMP_FILE" "$FINAL_FILE"
chmod 644 "$FINAL_FILE"
