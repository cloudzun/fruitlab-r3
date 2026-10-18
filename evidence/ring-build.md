# 证据 · build 环（R3，3/7 环）

> 性质：真实执行记录。输入 `SPEC.md` v1.2 + `DECISIONS.md` 42 条义务。
> 结果：M1/M2/M3 完成；128 项测试全绿；三容器健康；备份/恢复实跑；`verify.mjs --full` 9/9 PASS。

## 1. 里程碑

| 里程碑 | 内容 | 状态 | 证据 |
|---|---|---|---|
| M1 | `package.json`(pg) + migrations + repositories/services/app + 真实 PG 测试基础设施 | 完成 | `tests/db.test.mjs`、`tests/auth.test.mjs`、`evidence/test-count.txt` |
| M2 | 11 缺陷 + 会话/限流/CSRF/时序/404；router/serve/cli | 完成 | `tests/api.test.mjs`、`tests/client.test.mjs`、`tests/cli.test.mjs` |
| M3 | Dockerfile ×2 + compose 三容器 + Caddy + 备份恢复 | 完成 | `evidence/container/`、`docs/deploy.md` |

## 2. 真实执行记录

### 2.1 依赖与测试

```powershell
npm install --no-audit --no-fund      # added 14 packages; pg@8.23.1
node --test --test-concurrency=4      # tests=128 pass=128 fail=0
node scripts/record-test-count.mjs    # evidence/test-count.txt（含 tree hash）
```

### 2.2 容器（WSL Docker 29.9.1 / Compose v5.6.0）

```text
docker compose build                  # fruitlab-r3:3.0.0.0 / fruitlab-r3-web:3.0.0.0 构建成功
docker compose up -d                  # db/api/web 三个服务
docker compose ps
  fruitlab-r3-api-1  Up (healthy)
  fruitlab-r3-db-1   Up (healthy)
  fruitlab-r3-web-1  Up (healthy)
```

- `curl http://127.0.0.1:4175/api/health` → `{"ok":true,"db":"up","schemaVersion":1,"seeded":true,...}`
- 首页 200（12221 bytes），CSP 由 Caddy 头下发；
- 非 root：api `id -u` = 1000、web `id -u` = 1000（db 为官方镜像，进程以 postgres 用户运行，记录为容器内非 root 进程）。

### 2.3 持久化（A5/AC-85）

1. 通过 4175 登录 + CSRF + 下单：`FL-20261018-033123-JCSP`；
2. `docker compose restart api db` → 重新登录 → 查该订单 **200**；
3. `docker compose down`（不删卷）+ `up -d` → 重新登录 → 查该订单 **200**。
证据：`evidence/container/after-restart-order.json`、`after-down-up-order.json`、`health-after-down-up.json`。

### 2.4 备份 / 恢复（A14/AC-87/AC-109）

```text
scripts/backup.sh            → backups/20261018-113216.dump (14057 bytes)
DELETE FROM order_items; DELETE FROM orders;
GET /api/orders/<num>        → 404（预期）
scripts/restore.sh <dump>    → 停 api → 断连 → pg_restore --single-transaction --exit-on-error → 校验 → 启 api
                             → products=14 users=3；GET 订单 → 200
```

证据：`evidence/container/backup-restore.log`、`after-restore-order.json`。

### 2.5 simple 两容器模式（AC-89）

```text
docker compose -f compose.simple.yml up -d
  fruitlab-r3-simple-api-1  Up (healthy)
  fruitlab-r3-simple-db-1   Up (healthy)
GET /api/health → {"ok":true,"db":"up",...}
```

随后恢复默认三容器栈（healthy）。证据：`evidence/container/simple-mode.log`。
**未验证**：simple 模式下的首页 HTML（当时 PowerShell 变量名冲突导致检查未执行），已在 §5 如实记录；默认三容器首页已验证。

### 2.6 全量验证

```text
node scripts/verify.mjs
PASS preflight --full
PASS node --test --test-concurrency=4
PASS check-links / check-numbering / check-traceability / check-redaction / check-docs-stale / verify-evidence / check-compose
PASS: 9/9 项通过（full）
```

## 3. 产物

- 代码：`server/db.mjs`、`server/migrations/0001_init.sql`、`server/repositories/*`、`server/services/*`、`server/app.mjs`、`server/router.mjs`、`server/allowlist.mjs`、`config.mjs`、`serve.mjs`、`cli.mjs`、`assets/api-client.mjs`；
- 容器：`Dockerfile`、`Dockerfile.web`、`Caddyfile`、`docker-compose.yml`、`compose.simple.yml`、`compose.debug.yml`、`.dockerignore`、`.env.example`；
- 脚本：`build-public`、`preflight`、`pgctl`、`check-docs-stale`、`check-compose`、`backup/restore`（sh+ps1）、`start-all`、`verify`、`record-test-count`；
- 文档：`docs/architecture.md`、`deploy.md`、`backup-restore.md`、`contracts.md`、`api.md`、`cli.md`、`error-catalog.md`、`obligations.md`；`BUILD.md`；
- 测试：128 项（真实 PG）。

## 4. 环境坑

| # | 坑 | 规避 |
|---:|---|---|
| 1 | Node `--test` 把 `scripts/test-pg.mjs` 当作测试文件执行（文件名匹配 `test-*`） | 改名 `scripts/pgctl.mjs`，避免与测试发现规则冲突 |
| 2 | Caddy `header_up Host {http.request.host}` 丢掉端口 → API Host 403 | 改 `{http.request.hostport}` 并重建 web 镜像 |
| 3 | PowerShell `$home` 是只读自动变量，导致 simple 模式首页检查报错 | 后续用 `$page` 等非保留变量；本条已如实记录为未验证 |
| 4 | `npm.cmd` 在 Windows spawnSync 下需 `shell:true` | preflight 中加 shell 选项 |
| 5 | 测试 helper 的 admin 连接未关闭导致 runner 不退出 | `createTestDatabase` 建库后立即 `admin.end()` |
| 6 | Node 测试发现规则会扫描 `scripts/` 与 `evidence/` 下的 `test-*`/`*.test.*` | 脚本命名避开 test 前缀；证据脚本不以 test 命名 |

## 5. 诚实边界

1. 容器验收在本机 **WSL Docker** 完成；未在 Docker Desktop 原生引擎复测（AC-51 的两种命令形态已写入 `docs/deploy.md`）。
2. simple 模式只验证了 health 与容器健康，未验证首页 HTML（见上）。
3. 未做真实浏览器 E2E（review 环之后由 qa 环执行）。
4. `implemented` 不等于 `verified`；review/qa 会逐项复核，最终判定在 ship 环。
5. 128 项测试全绿来自真实 Postgres（`postgres:16-alpine` 容器，`TEST_DATABASE_URL`），不是 SQLite 或 mock。
