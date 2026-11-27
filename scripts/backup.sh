#!/bin/sh
# Configure credentials with mysql_config_editor --login-path=epharma first.
set -eu
DB_NAME=${DB_NAME:-epharma_db}
BACKUP_DIR=${BACKUP_DIR:-./backups}
case "$DB_NAME" in *[!A-Za-z0-9_$-]*|'') echo 'Invalid DB_NAME' >&2; exit 1;; esac
umask 077
mkdir -p "$BACKUP_DIR"
filename="$BACKUP_DIR/${DB_NAME}-$(date -u +%Y%m%dT%H%M%SZ)-$$.sql"
tmp="$filename.tmp"
trap 'rm -f "$tmp"' EXIT HUP INT TERM
mysqldump --login-path=epharma --single-transaction --routines --triggers --databases "$DB_NAME" > "$tmp"
mv "$tmp" "$filename"
trap - EXIT HUP INT TERM
echo "Backup saved to $filename"
