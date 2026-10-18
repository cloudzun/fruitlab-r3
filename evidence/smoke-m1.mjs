// M1 冒烟：真实 HTTP + 真实 Postgres。输出 JSON 结果，供 evidence 记录。
const BASE = "http://127.0.0.1:4180";
let sessionCookie = "";
let csrfCookie = "";

function cookieFrom(headers, name) {
  const list = headers.getSetCookie ? headers.getSetCookie() : [];
  for (const item of list) {
    const [pair] = item.split(";");
    if (pair.startsWith(`${name}=`)) return pair;
  }
  return "";
}

async function call(method, path, { body, headers = {}, cookies = [] } = {}) {
  const init = { method, headers: { ...headers, ...(cookies.length ? { cookie: cookies.join("; ") } : {}) } };
  if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: response.status, json, text, headers: response.headers };
}

const results = [];

results.push(["health", await call("GET", "/api/health")]);
results.push(["products", await call("GET", "/api/products")]);

const login = await call("POST", "/api/auth/login", { body: { username: "userA", password: "demo1234" } });
sessionCookie = cookieFrom(login.headers, "fruitlab_session");
csrfCookie = cookieFrom(login.headers, "fruitlab_csrf");
results.push(["login", { status: login.status, json: login.json, hasSession: Boolean(sessionCookie), hasCsrf: Boolean(csrfCookie) }]);

results.push(["me", await call("GET", "/api/auth/me", { cookies: [sessionCookie] })]);

const order = await call("POST", "/api/orders", {
  body: { items: [{ productId: "banana", quantity: 2 }], clientOrderId: `smoke-${Date.now()}` },
  headers: { "x-csrf-token": csrfCookie.split("=")[1] },
  cookies: [sessionCookie, csrfCookie],
});
results.push(["order", { status: order.status, json: order.json }]);

results.push(["mine", await call("GET", "/api/orders/mine", { cookies: [sessionCookie] })]);

results.push(["order-no-csrf", await call("POST", "/api/orders", {
  body: { items: [{ productId: "banana", quantity: 1 }], clientOrderId: `smoke-nocsrf-${Date.now()}` },
  cookies: [sessionCookie, csrfCookie],
})]);

results.push(["405 dynamic", await call("PATCH", "/api/orders/FL-20261018-000000-AAAA", { cookies: [sessionCookie] })]);
results.push(["405 admin product", await call("GET", "/api/admin/products/fuji-apple", { cookies: [sessionCookie] })]);
results.push(["malformed path", await call("GET", "/api/orders/%zz", { cookies: [sessionCookie] })]);
results.push(["me anonymous", await call("GET", "/api/auth/me")]);
results.push(["cross origin login", await call("POST", "/api/auth/login", {
  body: { username: "userA", password: "demo1234" },
  headers: { origin: "http://evil.example" },
})]);

for (const [name, result] of results) {
  const summary = result.json && typeof result.json === "object"
    ? { status: result.status, ok: result.json.ok, code: result.json.code, hasSession: result.hasSession, hasCsrf: result.hasCsrf, count: result.json.products?.length ?? result.json.orders?.length }
    : { status: result.status, hasSession: result.hasSession, hasCsrf: result.hasCsrf };
  console.log(name, JSON.stringify(summary));
}
