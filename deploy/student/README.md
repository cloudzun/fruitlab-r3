# 学生 demo 启动（Killercoda/Linux + Docker，零配置）

> 两个 compose：默认 Docker Hub，国内专用 ACR。**同一时间只能起一个**（都占 4175）。
> **国内推荐**：Gitee compose + override（`DEMO_ALLOW_ANY_HOST=1`），不依赖 GitHub。
> `start-demo.sh` 是可选的一键脚本；阿里云 ECS 实测 GitHub raw 可能 `Connection reset`。
> **详细上机手册（入口：A/B/C + overview）**：[`docs/student/README.md`](../../docs/student/README.md)

## 0. 国内主路径（Gitee + ACR）

```bash
mkdir -p ~/fruitlab-demo && cd ~/fruitlab-demo
curl -fsSL https://gitee.com/cloudzun/fruitlab-r3/raw/main/deploy/student/docker-compose.cn.yml -o docker-compose.yml

cat > docker-compose.override.yml <<'EOF'
services:
  api:
    environment:
      DEMO_ALLOW_ANY_HOST: "1"
EOF

docker compose -f docker-compose.yml -f docker-compose.override.yml pull
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

Killercoda Traffic / 虚机安全组暴露 4175，打开对应 URL 即可；不需要设置 PUBLIC_URL。

## 0.1 可选：start-demo.sh（GitHub 可达时）

```bash
curl -fsSL https://raw.githubusercontent.com/cloudzun/fruitlab-r3/main/deploy/student/start-demo.sh -o start-demo.sh
bash start-demo.sh
```

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
