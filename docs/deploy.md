# R3 部署（本地容器）

> 本机现实：Windows Docker Desktop 引擎未运行，**所有 compose 命令经 WSL 执行**。有 Docker Desktop 时可直接用 `docker compose`。

## 1. 前置

| 项 | 要求 |
|---|---|
| Node | ≥ 22（本机 `v22.20.0`） |
| Docker | WSL Docker `29.9.1`（或 Docker Desktop） |
| Compose | `v5.6.0`（WSL） |
| 镜像 | `postgres:16-alpine`、`node:22-alpine`、`caddy:2-alpine` |
| 端口 | `4175`（web）；调试 `55432`（db） |

## 2. 快速开始（WSL）

```bash
cd /mnt/d/vibecoding/easyvibe/r3-fruitlab
cp .env.example .env          # 填 POSTGRES_PASSWORD / DEMO_PASSWORD / ADMIN_PASSWORD
wsl -e docker compose -f /mnt/d/vibecoding/easyvibe/r3-fruitlab/docker-compose.yml up --build -d
curl -s http://127.0.0.1:4175/api/health
```

Windows 侧等价：`wsl -e bash -lc 'cd /mnt/d/vibecoding/easyvibe/r3-fruitlab && docker compose up --build -d'`。

## 3. 服务

| 服务 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| `web` | `fruitlab-r3-web:3.0.0.0` | `4175:8080` | Caddy 静态 + `/api` 反代；非 root；`/healthz` |
| `api` | `fruitlab-r3:3.0.0.0` | 仅内网 `3000` | Node + pg；启动迁移/seed；`/api/health` |
| `db` | `postgres:16-alpine` | 仅内网 `5432` | volume `fruitlab-r3-pgdata`；`pg_isready` |

- compose 项目名 `fruitlab-r3`；`compose.debug.yml` 额外映射 `55432:5432`；
- `compose.simple.yml`：api+db 两容器，api 暴露 `4175:3000`、`SERVE_STATIC=1`。

## 4. 环境变量（`.env`）

| 变量 | 说明 |
|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` / `POSTGRES_PASSWORD` | 同源生成 db 容器、`DATABASE_URL`、`pg_isready`、备份参数 |
| `APP_ENV` | `development`（classroom）或 `production` |
| `ADMIN_PASSWORD` | production 必填（≥12、非默认） |
| `DEMO_PASSWORD` | classroom 演示口令（默认 `demo1234`，禁止上公网） |
| `COOKIE_SECURE` | production 必须 `1` |
| `SESSION_TTL_SECONDS` | 会话有效期（默认 86400） |
| `PUBLIC_URL` | 外部访问源（默认 `http://127.0.0.1:4175`） |
| `TRUST_PROXY` | 经 Caddy 时 `1`；直连 simple 模式 `0` |

## 5. 运维

```bash
# 健康
curl -s http://127.0.0.1:4175/api/health
# 备份（停写后）
wsl -e bash scripts/backup.sh
# 恢复（停 api → pg_restore --single-transaction → 校验 → 启 api）
wsl -e bash scripts/restore.sh backups/<file>.dump
# 日志/状态
wsl -e docker compose -f /mnt/d/vibecoding/easyvibe/r3-fruitlab/docker-compose.yml ps
```

## 6. 排障

| 现象 | 排查 |
|---|---|
| 4175 打不开 | `docker compose ps`；web healthcheck；端口占用 |
| `/api/health` 503 | api 日志的 `stage`/SQLSTATE；db healthcheck；`DATABASE_URL` 身份 |
| 403 host-not-allowed | 用 `127.0.0.1:4175` 或 PUBLIC_URL；确认 Caddy 保留 Host |
| 401/403 写请求 | 先 GET 拿 CSRF cookie；检查 `X-CSRF-Token` |
| 数据没了 | 确认 volume 未被 `down -v`；`docker volume ls` |
