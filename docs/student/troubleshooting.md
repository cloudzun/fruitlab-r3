# 学生环境排错（A/B/C 共用）

## 1. 启动类

| 现象 | 处理 |
|---|---|
| `docker: command not found` | 装 Docker；Killercoda 选 Docker playground，或按 quickstart 安装 |
| `docker compose` 不是命令 | 安装 `docker-compose-v2`；或升级 Docker |
| `Cannot connect to the Docker daemon` | `sudo service docker start`；Docker Desktop 要启动引擎 |
| `permission denied ... docker.sock` | `sudo usermod -aG docker $USER; newgrp docker` |
| 4175 被占用 | `ss -ltnp \| grep 4175` 找进程；或停旧 compose；或改端口并同步 `PUBLIC_URL` |
| 容器一直 `starting` | `docker compose logs --tail=100 api` / `db` / `web` |

## 2. 页面 / API

| 现象 | 处理 |
|---|---|
| 页面 403 `host-not-allowed` | 确认用的是**新版镜像/新版源码** + `DEMO_ALLOW_ANY_HOST=1`；`docker compose pull` 后 `up -d --force-recreate` |
| 页面打不开 | Killercoda 是否 Traffic 暴露 4175；虚机安全组是否放行 4175 |
| 首页能开、登录 403 | 旧镜像/旧 override；检查 `DEMO_ALLOW_ANY_HOST`；旧克隆先 `git pull` |
| API 403 `cross-origin-blocked` | 用 demo 模式，或让 `PUBLIC_URL` 与浏览器地址完全一致 |
| 127.0.0.1 能开，局域网 IP 打不开 | `HOST=0.0.0.0`；防火墙/安全组放行端口；确认同一网段 |
| localhost 能开、登录 403 | 用 `127.0.0.1`，或 `PUBLIC_URL=http://localhost:<port>`，或开 demo 模式 |
| `/api/health` 503 | 看 api 日志；数据库未 healthy/密码错 |
| 购物袋能加、结账无反应 | 打开控制台看 `/api/orders` 响应；大概率未登录或 CSRF |

## 3. 数据库

| 现象 | 处理 |
|---|---|
| `DATABASE_URL is required` | 设置 `DATABASE_URL` 环境变量 |
| `password authentication failed` | 检查用户名/密码/库名；C 方式检查 `pg_hba.conf` |
| `database ... does not exist` | 先 `createdb` 或 `node cli.mjs db migrate` 前建库 |
| `relation ... does not exist` | 没迁移：`node cli.mjs db migrate` |
| 测试报 `测试 Postgres 不可用` | `node scripts/pgctl.mjs up`；或设置 `TEST_DATABASE_URL` |
| 测试建库失败 | 用户需要 `CREATEDB` 权限 |
| 订单没了 | 执行过 `down -v` / `db reset`；检查卷/数据目录 |

## 4. 镜像

| 现象 | 处理 |
|---|---|
| Docker Hub 拉取超时 | 用 `docker-compose.cn.yml`（阿里云 ACR 公开镜像） |
| ACR `pull access denied` | 确认是公开仓库；`docker logout registry.cn-hangzhou.aliyuncs.com` 后重试 |
| 改了代码但容器没变 | B：`docker compose build && up -d`；C：重启 `node cli.mjs dev` |
| 镜像架构警告（Apple Silicon） | 当前镜像为 linux/amd64；Docker Desktop 开启 Rosetta/模拟，或使用 amd64 Linux |

## 5. Killercoda / Linux 虚机

| 现象 | 处理 |
|---|---|
| Killercoda 实例过期 | 数据不保留；重开实例，重跑 quickstart A |
| Traffic 没有 4175 | 先让容器跑起来，再输入 4175；或换端口 |
| 虚机公网 IP 访问不了 | 安全组入方向放行 4175；确认服务监听 `0.0.0.0` |
| 虚机重启后容器没起来 | `restart: unless-stopped` 应自动起；否则 `docker compose up -d` |
| SSH 进不去 | 云厂商安全组 22、密钥/用户；与 FruitLab 无关 |

## 6. 提交前检查

```bash
docker compose ps
curl -sS http://127.0.0.1:4175/api/health
docker compose logs --tail=50 api
```

期望 health：

```json
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true}
```
