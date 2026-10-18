#!/usr/bin/env bash
# 手工回滚：./rollback.sh [tag]；不带参数时用 .previous_tag。
set -euo pipefail
cd "$(dirname "$0")"

TAG="${1:-$(cat .previous_tag 2>/dev/null || true)}"
if [ -z "$TAG" ]; then
  echo "no previous tag; usage: ./rollback.sh <tag>" >&2
  exit 2
fi

export IMAGE_TAG="$TAG"
echo "[rollback] -> $TAG"
docker compose --env-file .env.production -f docker-compose.prod.yml pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
./wait-health.sh
echo "$TAG" > .last_good_tag
