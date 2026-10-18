// 测试 HTTP 服务夹具：真实端口 0 + 真实 Postgres + 真实 router/services。
import http from "node:http";
import { createApp } from "../../server/app.mjs";
import { createStaticServer } from "../../serve.mjs";
import { testConfig } from "./pg.mjs";

export async function startTestServer(databaseUrl, { configOverrides = {}, clock } = {}) {
  const config = testConfig(databaseUrl, configOverrides);
  const app = await createApp({ config, clock });
  const { server, port } = await createStaticServer(app, config);
  config.port = port;
  config.publicUrl = `http://127.0.0.1:${port}`;
  config.publicOrigin = new URL(config.publicUrl);
  return {
    app,
    config,
    port,
    base: config.publicUrl,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await app.close();
    },
  };
}

export function request(base, method, path, { body, headers = {}, cookies = [] } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    const payload = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          ...(payload !== undefined ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          let json;
          try { json = data === "" ? undefined : JSON.parse(data); } catch { json = undefined; }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            setCookies: res.headers["set-cookie"] ?? [],
            body: json,
            raw: data,
          });
        });
      },
    );
    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

export function cookieValue(setCookies, name) {
  for (const item of setCookies) {
    const pair = item.split(";")[0];
    if (pair.startsWith(`${name}=`)) return pair;
  }
  return "";
}

export async function login(base, username = "userA", password = "demo1234") {
  const res = await request(base, "POST", "/api/auth/login", { body: { username, password } });
  const session = cookieValue(res.setCookies, "fruitlab_session");
  const csrf = cookieValue(res.setCookies, "fruitlab_csrf");
  return { res, session, csrfToken: csrf.split("=")[1] ?? "" };
}
