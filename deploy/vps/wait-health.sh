#!/usr/bin/env bash
# 等待本机 web/api 健康；成功返回 0，超时返回 1。
set -euo pipefail
cd "$(dirname "$0")"
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:4175/api/health > /tmp/fruitlab-health.json 2>/dev/null; then
    if grep -q '"db":"up"' /tmp/fruitlab-health.json; then
      echo "[health] $(cat /tmp/fruitlab-health.json)"
      exit 0
    fi
  fi
  sleep 2
done
echo "[health] timeout" >&2
curl -sS http://127.0.0.1:4175/api/health >&2 || true
exit 1
