# 一键复现 Azure VM 演示（R3.5）

> **状态：Azure 演示资源已删除；脚本保留用于复现。**
> 脚本：`deploy/azure/az-vm-demo.ps1`
> 目标：在**独立资源组**里从零创建 Azure VM，安装 Docker + Caddy，部署 `3.5.0.0`，并跑生产冒烟。
> 默认 `rg-fruitlab-demo` / `vm-fruitlab-demo`，**不会影响**现有 `rg-fruitlab-r3` 生产 VM。

## 1. 前置

| 项 | 要求 |
|---|---|
| Azure CLI | 已 `az login`（脚本会检查，当前订阅显示 MCT Benefit） |
| PowerShell | Windows PowerShell 5.1+（已兼容）或 PowerShell 7 |
| OpenSSH | `ssh`、`scp`、`ssh-keygen` 可用 |
| tar | Windows 自带 `tar` 可用 |
| 镜像 | Docker Hub `chengzh/fruitlab-r3:3.5.0.0` public |
| 费用 | `Standard_B2s` 按小时计费；演示完 `stop` 或 `destroy` |

## 2. 快速开始

```powershell
cd D:\vibecoding\easyvibe\r3-fruitlab

# 1) 只看计划，不创建资源
powershell -ExecutionPolicy Bypass -File .\deploy\azure\az-vm-demo.ps1 -Action plan

# 2) 一键创建 + 部署（首次约 5–8 分钟）
powershell -ExecutionPolicy Bypass -File .\deploy\azure\az-vm-demo.ps1 -Action up

# 3) 查看状态
powershell -ExecutionPolicy Bypass -File .\deploy\azure\az-vm-demo.ps1 -Action status
```

成功后会打印：

```text
URL     : https://<dns-label>.eastasia.cloudapp.azure.com
管理员  : admin / <随机生成，仅本次输出>
口令文件: deploy/azure/.secrets/<rg>-<vm>.env（已 gitignore）
```

## 3. 复用/更新

```powershell
# 同一资源组/VM 上重新部署（保留数据库与环境）
powershell -ExecutionPolicy Bypass -File .\deploy\azure\az-vm-demo.ps1 -Action deploy

# 指定镜像 tag
powershell -ExecutionPolicy Bypass -File .\deploy\azure\az-vm-demo.ps1 -Action deploy -ImageTag 3.5.0.0

# 已有 VM 再执行 up：会复用 VM、保留 .env.production，仅更新 Caddy/应用
powershell -ExecutionPolicy Bypass -File .\deploy\azure\az-vm-demo.ps1 -Action up
```

## 4. 停止/销毁

```powershell
# 停机省钱（保留磁盘/数据，可再 start）
powershell -ExecutionPolicy Bypass -File .\deploy\azure\az-vm-demo.ps1 -Action stop

# 彻底删除资源组（VM/磁盘/IP；需 -Force 或交互确认 DELETE）
powershell -ExecutionPolicy Bypass -File .\deploy\azure\az-vm-demo.ps1 -Action destroy -Force
```

## 5. 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `-Action` | `up` | `plan/status/deploy/up/stop/destroy` |
| `-ResourceGroup` | `rg-fruitlab-demo` | 独立资源组 |
| `-VmName` | `vm-fruitlab-demo` | VM 名 |
| `-Location` | `eastasia` | 香港节点 |
| `-VmSize` | `Standard_B2s` | 2 vCPU/4 GB |
| `-DnsLabel` | 随机 `fruitlab-demo-xxxxxx` | 全局唯一；决定 URL |
| `-ImageTag` | `3.5.0.0` | Docker Hub 镜像 tag |
| `-SshKeyPath` | `~/.ssh/fruitlab_demo_ed25519` | 不存在会自动生成 |

## 6. 脚本做了什么

1. 检查 `az login` / `ssh` / `scp` / `tar`；
2. 创建或复用资源组、VM（Ubuntu 24.04，`Standard_B2s`）；
3. 开放 NSG 80/443；设置公网 IP DNS label；
4. 上传 `deploy/vps/` 资产；`setup-vm.sh` 安装 Docker + Caddy；
5. 生成随机生产口令（本地 `.secrets/`，不提交）；首次上传 `.env.production`；
6. 生成带当前域名和 HSTS 的 Caddyfile，reload Caddy；
7. `./deploy.sh <tag>` 拉镜像、启动三容器、健康检查（失败自动回滚）；
8. 等待 HTTPS（Let's Encrypt）+ `./smoke.sh`（admin 登录 / userA 401 / 下单）；
9. 打印 URL、管理员口令、停止/销毁命令。

## 7. 注意

- NSG 当前开放 22/80/443；仅用于课堂/演示，不建议长期暴露 SSH。
- 首次部署必须空卷；脚本默认新资源组，天然满足。复用旧 VM 时保留 `.env.production` 与卷。
- 若 DNS label 已被占用，`az network public-ip update` 会失败；换 `-DnsLabel` 重试。
- 证书失败时脚本会打印 Caddy 最近日志；常见原因：80/443 未放行、DNS 未解析、Caddy 邮箱为 example.com（本脚本不配置邮箱）。
- 口令文件在 `deploy/azure/.secrets/`，已被 `.gitignore` 排除；不要提交或截图外发。
