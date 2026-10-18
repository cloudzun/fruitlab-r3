import http from "node:http";
import { createStaticServer } from "../../serve.mjs";

export async function startTestServer(db, dbPath = ":memory:") {
  const { server, url, port } = await createStaticServer({ port: 0, db, dbPath });
  const base = url;
  return {
    server,
    base,
    port,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export function request(base, method, path, { body, headers = {} } = {}) {
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
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
        });
      },
    );
    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

export async function login(base, username, password) {
  const res = await request(base, "POST", "/api/auth/login", { body: { username, password } });
  const cookie = res.headers["set-cookie"]?.[0]?.split(";")[0] ?? "";
  return { res, cookie };
}
