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
SCHEMA="$(docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT COALESCE(MAX(version),0) FROM schema_migrations;" | tr -d '[:space:]')"
PRODUCTS="$(docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT COUNT(*) FROM products;" | tr -d '[:space:]')"
USERS="$(docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT COUNT(*) FROM users;" | tr -d '[:space:]')"
echo "校验: schema=${SCHEMA} products=${PRODUCTS} users=${USERS}"
if [ "${SCHEMA:-0}" -lt 2 ] || [ "${PRODUCTS:-0}" -lt 14 ] || [ "${USERS:-0}" -lt 1 ]; then
  echo "[restore-verify-failed] schema/products/users 不满足最低要求；API 保持停止" >&2
  exit 1
fi
docker compose start api
echo "恢复完成: $FILE"
