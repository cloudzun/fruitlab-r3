#!/usr/bin/env bash
# 生产冒烟：health -> admin 登录 -> userA 应失败 -> admin 下单 -> 订单计数。
# 通过本机 Caddy 的 HTTPS（--resolve 到 127.0.0.1），确保 Secure Cookie 能带上。
# 只在本机执行，读取 /opt/fruitlab/.env.production，不输出密码。
set -euo pipefail
cd /opt/fruitlab
set -a
. ./.env.production
set +a

D="${PUBLIC_URL#https://}"
D="${D%%/*}"
BASE="https://$D"
CURL=(curl -sS --resolve "$D:443:127.0.0.1")
JAR=/tmp/fruitlab-smoke-cookies

"${CURL[@]}" -c "$JAR" "$BASE/api/health"; echo
CSRF="$(awk '$6=="fruitlab_csrf"{print $7}' "$JAR" | tail -n1)"

echo -n "admin_login="
"${CURL[@]}" -o /tmp/fruitlab-admin.json -w '%{http_code}\n' -b "$JAR" -c "$JAR" \
  -H "Origin: $BASE" -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d "{\"username\":\"admin\",\"password\":\"$ADMIN_PASSWORD\"}" "$BASE/api/auth/login"
cat /tmp/fruitlab-admin.json; echo

CSRF="$(awk '$6=="fruitlab_csrf"{print $7}' "$JAR" | tail -n1)"
echo -n "userA_login="
"${CURL[@]}" -o /tmp/fruitlab-usera.json -w '%{http_code}\n' -b "$JAR" \
  -H "Origin: $BASE" -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"username":"userA","password":"demo1234"}' "$BASE/api/auth/login"
cat /tmp/fruitlab-usera.json; echo

CSRF="$(awk '$6=="fruitlab_csrf"{print $7}' "$JAR" | tail -n1)"
CLIENT_ID="r35-prod-smoke-$(date +%s)"
echo -n "create_order="
"${CURL[@]}" -o /tmp/fruitlab-order.json -w '%{http_code}\n' -b "$JAR" -c "$JAR" \
  -H "Origin: $BASE" -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d "{\"items\":[{\"productId\":\"banana\",\"quantity\":1}],\"clientOrderId\":\"$CLIENT_ID\"}" \
  "$BASE/api/orders"
cat /tmp/fruitlab-order.json; echo

echo -n "orders_count="
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  psql -U fruitlab -d fruitlab -Atc 'select count(*) from orders;'
