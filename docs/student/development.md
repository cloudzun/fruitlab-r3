# 克隆与二次开发（B Linux 虚机 / C 纯本地无 Docker）

> 目标：把仓库克隆下来，长期运行、改代码、跑测试、重新部署。
> A Killercoda 是临时沙盒，**不适合开发**；要开发请用 B 或 C。

## 0. 两种开发方式

| 方式 | 适合 | 需要 |
|---|---|---|
| **B. Docker 开发** | 有 Docker 的 Linux 虚机/本机 | Docker + compose |
| **C. 原生 Node/Postgres** | 没有 Docker、或想直接跑 Node | Node 22 + PostgreSQL 16 |

两者代码相同，区别只在“数据库怎么来、服务怎么起”。

## 1. 克隆仓库

```bash
git clone https://github.com/cloudzun/fruitlab-r3.git
cd fruitlab-r3
```

国内 GitHub 慢时可用 Gitee：

```bash
git clone https://gitee.com/cloudzun/fruitlab-r3.git
cd fruitlab-r3
```

## 2. 代码结构

| 路径 | 内容 |
|---|---|
| `server/` | `db`、`migrations/`、`repositories/`、`services/`、`router`、`app`、`auth` |
| `assets/` | 前端模块与商品图 |
| `tests/` | 真实 PG 集成 + 纯逻辑 + fake DOM + 客户端 |
| `scripts/` | 迁移、测试、校验、备份、启动 |
| `deploy/` | 生产 compose、学生 compose、启动脚本 |
| `docs/` | 架构、API、契约、部署、备份恢复 |

## 3. B：Docker 开发

### 3.1 起测试数据库

```bash
node scripts/pgctl.mjs up        # Docker 测试 Postgres，127.0.0.1:55432
```

### 3.2 安装依赖

```bash
npm ci
```

### 3.3 跑测试

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres \
  node --test --test-concurrency=4
```

### 3.4 本地源码启动（可选）

```bash
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres
node cli.mjs db migrate
node cli.mjs db seed
node cli.mjs dev --port 4175
```

### 3.5 改代码后重建容器

```bash
docker compose build
docker compose up -d
```

### 3.6 测试后清理

```bash
node scripts/pgctl.mjs down
```

## 4. C：纯本地无 Docker

### 4.1 安装

- Node.js **22**
- PostgreSQL **16**（本机服务，监听 5432 或自定义）
- 可选：`psql`、`createdb`

### 4.2 建库

```bash
sudo -u postgres createuser -P fruitlab
sudo -u postgres createdb -O fruitlab fruitlab
```

记下密码；下面用 `DATABASE_URL`。

### 4.3 安装依赖 + 迁移 + seed

```bash
cd fruitlab-r3
npm ci

export DATABASE_URL="postgres://fruitlab:你的密码@127.0.0.1:5432/fruitlab"
node cli.mjs db migrate
node cli.mjs db seed
```

### 4.4 启动

```bash
node cli.mjs dev --port 4175
```

打开：

```text
http://127.0.0.1:4175
```

### 4.5 跑测试（本机 PG）

测试夹具会为每个用例创建独立数据库，需要 `CREATEDB` 权限：

```bash
export TEST_DATABASE_URL="postgres://fruitlab:你的密码@127.0.0.1:5432/postgres"
node --test --test-concurrency=4
```

> 如果 `fruitlab` 用户没有 CREATEDB，用 postgres 超级用户跑测试，或给权限：
> `ALTER ROLE fruitlab CREATEDB;`

### 4.6 重置数据

```bash
node cli.mjs db reset --yes    # 会先备份
```

## 5. 开发工作流

1. 改代码（`server/`、`assets/`、`docs/`）；
2. 跑测试：`node --test --test-concurrency=4`；
3. 更新文档/契约（改 API/行为时）；
4. 重新启动：
   - B：`docker compose build && docker compose up -d`
   - C：重启 `node cli.mjs dev`
5. 需要发布镜像时：`docker build` / `Dockerfile.web`，推 Docker Hub/ACR；
6. 最终校验：`node scripts/verify.mjs`（需要 Docker/测试 PG）。

## 6. 持久化

- **B**：Docker named volume；`docker compose down` 保留，`down -v` 删除。
- **C**：本机 PostgreSQL 数据目录；备份用 `pg_dump`，重置需谨慎。
- 无论 B/C，订单都在 PostgreSQL，不在浏览器。

## 7. 常见开发注意

- 不要把 `DEMO_ALLOW_ANY_HOST=1` 带进 production；生产模式会自动忽略。
- 生产部署需要 `APP_ENV=production`、`ADMIN_PASSWORD`、`COOKIE_SECURE=1`。
- 不要把 `.env`、数据库密码、AK/SK 提交到仓库。
- 改 API 行为时同步 `docs/contracts.md`、`docs/error-catalog.md`。
- 改前端时真实浏览器验证，fake DOM 不能替代布局/焦点。
- A（Killercoda）不要用来开发；实例过期会丢文件和数据库。
