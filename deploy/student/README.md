# 学生本地一键启动（Docker）

> 前提：安装 Docker Desktop（Windows/macOS）或 Docker Engine（Linux），有网络能访问阿里云 ACR。
> **不需要登录阿里云**（前提：ACR 三个仓库已设为“公开”）。

## 启动

```bash
cd fruitlab-r3
docker compose -f deploy/student/docker-compose.yml up -d
```

打开 **http://127.0.0.1:4175**。

账号：

| 账号 | 口令 | 角色 |
|---|---|---|
| `userA` | `demo1234` | 普通用户 |
| `userB` | `demo1234` | 普通用户 |
| `admin` | `demo1234` | 管理员 |

## 检查

```bash
docker compose -f deploy/student/docker-compose.yml ps
curl http://127.0.0.1:4175/api/health
```

期望：

```json
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true}
```

## 停止 / 重置

```bash
# 停止，保留数据
docker compose -f deploy/student/docker-compose.yml down

# 停止并删数据（重新 seed）
docker compose -f deploy/student/docker-compose.yml down -v
```

## 镜像来源

三个镜像都在阿里云 ACR 公共仓库：

- `registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3:3.5.0.0`
- `registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3-web:3.5.0.0`
- `registry.cn-hangzhou.aliyuncs.com/chengzh/postgres:16-alpine`

如果镜像仓库不是公开的，`docker compose pull` 会报 `pull access denied`；需要先把 ACR 仓库设为“公开”。

## 常见问题

| 现象 | 处理 |
|---|---|
| `pull access denied` | ACR 仓库未公开；到 ACR 控制台把三个仓库设为公开 |
| 4175 被占用 | 改 compose 的 `4175:8080` 左侧端口，并同步 `PUBLIC_URL` |
| 页面能开但 API 403 `host-not-allowed` | 用 `127.0.0.1:4175` 打开；改端口时同步 `PUBLIC_URL` |
| 需要完全离线 | 先在能联网的机器 `docker pull` 三个镜像，`docker save` 后拷给学生 `docker load` |
