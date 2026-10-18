import { createTestDatabase } from "../tests/helpers/pg.mjs";
import { startTestServer, request } from "../tests/helpers/server.mjs";
const db = await createTestDatabase();
const server = await startTestServer(db.url);
const res = await request(server.base, "POST", "/api/orders", { body: JSON.stringify({ items: [] }), headers: { "content-type": "text/plain" } });
console.log("status", res.status, "body", res.raw);
await server.close();
await db.close();
