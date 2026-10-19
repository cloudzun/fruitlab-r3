#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://116.62.60.211:4175}"
JAR=/tmp/aliyun-demo-cookies
curl -sS -c "$JAR" "$BASE/api/health"; echo
CSRF="$(awk '$6=="fruitlab_csrf"{print $7}' "$JAR" | tail -n1)"
echo -n "login="
curl -sS -o /tmp/aliyun-login.json -w '%{http_code}\n' -b "$JAR" -c "$JAR" \
  -H "Origin: $BASE" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"username":"userA","password":"demo1234"}' "$BASE/api/auth/login"
cat /tmp/aliyun-login.json; echo
CSRF="$(awk '$6=="fruitlab_csrf"{print $7}' "$JAR" | tail -n1)"
echo -n "order="
curl -sS -o /tmp/aliyun-order.json -w '%{http_code}\n' -b "$JAR" -c "$JAR" \
  -H "Origin: $BASE" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"items":[{"productId":"banana","quantity":1}],"clientOrderId":"aliyun-demo-001"}' \
  "$BASE/api/orders"
cat /tmp/aliyun-order.json; echo
echo -n "home="
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/"
