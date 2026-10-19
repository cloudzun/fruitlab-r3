# 克隆与二次开发（B Linux 虚机 / C 纯本地无 Docker）

> 目标：把仓库克隆下来，长期运行、改代码、跑测试、重新部署。
> A Killercoda 是临时沙盒，**不适合开发**；要开发请用 B 或 C。

## 0. 两种开发方式

| 方式 | 适合 | 需要 |
|---|---|---|
| **B. Docker 开发** | 有 Docker 的 Linux 虚机/本机 | Docker + compose |
| **C. 原生 Node/Postgres** | 没有 Docker、或想直接跑 Node | Node 22 + PostgreSQL 16 |

两者代码相同，区别只在“数据库怎么来、服务怎么起”。

## 1. 克隆仓库（国内优先 Gitee）

```bash
git clone https://gitee.com/cloudzun/fruitlab-r3.git
cd fruitlab-r3
```

GitHub 可达时也可以：

```bash
git clone https://github.com/cloudzun/fruitlab-r3.git
cd fruitlab-r3
```

> 实测：阿里云 ECS 访问 GitHub raw 可能 `Connection reset`；Gitee clone 正常。

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

### 4.1 安装 Node 22 + PostgreSQL 16（Ubuntu 24.04 实测）

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib xz-utils
sudo service postgresql start

cd /tmp
curl -fsSL https://nodejs.org/dist/v22.20.0/node-v22.20.0-linux-x64.tar.xz -o node22.tar.xz
sudo tar -xJf node22.tar.xz -C /opt
sudo ln -sf /opt/node-v22.20.0-linux-x64/bin/node /usr/local/bin/node
sudo ln -sf /opt/node-v22.20.0-linux-x64/bin/npm /usr/local/bin/npm
sudo ln -sf /opt/node-v22.20.0-linux-x64/bin/npx /usr/local/bin/npx

node --version      # v22.20.0
psql --version      # 16.x
```

> 国内下载 nodejs.org 慢时，可用国内镜像；只要保证 Node 22 即可。

### 4.2 建库

```bash
sudo -u postgres psql -c "CREATE USER fruitlab WITH PASSWORD 'fruitlab-demo-pass' CREATEDB;"
sudo -u postgres createdb -O fruitlab fruitlab
```

> 测试夹具需要 `CREATEDB`；生产环境不要用 demo 密码。

### 4.3 安装依赖 + 迁移 + seed

```bash
cd fruitlab-r3
npm ci

export DATABASE_URL="postgres://fruitlab:fruitlab-demo-pass@127.0.0.1:5432/fruitlab"
node cli.mjs db migrate
node cli.mjs db seed
```

### 4.4 本机 + 局域网启动（推荐，两个地址都可用）

```bash
export DATABASE_URL="postgres://fruitlab:fruitlab-demo-pass@127.0.0.1:5432/fruitlab"
export HOST=0.0.0.0
export DEMO_ALLOW_ANY_HOST=1
export COOKIE_SECURE=0

node cli.mjs dev --port 4176
```

本机和局域网都可以直接访问：

```text
http://127.0.0.1:4176
http://<本机局域网IP>:4176      # 例如 http://192.168.1.114:4176
```

> 这里用 `DEMO_ALLOW_ANY_HOST=1` 跳过 Host/Origin 白名单，所以不需要设置 `PUBLIC_URL`。
> 该开关只在**非 production** 生效；生产仍严格校验。
> 如果 C 目录是旧克隆、没有这个开关，先 `git pull` 更新。

### 4.5 局域网访问的防火墙

Windows 管理员 PowerShell：

```powershell
New-NetFirewallRule -DisplayName "FruitLab 4176" -Direction Inbound -Protocol TCP -LocalPort 4176 -Action Allow
```

Linux：

```bash
sudo ufw allow 4176/tcp
```

> 只要 `HOST=0.0.0.0` + 防火墙放行，同一局域网的其他机器就能用 `http://<你的IP>:4176` 访问；
> `127.0.0.1` 和局域网 IP 可以同时用，不需要改代码/镜像。

### 4.6 严格模式（可选）

如果不用 `DEMO_ALLOW_ANY_HOST=1`，就要让浏览器地址与 `PUBLIC_URL` 完全一致，例如：

```bash
HOST=0.0.0.0 PUBLIC_URL=http://192.168.1.114:4176 node cli.mjs dev --port 4176
```

此时 `127.0.0.1` 和局域网 IP **不能同时**免配置使用；只选一个地址。

### 4.7 跑测试（本机 PG）

```bash
export TEST_DATABASE_URL="postgres://fruitlab:fruitlab-demo-pass@127.0.0.1:5432/postgres"
node --test --test-concurrency=4
```

> 如果 `fruitlab` 用户没有 CREATEDB，用 postgres 超级用户跑测试，或：
> `ALTER ROLE fruitlab CREATEDB;`

### 4.8 重置数据

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
- 国内网络：GitHub raw 可能被 reset；优先用 Gitee 下载/克隆。
