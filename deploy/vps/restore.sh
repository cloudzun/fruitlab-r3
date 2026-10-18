#!/usr/bin/env bash
# 恢复 pg_dump 备份：./restore.sh /var/backups/fruitlab/fruitlab-YYYYmmdd-HHMMSS.dump
set -euo pipefail
cd "$(dirname "$0")"
FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "usage: ./restore.sh <backup.dump>" >&2
  exit 2
fi

echo "[restore] stop api"
docker compose --env-file .env.production -f docker-compose.prod.yml stop api
echo "[restore] pg_restore $FILE"
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  pg_restore --clean --if-exists --no-owner -U fruitlab -d fruitlab < "$FILE"
echo "[restore] start api"
docker compose --env-file .env.production -f docker-compose.prod.yml start api
./wait-health.sh
echo "[restore] done"
