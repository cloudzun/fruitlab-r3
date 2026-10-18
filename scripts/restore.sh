#!/usr/bin/env bash
# pg_restore 恢复：停写 → 断连 → 单事务恢复 → 校验 → 启 api。
#   wsl -e bash scripts/restore.sh backups/<file>.dump
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -s "$FILE" ]; then
  echo "usage: scripts/restore.sh <backup.dump>" >&2
  exit 2
fi
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
: "${POSTGRES_USER:?POSTGRES_USER required}"
: "${POSTGRES_DB:?POSTGRES_DB required}"

docker compose stop api
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();"
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --single-transaction --exit-on-error < "$FILE"
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT 'products=' || COUNT(*) FROM products; SELECT 'users=' || COUNT(*) FROM users;"
docker compose start api
echo "恢复完成: $FILE"
