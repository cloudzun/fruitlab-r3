#!/usr/bin/env bash
# pg_dump 备份（容器内执行，生产路径）。在 WSL 中运行：
#   wsl -e bash scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
: "${POSTGRES_USER:?POSTGRES_USER required}"
: "${POSTGRES_DB:?POSTGRES_DB required}"

mkdir -p -m 700 backups
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="backups/${STAMP}.dump"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$FILE"
if [ ! -s "$FILE" ]; then
  echo "[backup-failed] empty dump: $FILE" >&2
  exit 1
fi
chmod 600 "$FILE"
echo "备份完成: $FILE ($(wc -c < "$FILE") bytes)"
