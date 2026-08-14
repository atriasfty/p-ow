#!/usr/bin/env bash
# Feeds the mtime of the newest matching backup file into node_exporter's
# textfile collector as pow_backup_last_file_timestamp_seconds{job="..."}.
# File freshness is the only trustworthy signal here — a cron job's exit
# code isn't enough (see the standalone-backup.js / backup-db.sh incident:
# both jobs "ran" on schedule while producing nothing useful for weeks).
# Generic — pass a different glob/job label per host/job. Deploys:
#
#   atria2 (release snapshots from standalone-backup.js / deploy.sh):
#     */5 * * * * /path/to/backup-file-age.sh <out-dir> release '/root/p-ow/backups/*.tar.gz'
#   atria1 (Postgres replica landed by backup-db.sh's scp):
#     */5 * * * * /path/to/backup-file-age.sh <out-dir> postgres_replica '/root/backups/pow/*.sql.gz'
set -euo pipefail

OUT_DIR="${1:?Usage: backup-file-age.sh <textfiles-output-dir> <job-label> <glob-pattern>}"
JOB="${2:?Usage: backup-file-age.sh <textfiles-output-dir> <job-label> <glob-pattern>}"
GLOB="${3:?Usage: backup-file-age.sh <textfiles-output-dir> <job-label> <glob-pattern>}"

mkdir -p "$OUT_DIR"
TMP_FILE="${OUT_DIR}/.backup_age_${JOB}.prom.tmp"
FINAL_FILE="${OUT_DIR}/backup_age_${JOB}.prom"

# Newest matching file's mtime, or 0 if none exist (never ran / all deleted —
# 0 reads as "epoch, infinitely stale" to any alert on this, which is correct).
NEWEST_TS=0
for f in $GLOB; do
    [ -e "$f" ] || continue
    ts="$(stat -c '%Y' "$f" 2>/dev/null || echo 0)"
    if [ "$ts" -gt "$NEWEST_TS" ]; then NEWEST_TS="$ts"; fi
done

{
    echo "# HELP pow_backup_last_file_timestamp_seconds Unix timestamp of the newest file matching this backup job's expected output — 0 if none found"
    echo "# TYPE pow_backup_last_file_timestamp_seconds gauge"
    echo "pow_backup_last_file_timestamp_seconds{backup_job=\"${JOB}\"} ${NEWEST_TS}"
} > "$TMP_FILE"

mv "$TMP_FILE" "$FINAL_FILE"
chmod 644 "$FINAL_FILE"
