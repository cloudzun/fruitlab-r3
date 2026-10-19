# FruitLab R3.5 · Postgres + 三层架构 + 可部署 + CI/CD

[![ci](https://github.com/cloudzun/fruitlab-r3/actions/workflows/ci.yml/badge.svg)](https://github.com/cloudzun/fruitlab-r3/actions/workflows/ci.yml)
[![release](https://github.com/cloudzun/fruitlab-r3/actions/workflows/release.yml/badge.svg)](https://github.com/cloudzun/fruitlab-r3/actions/workflows/release.yml)
[![docker](https://img.shields.io/badge/docker-chengzh%2Ffruitlab--r3-blue)](https://hub.docker.com/r/chengzh/fruitlab-r3)

> **版本**：`3.5.0.0`（`VERSION`；npm 包版本 `3.5.0`，见 `package.json`）
> **仓库**：<https://github.com/cloudzun/fruitlab-r3>（public）
> **形态**：PostgreSQL 16 + L1（router → services → repositories）+ L2（Caddy web / Node api / Postgres db）
> **依赖**：运行时恰好 `{pg}`（R1/R2 仍为零依赖，互不影响）
> **对应课程**：GStack 七环迭代第三幕 + R3.5 部署收口（spec → build/deploy → review+qa → ship）
> **线上**：<https://fruitlab-r3-chengzh-sea.eastasia.cloudapp.azure.com>（Azure VM + Caddy TLS，3.5.0.0）
> **部署/CI**：[docs/deploy-azure.md](docs/deploy-azure.md)、[docs/ci-cd.md](docs/ci-cd.md)、[R3.5-执行记录.md](R3.5-执行记录.md)、[R3.5-retro.md](R3.5-retro.md)
> **一键复现（Azure VM）**：[`deploy/azure/az-vm-demo.ps1`](deploy/azure/az-vm-demo.ps1)（`-Action plan/up/status/deploy/stop/destroy`；独立资源组，不碰现有生产 VM）
> **国内 Demo（阿里云杭州）**：[`deploy/aliyun/README.md`](deploy/aliyun/README.md)（IP:4175 + HTTP，无域名/TLS；ACR 镜像）

## 1. 三个版本（课堂并排）

| 版本 | 目录 | 端口 | 数据 | 启动 |
|---|---|---|---|---|
| R1（升级前，永久冻结） | `..\r1-fruitlab` | 4173 | `localStorage` | `node serve.mjs` |
| R2（第二次升级，冻结） | `..\r2-fruitlab` | 4174 | `data/fruitlab.db`（SQLite） | `node cli.mjs dev` |
| **R3（本轮）** | 本目录 | **4175** | Postgres volume `fruitlab-r3-pgdata` | `docker compose up --build` |

> R3.5 在 R3 基础上只加部署与 CI/CD：GitHub public 仓库、GitHub Actions CI、tag 触发 Docker Hub/GHCR 发布、Azure VM + Caddy 生产部署、备份/回滚。见 [`docs/ci-cd.md`](docs/ci-cd.md)、[`docs/deploy-azure.md`](docs/deploy-azure.md)。

三版本同时启动、互不共享数据；R3 不修改 R1/R2。一键启动：`node scripts/start-all.mjs`（R2 使用仓库外临时 SQLite 文件，重启不丢数据）。

## 2. 快速开始（WSL Docker）

> 本机 Windows Docker Desktop 引擎未运行，命令经 WSL 执行；有 Docker Desktop 时可直接用 `docker compose`。

```bash
cd /mnt/d/vibecoding/easyvibe/r3-fruitlab
cp .env.example .env
# 填 POSTGRES_PASSWORD / DEMO_PASSWORD（classroom）
wsl -e docker compose -f /mnt/d/vibecoding/easyvibe/r3-fruitlab/docker-compose.yml up --build -d
curl -s http://127.0.0.1:4175/api/health
```

Windows 侧：`wsl -e bash -lc 'cd /mnt/d/vibecoding/easyvibe/r3-fruitlab && docker compose up --build -d'`。
停止：`wsl -e docker compose -f /mnt/d/vibecoding/easyvibe/r3-fruitlab/docker-compose.yml down`（不删卷）。

演示账号（classroom）：`userA` / `userB` / `admin`，口令 `demo1234`（仅本地课堂；生产见 §6）。

## 3. 本机开发（不走容器）

```powershell
wsl -e docker run -d --rm --name fruitlab-r3-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine
$env:DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:55432/postgres"
node cli.mjs db migrate
node cli.mjs db seed
node cli.mjs dev --port 4175        # 静态 + API（SERVE_STATIC 默认 false，dev 会打开）
```

## 4. 测试与验证

```powershell
node scripts/pgctl.mjs up        # 测试 Postgres（WSL 或原生 Docker）
node --test --test-concurrency=4 # 138 项：真实 PG + 纯逻辑 + fake DOM + 客户端
node scripts/record-test-count.mjs
node scripts/verify.mjs --quick  # 纯逻辑/静态/编号/链接（无需 Docker）
node scripts/verify.mjs          # preflight + 测试 + 全部机械检查 + compose 配置
```

- 测试计数唯一来源：[`evidence/test-count.txt`](evidence/test-count.txt)（含 git tree hash）。
- 测试前置：Node ≥22 + Postgres 16 容器；不满足时测试 fail fast 并给出启动命令。

## 5. R3 改了什么（breaking）

- **数据库**：SQLite 单文件 → PostgreSQL 16（不迁移 R2 数据，重新迁移 + seed）。
- **依赖**：零依赖 → 恰好 `{pg}`（R2 仍零依赖；口径不混用）。
- **分层**：`server/*` 拆为 `repositories/` + `services/` + 组合根 `app.mjs`；依赖规则由测试强制。
- **安全**：会话过期/轮换、登录限流（账号+IP）、CSRF 双提交、dummy scrypt 时序、他人订单 404。
- **部署**：Dockerfile ×2 + compose 三容器 + Caddy 反代 + 非 root + healthcheck + 备份/恢复。
- **CLI**：`--db` → `--url`；`db init` → `db migrate`；新增 `db backup/restore`。
- 完整契约对照：[`docs/contracts.md`](docs/contracts.md)；决策流水：[`docs/decision-log.md`](docs/decision-log.md)。

## 6. 安全边界（如实声明）

- classroom 默认口令 `demo1234` 只允许本地；`APP_ENV=production` 必须提供独立 `ADMIN_PASSWORD`（≥12、非默认）、`COOKIE_SECURE=1`，且不创建 `userA/userB`。
- 未做 HTTPS 证书（生产部署时由反代提供）；无审计日志、无多租户、无水平扩展。
- 限流是单实例内存实现，进程重启清零；不防分布式撞库。
- 他人订单 404（存在性隐藏）取代 R2 的 403（D-32 superseded）。

## 7. 目录

| 路径 | 说明 |
|---|---|
| `server/` | `db`、`migrations/`、`repositories/`、`services/`、`router`、`app`、`allowlist`、`errors`、`seed` |
| `assets/` | 前端模块（含 `api-client` 的 CSRF/超时）与 14 张商品图 |
| `tests/` | 真实 PG 集成 + 纯逻辑 + fake DOM + 客户端 + 分层/静态/契约 |
| `scripts/` | preflight、pgctl、verify、record-test-count、check-*、backup/restore、start-all、build-public |
| `docs/` | architecture、deploy、backup-restore、contracts、api、cli、error-catalog、obligations、decision-log |
| `evidence/` | 逐环证据、唯一计数、容器/备份恢复证据、codex/cso 报告、visual |

## 8. 证据与复盘

- 证据索引：[`evidence/index.md`](evidence/index.md)
- 本轮规格与评审：[`SPEC.md`](SPEC.md)（v1.2）、[`DECISIONS.md`](DECISIONS.md)（42 条义务）
- 构建：[`BUILD.md`](BUILD.md)；复核：[`review.md`](review.md)；QA：[`qa-report.md`](qa-report.md)；复盘：[`retro.md`](retro.md)
- 项目总交接：`通用AI_Coding课程与教材/HANDOFF.md` 第七节

## 9. License

- **代码**（`server/`、`assets/`、`scripts/`、`*.mjs`、`*.html`、`*.css` 等）：[MIT](LICENSE)
- **文档与证据**（`docs/`、`evidence/`、`SPEC.md`、`DECISIONS.md`、`BUILD.md`、`review.md`、`qa-report.md`、`retro.md` 等）：[CC BY-NC-SA 4.0](LICENSE-DOCS)
