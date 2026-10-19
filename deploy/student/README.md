# 学生 demo 启动（Killercoda/Linux + Docker，零配置）

> 两个 compose：默认 Docker Hub，国内专用 ACR。**同一时间只能起一个**（都占 4175）。
> **推荐零配置启动**：`start-demo.sh`（自动注入 `DEMO_ALLOW_ANY_HOST=1`，Killercoda/ECS/Azure/ngrok 通用）。
> **详细上机手册（入口：A/B/C + overview）**：[`docs/student/README.md`](../../docs/student/README.md)

## 0. 一条命令（Killercoda 里）

```bash
curl -fsSL https://raw.githubusercontent.com/cloudzun/fruitlab-r3/main/deploy/student/start-demo.sh -o start-demo.sh
bash start-demo.sh
```

Killercoda Traffic 暴露 4175，打开生成的 URL 即可；不需要设置 PUBLIC_URL。

## 1. 默认：Docker Hub

```bash
docker compose -f deploy/student/docker-compose.yml up -d
```

镜像：

- `chengzh/fruitlab-r3:3.5.0.0`
- `chengzh/fruitlab-r3-web:3.5.0.0`
- `postgres:16-alpine`（Docker Hub 官方）

不需要登录 Docker Hub。

## 2. 国内专用：阿里云 ACR

```bash
docker compose -f deploy/student/docker-compose.cn.yml up -d
```

镜像：

- `registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3:3.5.0.0`
- `registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3-web:3.5.0.0`
- `registry.cn-hangzhou.aliyuncs.com/chengzh/postgres:16-alpine`

不需要登录阿里云，三个仓库已公开。

## 3. 打开

**http://127.0.0.1:4175**

| 账号 | 口令 | 角色 |
|---|---|---|
| `userA` | `demo1234` | 普通用户 |
| `userB` | `demo1234` | 普通用户 |
| `admin` | `demo1234` | 管理员 |

## 4. 检查

```bash
docker compose -f deploy/student/docker-compose.yml ps
curl http://127.0.0.1:4175/api/health
```

期望：

```json
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true}
```

## 5. 切换/停止

```bash
# 停默认
docker compose -f deploy/student/docker-compose.yml down

# 停国内
docker compose -f deploy/student/docker-compose.cn.yml down

# 连数据一起删
docker compose -f deploy/student/docker-compose.yml down -v
docker compose -f deploy/student/docker-compose.cn.yml down -v
```

## 6. 常见问题

| 现象 | 处理 |
|---|---|
| Docker Hub 拉取慢/失败 | 改用 `docker-compose.cn.yml`（阿里云 ACR） |
| ACR `pull access denied` | 确认三个 ACR 仓库已公开；或先 `docker login` ACR |
| 4175 被占用 | 先 `down` 当前 compose；或改端口并同步 `PUBLIC_URL` |
| API 403 `host-not-allowed` | 用 `127.0.0.1:4175` 打开；改端口时同步 `PUBLIC_URL` |
| 完全离线 | 在有网机器 `docker pull` 三个镜像，`docker save`，学生机 `docker load` |
