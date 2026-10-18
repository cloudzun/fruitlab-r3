import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, migrate, seed } from "../../server/db.mjs";
import { hashPassword } from "../../server/auth.mjs";

export const DEMO_PASSWORD = "demo1234";

export function createTempDb({ seeded = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fruitlab-test-"));
  const dbPath = path.join(dir, "test.db");
  const db = openDb(dbPath);
  migrate(db);
  if (seeded) seed(db, { hashPassword, demoPassword: DEMO_PASSWORD });
  return {
    dir,
    dbPath,
    db,
    close() {
      try { db.close(); } catch { /* already closed */ }
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* windows handle */ }
    },
  };
}
