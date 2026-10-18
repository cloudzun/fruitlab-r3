// FruitLab R3 运维与管理员 CLI。
// 退出码：0 成功 / 1 业务失败 / 2 用法错误 / 3 暂时性失败（可重试）/ 4 内部错误。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createPool, waitForDatabase, closePool, runMigrations, checkDatabase, verifyMigrationChecksums, withTransaction, resetDatabase, schemaVersion } from "./server/db.mjs";
import { hashPassword, validateCredentials } from "./server/auth.mjs";
import { seedClassroom, seedProductionAdmin } from "./server/seed.mjs";
import { createCatalogService } from "./server/services/catalog.mjs";
import * as usersRepo from "./server/repositories/users.mjs";
import * as productsRepo from "./server/repositories/products.mjs";
import * as ordersRepo from "./server/repositories/orders.mjs";
import { createApp, formatStartupError } from "./server/app.mjs";
import { createStaticServer } from "./serve.mjs";
import { loadConfig, ConfigError, readVersion } from "./config.mjs";

const args = process.argv.slice(2);

function out(payload, json, human) {
  if (json) process.stdout.write(JSON.stringify(payload) + "\n");
  else if (human !== undefined) process.stdout.write(`${human}\n`);
  else process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function fail(code, message, json, exitCode = 1) {
  if (json) process.stdout.write(JSON.stringify({ ok: false, code, message }) + "\n");
  else process.stderr.write(`[${code}] ${message}\n`);
  process.exitCode = exitCode;
}

function parseGlobal(argv) {
  const rest = [...argv];
  const options = { url: undefined, json: false };
  while (rest.length && rest[0].startsWith("--")) {
    const flag = rest.shift();
    if (flag === "--json") options.json = true;
    else if (flag === "--url" || flag.startsWith("--url=")) {
      const value = flag === "--url" ? rest.shift() : flag.slice("--url=".length);
      if (!value) return { error: "--url requires a DATABASE_URL" };
      options.url = value;
    } else if (flag === "--help") options.help = true;
    else if (flag === "--version") options.version = true;
    else if (flag === "--db" || flag.startsWith("--db=")) {
      return { error: "--db 已移除；请用 --url <DATABASE_URL> 或 DATABASE_URL" };
    } else return { error: `unknown argument: ${flag}` };
  }
  return { options, rest };
}

function takeFlag(argv, name) {
  const index = argv.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index === -1) return { found: false, rest: argv };
  const arg = argv[index];
  const value = arg === name ? argv[index + 1] : arg.slice(name.length + 1);
  const rest = [...argv.slice(0, index), ...argv.slice(index + (arg === name ? 2 : 1))];
  return { found: true, value, rest };
}

function printHelp(json) {
  const text = `FruitLab R3 CLI ${readVersion()}

用法: node cli.mjs [--url <DATABASE_URL>] [--json] <command> ...

命令:
  dev [--port <0-65535>]          迁移 + 按需 seed + 启动（含静态托管）
  db migrate                      迁移（幂等；advisory lock）
  db seed                         按模式写入种子（classroom=14+3 / production=14+admin）
  db check                        连接/迁移版本/约束/种子计数/checksum
  db backup [--out <dir>]         SQL 逻辑导出（JSON Lines，reset 的保险）
  db restore --in <file> --yes    从 JSON Lines 备份恢复（先停写）
  db reset --yes [--out <dir>]    先备份，再事务重建 + seed + 校验
  user list                       列出用户
  user add --username <u> --password-stdin [--role user|admin]
  product list [--all]            列出商品（--all 含下架）
  product set-price --id <id> --unit-price-cents <n>
  product set-stock --id <id> --stock <n>
  product unlist|relist --id <id>
  orders list [--user <username>]
  orders show <orderNumber>
  --help | --version

环境: DATABASE_URL（必需）、APP_ENV、DEMO_PASSWORD、ADMIN_PASSWORD、COOKIE_SECURE 等，见 README。
退出码: 0 成功 / 1 业务失败 / 2 用法错误 / 3 暂时性失败 / 4 内部错误`;
  out({ ok: true, data: { help: text } }, json, text);
}

function readStdinPassword() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) return reject(new Error("--password-stdin 需要从管道读取"));
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data.replace(/\r?\n$/, "")));
    process.stdin.on("error", reject);
  });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

const BACKUP_TABLES = ["users", "products", "orders", "order_items", "sessions"];
const RESTORE_ORDER = ["users", "products", "orders", "order_items", "sessions"];

async function exportBackup(pool, outDir) {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${timestamp()}.jsonl`);
  const lines = [];
  lines.push(JSON.stringify({
    type: "meta",
    app: "fruitlab-r3",
    version: readVersion(),
    schemaVersion: await schemaVersion(pool),
    createdAt: new Date().toISOString(),
  }));
  for (const table of BACKUP_TABLES) {
    const result = await pool.query(`SELECT * FROM ${table}`);
    lines.push(JSON.stringify({ type: "table", name: table, rows: result.rows }));
  }
  fs.writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
  return file;
}

async function importBackup(pool, file) {
  const raw = fs.readFileSync(file, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");
  const meta = JSON.parse(lines[0]);
  if (meta.type !== "meta" || meta.app !== "fruitlab-r3") throw new Error("backup meta invalid");
  const tables = new Map();
  for (const line of lines.slice(1)) {
    const record = JSON.parse(line);
    if (record.type !== "table") throw new Error("backup table record invalid");
    tables.set(record.name, record.rows);
  }
  await resetDatabase(pool, {
    seed: async (client) => {
      await runMigrationsOnClient(client);
      for (const table of RESTORE_ORDER) {
        const rows = tables.get(table) ?? [];
        for (const row of rows) {
          const columns = Object.keys(row);
          const placeholders = columns.map((_, index) => `$${index + 1}`);
          const overriding = table === "orders" || table === "order_items" ? " OVERRIDING SYSTEM VALUE" : "";
          await client.query(
            `INSERT INTO ${table} (${columns.join(", ")})${overriding} VALUES (${placeholders.join(", ")})`,
            columns.map((column) => row[column]),
          );
        }
        if (table === "orders" || table === "order_items") {
          const idColumn = table === "orders" ? "order_id" : "item_id";
          await client.query(
            `SELECT setval(pg_get_serial_sequence('${table}', '${idColumn}'),
               COALESCE((SELECT MAX(${idColumn}) FROM ${table}), 1), true)`,
          );
        }
      }
    },
  });
  return meta;
}

// restore 里的 seed 回调需要先跑迁移；resetDatabase 已经先 migrate，这里不再重复。
async function runMigrationsOnClient() {}

async function main() {
  const parsed = parseGlobal(args);
  if (parsed.error) return fail("invalid-argument", parsed.error, false, 2);
  const { options } = parsed;
  const rest = parsed.rest;
  const command = rest.shift();
  if (options.help || command === undefined) return printHelp(options.json);
  if (options.version) return out({ ok: true, data: { version: readVersion() } }, options.json, readVersion());
  const jsonIndex = rest.indexOf("--json");
  if (jsonIndex !== -1) {
    rest.splice(jsonIndex, 1);
    options.json = true;
  }
  if (!["dev", "db", "user", "product", "orders"].includes(command)) {
    return fail("invalid-argument", `unknown command: ${command}`, options.json, 2);
  }

  let config;
  try {
    config = loadConfig({ databaseUrl: options.url });
  } catch (error) {
    return fail("config-invalid", error instanceof ConfigError ? error.message : String(error), options.json, 1);
  }

  const json = options.json;

  if (command === "dev") {
    const portFlag = takeFlag(rest, "--port");
    if (portFlag.found) {
      const port = Number(portFlag.value);
      if (!Number.isInteger(port) || port < 0 || port > 65535) return fail("invalid-argument", "--port must be 0-65535", options.json, 2);
      config.port = port;
    }
    config.serveStatic = true;
    const app = await createApp({ config }).catch((error) => {
      process.stderr.write(`${formatStartupError(error, config)}\n`);
      process.exitCode = 1;
      return null;
    });
    if (!app) return;
    const { server, port } = await createStaticServer(app, config);
    out(
      { ok: true, data: { url: `http://${config.host}:${port}`, port, version: app.version, schemaVersion: app.schemaVersion } },
      options.json,
      `FruitLab 已启动: http://${config.host}:${port}  (Ctrl+C 停止)`,
    );
    const shutdown = async () => {
      await new Promise((resolve) => server.close(resolve));
      await app.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    return;
  }

  const pool = createPool({ connectionString: config.databaseUrl, ...config.db });
  try {
    await waitForDatabase(pool);
    const catalog = createCatalogService({ pool, repos: { products: productsRepo } });

    if (command === "db") {
      const sub = rest.shift();
      if (sub === "migrate") {
        const version = await runMigrations(pool);
        return out({ ok: true, data: { schemaVersion: version } }, json, `迁移完成: schema ${version}`);
      }
      if (sub === "seed") {
        const mode = config.seedMode;
        await withTransaction(pool, async (client) => {
          if (mode === "production") {
            await seedProductionAdmin(client, { hashPassword, adminPassword: config.adminPassword });
          } else {
            await seedClassroom(client, { hashPassword, demoPassword: config.demoPassword });
          }
        });
        return out({ ok: true, data: { mode } }, json, `种子写入完成（${mode}）`);
      }
      if (sub === "check") {
        const report = await checkDatabase(pool);
        const problems = await verifyMigrationChecksums(pool);
        const ok = report.connected && problems.length === 0;
        return out(
          { ok, data: { ...report, problems } },
          json,
          JSON.stringify({ ...report, problems }, null, 2),
        ), (process.exitCode = ok ? 0 : 1);
      }
      if (sub === "backup") {
        const outFlag = takeFlag(rest, "--out");
        const dir = outFlag.found ? outFlag.value : "backups";
        const file = await exportBackup(pool, dir);
        return out({ ok: true, data: { file } }, json, `备份完成: ${file}`);
      }
      if (sub === "restore") {
        const inFlag = takeFlag(rest, "--in");
        const yes = takeFlag(rest, "--yes");
        if (!inFlag.found) return fail("invalid-argument", "db restore 需要 --in <file>", json, 2);
        if (!yes.found) return fail("confirmation-required", "db restore 需要 --yes（会覆盖现有数据）", json, 1);
        const meta = await importBackup(pool, inFlag.value);
        return out({ ok: true, data: { restored: inFlag.value, backupVersion: meta.version } }, json, `恢复完成: ${inFlag.value}`);
      }
      if (sub === "reset") {
        const yes = takeFlag(rest, "--yes");
        if (!yes.found) return fail("confirmation-required", "db reset 需要 --yes（会删除现有数据）", json, 1);
        const outFlag = takeFlag(rest, "--out");
        const dir = outFlag.found ? outFlag.value : "backups";
        let backupFile;
        try {
          backupFile = await exportBackup(pool, dir);
        } catch (error) {
          return fail("backup-failed", `备份失败，已中止 reset：${error.message}`, json, 1);
        }
        await resetDatabase(pool, {
          seed: async (client) => {
            if (config.seedMode === "production") {
              await seedProductionAdmin(client, { hashPassword, adminPassword: config.adminPassword });
            } else {
              await seedClassroom(client, { hashPassword, demoPassword: config.demoPassword });
            }
          },
        });
        const report = await checkDatabase(pool);
        if (!(report.counts.products > 0 && report.counts.users > 0)) {
          return fail("reset-verify-failed", "reset 后校验失败", json, 4);
        }
        return out({ ok: true, data: { backupFile, schemaVersion: report.schemaVersion, counts: report.counts } }, json, `数据库已重建并写入种子（备份: ${backupFile}）`);
      }
      return fail("invalid-argument", `unknown db subcommand: ${sub ?? ""}`, json, 2);
    }

    if (command === "user") {
      const sub = rest.shift();
      if (sub === "list") {
        const rows = await usersRepo.list(pool);
        return out({ ok: true, data: rows }, json, rows.map((row) => `${row.username}\t${row.role}`).join("\n"));
      }
      if (sub === "add") {
        let argv = [...rest];
        const username = takeFlag(argv, "--username");
        argv = username.rest;
        const roleFlag = takeFlag(argv, "--role");
        argv = roleFlag.rest;
        const passwordStdin = takeFlag(argv, "--password-stdin");
        if (!username.found) return fail("invalid-argument", "--username 必填", json, 2);
        if (!passwordStdin.found) return fail("invalid-argument", "需要 --password-stdin（推荐）", json, 2);
        const password = await readStdinPassword();
        const problem = validateCredentials({ username: username.value, password });
        if (problem) return fail(problem, "用户名或口令不符合规则", json, 1);
        const role = roleFlag.found ? roleFlag.value : "user";
        if (!["user", "admin"].includes(role)) return fail("invalid-request", "role 只能是 user/admin", json, 1);
        const created = await usersRepo.create(pool, {
          id: `U${crypto.randomBytes(8).toString("hex")}`,
          username: username.value,
          passwordHash: await hashPassword(password),
          role,
          createdAt: new Date().toISOString(),
        });
        return out({ ok: true, data: created }, json, `已创建用户: ${created.username} (${created.role})`);
      }
      return fail("invalid-argument", `unknown user subcommand: ${sub ?? ""}`, json, 2);
    }

    if (command === "product") {
      const sub = rest.shift();
      if (sub === "list") {
        const all = takeFlag(rest, "--all");
        const rows = await productsRepo.list(pool, { includeUnlisted: all.found });
        return out(
          { ok: true, data: rows },
          json,
          rows.map((row) => `${row.id}\t${row.name}\t${row.unitPriceCents}\t${row.stock}\t${row.listed ? "on" : "off"}`).join("\n"),
        );
      }
      const idFlag = takeFlag(rest, "--id");
      if (!idFlag.found) return fail("invalid-argument", "--id 必填", json, 2);
      let patch;
      if (sub === "unlist") patch = { listed: false };
      else if (sub === "relist") patch = { listed: true };
      else if (sub === "set-price") {
        const flag = takeFlag(rest, "--unit-price-cents");
        if (!flag.found) return fail("invalid-argument", "--unit-price-cents 必填", json, 2);
        patch = { unitPriceCents: Number(flag.value) };
      } else if (sub === "set-stock") {
        const flag = takeFlag(rest, "--stock");
        if (!flag.found) return fail("invalid-argument", "--stock 必填", json, 2);
        patch = { stock: Number(flag.value) };
      } else return fail("invalid-argument", `unknown product subcommand: ${sub ?? ""}`, json, 2);
      const product = await catalog.updateProduct(idFlag.value, patch);
      return out({ ok: true, data: product }, json, `${product.id} 已更新`);
    }

    if (command === "orders") {
      const sub = rest.shift();
      if (sub === "list") {
        const userFlag = takeFlag(rest, "--user");
        let rows;
        if (userFlag.found) {
          const user = await usersRepo.findByUsername(pool, userFlag.value);
          if (!user) return fail("order-not-found", "用户不存在", json, 1);
          rows = await ordersRepo.listByUser(pool, user.id);
        } else {
          rows = await ordersRepo.listAll(pool);
        }
        return out(
          { ok: true, data: rows },
          json,
          rows.map((row) => `${row.orderNumber}\t${row.subtotalCents}\t${row.createdAt}`).join("\n"),
        );
      }
      if (sub === "show") {
        const number = rest[0];
        if (!number) return fail("invalid-argument", "orders show <orderNumber>", json, 2);
        const order = await ordersRepo.findByNumber(pool, number);
        if (!order) return fail("order-not-found", "订单不存在", json, 1);
        return out({ ok: true, data: order }, json, JSON.stringify(order, null, 2));
      }
      return fail("invalid-argument", `unknown orders subcommand: ${sub ?? ""}`, json, 2);
    }

    return fail("invalid-argument", `unknown command: ${command}`, json, 2);
  } catch (error) {
    if (error?.stage) return fail("startup-failed", formatStartupError(error, config), json, 3);
    if (typeof error?.code === "string" && error.code === "23505") return fail("auth-username-taken", "用户名已被占用", json, 1);
    if (typeof error?.code === "string" && /^(080|57P01|53300)/.test(error.code)) return fail("db-unavailable", String(error.message), json, 3);
    if (["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"].includes(error?.code) || /timeout exceeded/.test(String(error?.message))) {
      return fail("db-unavailable", String(error?.message ?? error), json, 3);
    }
    return fail("internal-error", String(error?.message ?? error), json, 4);
  } finally {
    await closePool(pool);
  }
}

main();
