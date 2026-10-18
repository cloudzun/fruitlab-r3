#!/usr/bin/env bash
# 部署前备份：pg_dump 自定义格式，保留 14 天。
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env.production ]; then
  echo "[backup] missing .env.production" >&2
  exit 1
fi
mkdir -p /var/backups/fruitlab
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="/var/backups/fruitlab/fruitlab-${STAMP}.dump"

if ! docker compose --env-file .env.production -f docker-compose.prod.yml ps --status running --services | grep -qx db; then
  echo "[backup] db not running; skip"
  exit 0
fi

docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  pg_dump -U fruitlab -d fruitlab -Fc > "$OUT"
chmod 600 "$OUT"
echo "[backup] $OUT"

find /var/backups/fruitlab -name 'fruitlab-*.dump' -type f -mtime +14 -delete
