#!/usr/bin/env bash
# 等待本机 web/api 健康；成功返回 0，超时返回 1。
# 内网健康检查必须带 Host: <PUBLIC_URL 的 host>，否则 API 的 Host 白名单会 403。
set -euo pipefail
cd "$(dirname "$0")"

PUBLIC_URL="$(grep -E '^PUBLIC_URL=' .env.production | tail -n 1 | cut -d= -f2-)"
HOST="${PUBLIC_URL#*://}"
HOST="${HOST%%/*}"

for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 -H "Host: $HOST" http://127.0.0.1:4175/api/health > /tmp/fruitlab-health.json 2>/dev/null; then
    if grep -q '"db":"up"' /tmp/fruitlab-health.json; then
      echo "[health] $(cat /tmp/fruitlab-health.json)"
      exit 0
    fi
  fi
  sleep 2
done
echo "[health] timeout" >&2
curl -sS -H "Host: $HOST" http://127.0.0.1:4175/api/health >&2 || true
exit 1
