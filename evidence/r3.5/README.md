# R3.5 证据索引（部署与 CI/CD）

> 版本 `3.5.0.0`；public repo <https://github.com/cloudzun/fruitlab-r3>；Azure VM `fruitlab-r3-chengzh-sea.eastasia.cloudapp.azure.com`。
> 本目录只放可核对输出；不含密码、私钥、订阅 ID。

| 文件 | 内容 |
|---|---|
| `github-actions.txt` | GitHub Actions 运行列表（CI/release/deploy） |
| `github-actions.md` | 流水线说明、失败与修复记录 |
| `digests.txt` | Docker Hub / GHCR 镜像 digest |
| `azure-vm.json` | Azure VM 基本信息（名称/区域/规格/IP/DNS） |
| `vm-state.txt` | VM 上三容器、users、备份、timer |
| `tls.txt` | HTTP→HTTPS、HSTS、证书、health |
| `prod-smoke.txt` | 生产冒烟：admin 登录 200、userA 401、下单 201、订单数 |
| `backup-restore.txt` | 备份 → 删订单 → 恢复 → 计数回来 |
| `rollback.txt` | 3.5 → 3.0 → rollback → 3.5 |
| `az-vm-demo-test.txt` | `deploy/azure/az-vm-demo.ps1` 从零创建测试 VM → 部署 → 销毁的端到端验证 |
| `aliyun-demo.md` | 阿里云杭州 ECS + IP:4175 + HTTP + ACR 镜像的实测证据 |

## 关键结论

- CI：138/138 通过（run `39175247654`、`39175675684`、`39176200583`）。
- Release：Docker Hub + GHCR 双推成功（run `39176206939`）；digest 见 `digests.txt`。
- Deploy：GitHub Actions SSH → VM `deploy.sh` 成功（同一 run 的 deploy job）。
- 生产冒烟：admin 登录 200；userA 401；下单 201（`FL-20261018-232521-D2QC`）；订单数 2。
- TLS：Let's Encrypt 证书有效；HTTP 308 → HTTPS；HSTS。
- 备份/恢复：`after_delete=0` → `after_restore=2`。
- 回滚：3.0.0.0 → `rollback.sh` → 3.5.0.0，health 版本随之切换。
- 一键脚本：`deploy/azure/az-vm-demo.ps1` 已在独立测试资源组端到端跑通并销毁（见 `az-vm-demo-test.txt`）。

## 失败与修复（如实记录）

1. CI 首次失败：npmmirror 504 → lock `resolved` 改 npmjs。
2. Release workflow dispatch 404：workflow 不在 default branch → 合并到 main 后 dispatch。
3. 首次 deploy health 失败 `host-not-allowed`：内网 curl 未带 Host → `wait-health.sh` 加 `Host: <PUBLIC_URL host>`。
4. Caddy 证书失败：`email admin@example.com` 被 LE 判 invalidContact → 去掉 email；清 Caddy ACME 状态后重新签发成功。
5. GitHub deploy 首次失败：known_hosts secret 换行/CR 不匹配 → deploy 时 `ssh-keyscan` 现场取 host key。
