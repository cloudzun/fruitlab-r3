# Azure VM 部署（R3.5）

> 目标：单台 Azure Ubuntu VM，Docker Compose 跑 web/api/db，宿主机 Caddy 终止 TLS。
> 当前实例（2026-10-19）：`vm-fruitlab-r3`，`eastasia`，`Standard_B2s`，DNS
> `fruitlab-r3-chengzh-sea.eastasia.cloudapp.azure.com`，公网 IP `20.239.58.133`。

## 1. 资源

| 项 | 值 |
|---|---|
| 订阅 | 当前 az CLI 登录的 MCT Benefit（不写入文档） |
| 资源组 | `rg-fruitlab-r3` |
| 区域 | `eastasia` |
| VM | `vm-fruitlab-r3`，Ubuntu 24.04 LTS，`Standard_B2s` |
| 网络 | NSG 开放 22/80/443；公网 IP `20.239.58.133` |
| DNS | `fruitlab-r3-chengzh-sea.eastasia.cloudapp.azure.com`（Azure 公网 IP DNS label） |
| 应用目录 | `/opt/fruitlab` |
| 备份目录 | `/var/backups/fruitlab` |

> 成本：B2s 按小时计费；不用时 `az vm deallocate -g rg-fruitlab-r3 -n vm-fruitlab-r3`。

## 2. 创建命令（已执行）

```bash
RG=rg-fruitlab-r3; LOC=eastasia; VM=vm-fruitlab-r3
az group create -n $RG -l $LOC
az vm create -n $VM -g $RG -l $LOC \
  --image Ubuntu2404 --size Standard_B2s \
  --admin-username azureuser \
  --ssh-key-values ~/.ssh/fruitlab_r3_ed25519.pub \
  --public-ip-sku Standard
az vm open-port -n $VM -g $RG --port 80 --priority 1001
az vm open-port -n $VM -g $RG --port 443 --priority 1002
az network public-ip update -g $RG -n ${VM}PublicIP --dns-name fruitlab-r3-chengzh-sea
```

SSH：

```bash
ssh -i ~/.ssh/fruitlab_r3_ed25519 azureuser@20.239.58.133
```

## 3. VM 初始化

```bash
bash setup-vm.sh          # 安装 Docker + Caddy，创建 /opt/fruitlab、/var/backups/fruitlab
# 重新登录（或 newgrp docker）使 docker 组生效
```

## 4. 部署资产

把 `deploy/vps/` 下文件传到 `/opt/fruitlab`：

```bash
scp -i ~/.ssh/fruitlab_r3_ed25519 -r deploy/vps/* azureuser@20.239.58.133:/opt/fruitlab/
```

在 VM 上：

```bash
cd /opt/fruitlab
cp .env.production.example .env.production
chmod 600 .env.production
# 编辑：PUBLIC_URL / POSTGRES_PASSWORD / ADMIN_PASSWORD / IMAGE_TAG
```

Caddy：

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

首次 DNS/证书生效前，Caddy 可能重试；确保 80/443 已开放。

## 5. 首次部署

```bash
cd /opt/fruitlab
./deploy.sh 3.5.0.0
curl -fsS https://fruitlab-r3-chengzh-sea.eastasia.cloudapp.azure.com/api/health
```

预期：`version=3.5.0.0`、`db=up`；production 仅创建 `admin`，无 `userA/userB`。

## 6. 运维

```bash
cd /opt/fruitlab

./deploy.sh 3.5.0.0                  # 部署/升级（自动备份 + 健康检查 + 失败回滚）
./rollback.sh                        # 回上一版（读 .previous_tag）
./backup.sh                          # 手工备份
./restore.sh /var/backups/fruitlab/fruitlab-YYYYmmdd-HHMMSS.dump
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 api web
```

systemd 每日备份：

```bash
sudo cp systemd/fruitlab-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fruitlab-backup.timer
systemctl list-timers fruitlab-backup.timer
```

## 7. 回滚

- 应用：`./rollback.sh`，或 `./deploy.sh <上一 tag>`；
- 数据库：`./restore.sh <dump>`（会停 api → pg_restore → 启 api → health）；
- 部署脚本在 health 失败时会自动尝试回滚到 `.previous_tag`。

## 8. 安全

- NSG 开放 22/80/443；SSH 只允许密钥登录；建议后续把 22 限制到管理 IP。
- `.env.production` 600；不提交、不打印。
- 生产：`APP_ENV=production`、`COOKIE_SECURE=1`、`ADMIN_PASSWORD` 强口令、空卷首启。
- 宿主机 Caddy 负责 TLS/HSTS；容器内 web Caddy 只监听 8080。
- Docker 日志已限 10 MB × 3。

## 9. 排障

| 现象 | 处理 |
|---|---|
| Caddy 证书失败 | 检查 DNS 解析、80/443、`journalctl -u caddy` |
| `classroom-data-present` | 用了开发卷；必须用 `fruitlab-r3-prod-pgdata` 空卷 |
| deploy 后 health 失败 | `docker compose ps`、`logs api`；脚本会自动回滚 |
| GitHub Actions SSH 失败 | 检查 `VPS_*` secrets、NSG 22、公钥 |
| 拉镜像慢/失败 | 用 GHCR 或配置镜像加速；确认 Docker Hub 可达 |

## 10. 关闭/清理

```bash
az vm deallocate -g rg-fruitlab-r3 -n vm-fruitlab-r3   # 停机省钱，保留磁盘
az group delete -n rg-fruitlab-r3 --yes                # 彻底删除（含 VM/磁盘/IP）
```
