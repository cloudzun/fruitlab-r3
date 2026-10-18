#!/usr/bin/env bash
# 幂等部署：备份 -> 记录上一版 -> pull -> up -> 健康检查 -> 失败自动回滚。
# 用法：./deploy.sh 3.5.0.0
set -euo pipefail
cd "$(dirname "$0")"

TAG="${1:-}"
if [ -z "$TAG" ]; then
  echo "usage: ./deploy.sh <image-tag>" >&2
  exit 2
fi
if [ ! -f .env.production ]; then
  echo "[deploy] missing .env.production (chmod 600)" >&2
  exit 1
fi

PREV="$(cat .last_good_tag 2>/dev/null || true)"
if [ -n "$PREV" ]; then
  echo "$PREV" > .previous_tag
fi

# 部署前备份（首次部署 db 尚未运行时会 skip）
./backup.sh

echo "$TAG" > .last_good_tag
export IMAGE_TAG="$TAG"
echo "[deploy] image tag=$TAG (previous=${PREV:-none})"

docker compose --env-file .env.production -f docker-compose.prod.yml pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

if ./wait-health.sh; then
  echo "[deploy] success: $TAG"
  exit 0
fi

echo "[deploy] health failed; rollback to ${PREV:-none}" >&2
if [ -n "$PREV" ]; then
  export IMAGE_TAG="$PREV"
  docker compose --env-file .env.production -f docker-compose.prod.yml pull || true
  docker compose --env-file .env.production -f docker-compose.prod.yml up -d || true
  ./wait-health.sh || true
fi
exit 1
