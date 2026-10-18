// FruitLab R2 运维与管理员 CLI。
// 退出码：0 成功 / 1 业务失败 / 2 用法错误 / 3 暂时性失败（可重试）/ 4 内部错误。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { openDb, migrate, seed, isSeeded, schemaVersion, defaultDbPath, inTransaction } from "./server/db.mjs";
import { hashPassword, listUsers, createUser, validateCredentials } from "./server/auth.mjs";
import { listProducts, updateProduct } from "./server/products.mjs";
import { listAllOrders, getOrderByNumber, listOrdersByUser } from "./server/orders.mjs";
import { findUserByUsername } from "./server/auth.mjs";
import { startStaticServer } from "./serve.mjs";

const VERSION = "2.0.0.0";
const args = process.argv.slice(2);

function out(payload, json) {
  if (json) process.stdout.write(JSON.stringify(payload) + "\n");
  else if (typeof payload === "string") process.stdout.write(payload + "\n");
  else process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
}

function fail(code, message, json, exitCode = 1) {
  if (json) process.stdout.write(JSON.stringify({ ok: false, code, message }) + "\n");
  else process.stderr.write(`[${code}] ${message}\n`);
  process.exitCode = exitCode;
}

function parseGlobal(argv) {
  const rest = [...argv];
  const options = { dbPath: process.env.FRUITLAB_DB || defaultDbPath(), json: false };
  while (rest.length && rest[0].startsWith("--")) {
    const flag = rest.shift();
    if (flag === "--json") options.json = true;
    else if (flag === "--db" || flag.startsWith("--db=")) {
      const value = flag === "--db" ? rest.shift() : flag.slice("--db=".length);
      if (!value) return { error: "--db requires a path" };
      options.dbPath = value;
    } else if (flag === "--help") { options.help = true; }
    else if (flag === "--version") { options.version = true; }
    else return { error: `unknown argument: ${flag}` };
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
  const text = `FruitLab R2 CLI ${VERSION}

用法: node cli.mjs [--db <path>] [--json] <command> ...

命令:
  dev                       初始化（如需要）+ 种子（如需要）+ 启动服务
  db init                   建库与迁移（幂等）
  db seed                   写入 14 商品与 3 个演示账号（幂等）
  db reset --yes            删除数据库重建（自动备份到 data/backups/）
  db check                  完整性检查（integrity_check / foreign_key_check / user_version）
  user list                 列出用户
  user add --username <u> --password-stdin [--role user|admin]
  product list [--all]      列出商品（--all 含下架）
  product set-price --id <id> --unit-price-cents <n>
  product set-stock --id <id> --stock <n>
  product unlist --id <id>  下架
  product relist --id <id>  上架
  orders list [--user <username>]
  orders show <orderNumber>

全局:
  --db <path>               数据库路径（默认 data/fruitlab.db，或环境变量 FRUITLAB_DB）
  --json                    机器可读输出 {"ok":true,"data":...} / {"ok":false,"code":"...","message":"..."}

退出码: 0 成功 / 1 业务失败 / 2 用法错误 / 3 暂时性失败 / 4 内部错误`;
  out(json ? { ok: true, data: { help: text } } : text, json);
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

async function main() {
  const parsed = parseGlobal(args);
  if (parsed.error) return fail("invalid-argument", parsed.error, false, 2);
  const { options } = parsed;
  const rest = parsed.rest;
  const command = rest.shift();
  if (options.help || command === undefined) return printHelp(options.json);
  if (options.version) return out(options.json ? { ok: true, data: { version: VERSION } } : VERSION, options.json);

  const dbPath = options.dbPath;
  const json = options.json;

  if (command === "dev") {
    const portFlag = takeFlag(rest, "--port");
    const port = portFlag.found ? Number(portFlag.value) : 4174;
    if (!Number.isInteger(port) || port < 0 || port > 65535) return fail("invalid-argument", "--port must be 0-65535", json, 2);
    const db = openDb(dbPath);
    migrate(db);
    if (!isSeeded(db)) seed(db, { hashPassword, demoPassword: process.env.FRUITLAB_DEMO_PASSWORD || "demo1234" });
    const { url } = await startStaticServer({ port, db, dbPath });
    out(`FruitLab 已启动: ${url}  (Ctrl+C 停止)`, false);
    return;
  }

  if (dbPath !== ":memory:" && !fs.existsSync(dbPath) && !["db"].includes(command)) {
    return fail("db-missing", "数据库不存在；请先运行 node cli.mjs db init && node cli.mjs db seed", json, 1);
  }
  const db = fs.existsSync(dbPath) || dbPath === ":memory:" ? openDb(dbPath) : null;

  try {
    if (command === "db") {
      const sub = rest.shift();
      if (sub === "init") {
        const d = openDb(dbPath);
        migrate(d);
        out(json ? { ok: true, data: { dbPath, schemaVersion: schemaVersion(d) } } : `建库完成: ${dbPath} (schema ${schemaVersion(d)})`, json);
        d.close();
        return;
      }
      if (sub === "seed") {
        const d = openDb(dbPath);
        migrate(d);
        seed(d, { hashPassword, demoPassword: process.env.FRUITLAB_DEMO_PASSWORD || "demo1234" });
        out(json ? { ok: true, data: { seeded: true, products: listProducts(d, { includeUnlisted: true }).length, users: listUsers(d).length } } : "种子写入完成", json);
        d.close();
        return;
      }
      if (sub === "reset") {
        const yes = takeFlag(rest, "--yes");
        if (!yes.found) return fail("confirmation-required", "db reset 需要 --yes（会删除现有数据库）", json, 1);
        if (fs.existsSync(dbPath)) {
          const backupDir = path.join(path.dirname(dbPath), "backups");
          fs.mkdirSync(backupDir, { recursive: true });
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const backup = path.join(backupDir, `${stamp}.db`);
          fs.copyFileSync(dbPath, backup);
          out(`已备份: ${backup}`, false);
          for (const suffix of ["", "-wal", "-shm"]) {
            try { fs.unlinkSync(dbPath + suffix); } catch { /* 不存在 */ }
          }
        }
        const d = openDb(dbPath);
        migrate(d);
        seed(d, { hashPassword, demoPassword: process.env.FRUITLAB_DEMO_PASSWORD || "demo1234" });
        out(json ? { ok: true, data: { reset: true } } : "数据库已重建并写入种子", json);
        d.close();
        return;
      }
      if (sub === "check") {
        const d = openDb(dbPath);
        const integrity = d.prepare("PRAGMA integrity_check").all();
        const fk = d.prepare("PRAGMA foreign_key_check").all();
        const version = schemaVersion(d);
        const counts = {
          products: d.prepare("SELECT COUNT(*) AS n FROM products").get().n,
          users: d.prepare("SELECT COUNT(*) AS n FROM users").get().n,
          orders: d.prepare("SELECT COUNT(*) AS n FROM orders").get().n,
          sessions: d.prepare("SELECT COUNT(*) AS n FROM sessions").get().n,
        };
        const ok = integrity.length === 1 && integrity[0].integrity_check === "ok" && fk.length === 0;
        out(json ? { ok, data: { integrity: integrity.map((r) => r.integrity_check), foreignKeyViolations: fk.length, schemaVersion: version, counts } } : { integrity: integrity.map((r) => r.integrity_check), foreignKeyViolations: fk.length, schemaVersion: version, counts }, json);
        d.close();
        process.exitCode = ok ? 0 : 1;
        return;
      }
      return fail("invalid-argument", `unknown db subcommand: ${sub ?? ""}`, json, 2);
    }

    if (command === "user") {
      const sub = rest.shift();
      if (sub === "list") {
        const users = listUsers(db);
        out(json ? { ok: true, data: users } : users.map((u) => `${u.username}\t${u.role}`).join("\n"), json);
        return;
      }
      if (sub === "add") {
        let argv = [...rest];
        const username = takeFlag(argv, "--username");
        argv = username.rest;
        const roleFlag = takeFlag(argv, "--role");
        argv = roleFlag.rest;
        const passwordStdin = takeFlag(argv, "--password-stdin");
        argv = passwordStdin.rest;
        const inlinePassword = takeFlag(argv, "--password");
        if (!username.found) return fail("invalid-argument", "--username 必填", json, 2);
        let password;
        if (passwordStdin.found) password = await readStdinPassword();
        else if (inlinePassword.found) password = inlinePassword.value;
        else return fail("invalid-argument", "需要 --password-stdin（推荐）或 --password", json, 2);
        const problem = validateCredentials({ username: username.value, password });
        if (problem) return fail(problem, "用户名或口令不符合规则", json, 1);
        const created = createUser(db, { username: username.value, password, role: roleFlag.found ? roleFlag.value : "user" });
        if (!created.ok) return fail(created.code, "创建用户失败", json, 1);
        out(json ? { ok: true, data: created.user } : `已创建用户: ${created.user.username} (${created.user.role})`, json);
        return;
      }
      return fail("invalid-argument", `unknown user subcommand: ${sub ?? ""}`, json, 2);
    }

    if (command === "product") {
      const sub = rest.shift();
      if (sub === "list") {
        const all = takeFlag(rest, "--all");
        const rows = listProducts(db, { includeUnlisted: all.found });
        out(json ? { ok: true, data: rows } : rows.map((p) => `${p.id}\t${p.name}\t${p.unitPriceCents}\t${p.stock}\t${p.listed ? "on" : "off"}`).join("\n"), json);
        return;
      }
      const kind = sub;
      const idFlag = takeFlag(rest, "--id");
      if (!idFlag.found) return fail("invalid-argument", "--id 必填", json, 2);
      if (kind === "unlist" || kind === "relist") {
        const result = updateProduct(db, idFlag.value, { listed: kind === "relist" ? 1 : 0 });
        if (!result.ok) return fail(result.code, "更新失败", json, 1);
        out(json ? { ok: true, data: result.product } : `${result.product.id} -> ${kind === "relist" ? "已上架" : "已下架"}`, json);
        return;
      }
      if (kind === "set-price") {
        const cents = takeFlag(rest, "--unit-price-cents").found ? takeFlag(rest, "--unit-price-cents").value : takeFlag(rest, "--cents").value;
        const result = updateProduct(db, idFlag.value, { unitPriceCents: Number(cents) });
        if (!result.ok) return fail(result.code, "更新失败", json, 1);
        out(json ? { ok: true, data: result.product } : `${result.product.id} 价格 -> ${result.product.unitPriceCents}`, json);
        return;
      }
      if (kind === "set-stock") {
        const value = takeFlag(rest, "--stock").found ? takeFlag(rest, "--stock").value : takeFlag(rest, "--units").value;
        const result = updateProduct(db, idFlag.value, { stock: Number(value) });
        if (!result.ok) return fail(result.code, "更新失败", json, 1);
        out(json ? { ok: true, data: result.product } : `${result.product.id} 库存 -> ${result.product.stock}`, json);
        return;
      }
      return fail("invalid-argument", `unknown product subcommand: ${kind ?? ""}`, json, 2);
    }

    if (command === "orders") {
      const sub = rest.shift();
      if (sub === "list") {
        const userFlag = takeFlag(rest, "--user");
        let rows;
        if (userFlag.found) {
          const user = findUserByUsername(db, userFlag.value);
          if (!user) return fail("order-not-found", "用户不存在", json, 1);
          rows = listOrdersByUser(db, user.id);
        } else {
          rows = listAllOrders(db);
        }
        out(json ? { ok: true, data: rows } : rows.map((o) => `${o.orderNumber}\t${o.subtotalCents}\t${o.createdAt}`).join("\n"), json);
        return;
      }
      if (sub === "show") {
        const orderNumber = rest[0];
        if (!orderNumber) return fail("invalid-argument", "orders show <orderNumber>", json, 2);
        const order = getOrderByNumber(db, orderNumber);
        if (!order) return fail("order-not-found", "订单不存在", json, 1);
        out(json ? { ok: true, data: order } : order, json);
        return;
      }
      return fail("invalid-argument", `unknown orders subcommand: ${sub ?? ""}`, json, 2);
    }

    return fail("invalid-argument", `unknown command: ${command}`, json, 2);
  } catch (error) {
    if (String(error?.message ?? "").includes("BUSY")) return fail("db-locked", "数据库被占用，请先停止服务或稍后重试", json, 3);
    return fail("internal-error", String(error?.message ?? error), json, 4);
  } finally {
    try { db?.close(); } catch { /* 已关闭 */ }
  }
}

main();
