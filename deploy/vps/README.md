# VPS 生产部署资产（R3.5）

> 目标机：Ubuntu 24.04 + Docker + 宿主机 Caddy；应用只监听 `127.0.0.1:4175`。
> 完整步骤见 [`../../docs/deploy-azure.md`](../../docs/deploy-azure.md)。

## 文件

| 文件 | 用途 |
|---|---|
| `docker-compose.prod.yml` | 生产三容器；api/db 不发布端口；web 只发 127.0.0.1:4175 |
| `.env.production.example` | 生产环境变量模板；复制为 `.env.production` 后 600 |
| `Caddyfile` | 宿主机 Caddy：TLS + 反代 127.0.0.1:4175 |
| `setup-vm.sh` | 一次性安装 Docker/Caddy、建目录 |
| `backup.sh` | pg_dump -Fc，保留 14 天 |
| `restore.sh` | 停 api → pg_restore → 起 api → health |
| `deploy.sh` | 备份 → pull → up → health；失败自动回滚 |
| `rollback.sh` | 切回 `.previous_tag` |
| `wait-health.sh` | 轮询 `/api/health` 直到 `db:up` |
| `systemd/` | 每日备份 service/timer |

## 首次

```bash
bash setup-vm.sh
cd /opt/fruitlab
cp .env.production.example .env.production && chmod 600 .env.production
# 编辑 PUBLIC_URL / POSTGRES_PASSWORD / ADMIN_PASSWORD / IMAGE_TAG
sudo cp Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
./deploy.sh 3.5.0.0
```

## 注意

- 生产必须用**空卷** `fruitlab-r3-prod-pgdata`；复用开发卷会触发 `classroom-data-present`。
- `deploy.sh` 需要 `.env.production` 与 `docker` 权限；首次登录后 `newgrp docker` 或重新 SSH。
- 不要在仓库中提交 `.env.production`。
