#!/usr/bin/env bash
# FruitLab 学生 demo 通用启动器
# 用法：bash start-demo.sh https://<浏览器里看到的地址>
# 例：  bash start-demo.sh https://abc-4175.killercoda.com
#        bash start-demo.sh http://116.62.60.211:4175
#        bash start-demo.sh http://127.0.0.1:4175
set -euo pipefail

EXTERNAL_URL="${1:-http://127.0.0.1:4175}"
if [ -z "$EXTERNAL_URL" ]; then
  echo "用法: bash start-demo.sh https://<浏览器里看到的地址>" >&2
  exit 2
fi
case "$EXTERNAL_URL" in
  http://*|https://*) ;;
  *) echo "地址必须以 http:// 或 https:// 开头：$EXTERNAL_URL" >&2; exit 2 ;;
esac
EXTERNAL_URL="${EXTERNAL_URL%/}"

command -v docker >/dev/null 2>&1 || { echo "未安装 Docker" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "没有 docker compose (v2)" >&2; exit 1; }

COMPOSE_URL="${COMPOSE_URL:-https://gitee.com/cloudzun/fruitlab-r3/raw/main/deploy/student/docker-compose.cn.yml}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
OVERRIDE_FILE="docker-compose.override.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "[start] 下载 compose：$COMPOSE_URL"
  curl -fsSL "$COMPOSE_URL" -o "$COMPOSE_FILE"
fi

# 用 override 注入浏览器地址；兼容下载到的旧版 compose（硬编码 127.0.0.1）
cat > "$OVERRIDE_FILE" <<EOF
services:
  api:
    environment:
      PUBLIC_URL: "$EXTERNAL_URL"
      COOKIE_SECURE: "0"
      DEMO_ALLOW_ANY_HOST: "1"
EOF

echo "[start] PUBLIC_URL=$EXTERNAL_URL"
docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" pull
docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" up -d --force-recreate

HOST="${EXTERNAL_URL#*://}"
HOST="${HOST%%/*}"

echo "[start] 等待健康检查（Host: $HOST）..."
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 -H "Host: $HOST" \
      http://127.0.0.1:4175/api/health > /tmp/fruitlab-health.json 2>/dev/null; then
    if grep -q '"db":"up"' /tmp/fruitlab-health.json; then
      echo "[start] 健康：$(cat /tmp/fruitlab-health.json)"
      echo "[start] 打开浏览器里 Killercoda 暴露的 4175 地址（不需要 PUBLIC_URL）"
      exit 0
    fi
  fi
  sleep 2
done

echo "[start] 健康检查超时" >&2
docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" ps >&2 || true
exit 1
