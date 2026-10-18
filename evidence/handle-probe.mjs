import { createTestDatabase } from "../tests/helpers/pg.mjs";
const db = await createTestDatabase();
await db.close();
await new Promise((r) => setTimeout(r, 300));
const handles = process._getActiveHandles().map((h) => h.constructor?.name ?? String(h));
const reqs = process._getActiveRequests().map((r) => r.constructor?.name ?? String(r));
console.log("handles:", handles.join(","), "requests:", reqs.join(","));
