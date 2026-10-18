# PRD-R3.5：部署收口与 CI/CD

> 版本：`3.5.0.0`（小版本，不改业务模型）
> 输入：R3 `3.0.0.0`、`R3.5-部署与CI-CD方案.md`、用户确认的 6 项决策（public repo / 沿用 Docker Hub token / Azure VM / 暂不做 PaaS / 同时推 GHCR / 轻量四环）。
> 状态：实施中（2026-10-19）。

## 1. 背景

R3 已具备 Postgres + 三层 + 三容器 + 备份恢复，但仍停在“本机能跑”：
没有远端仓库、没有 CI、镜像靠手工推送、没有真实公网部署与回滚流程。
R3.5 只补这一层，让 R3 成为“可交付、可复现、可回滚”的部署版本。

## 2. 目标

1. public GitHub 仓库（唯一源）+ LICENSE + 分支/tag 规则。
2. CI：push/PR 自动跑 138 项测试 + 机械校验。
3. 镜像发布：tag 触发，Docker Hub + GHCR，记录 digest；版本 tag 不复用。
4. Azure VM 生产部署：Docker + 宿主机 Caddy 自动 HTTPS + 生产 compose。
5. 部署流水线：GitHub Actions SSH → VM；部署前备份、健康检查、失败自动回滚。
6. 完整记录：PRD、docs、evidence、retro，可复盘。

## 3. 范围

- 仓库：`cloudzun/fruitlab-r3`（public）；代码 MIT，文档/证据 CC BY-NC-SA 4.0。
- CI：`.github/workflows/ci.yml`。
- 发布：`.github/workflows/release.yml`（tag `v3.5.*` / 手动）。
- 部署资产：`deploy/vps/`（compose、Caddyfile、backup/restore/deploy/rollback、systemd）。
- 部署环境：Azure VM（Ubuntu 24.04，`Standard_B2s`，`eastasia`），Docker + host Caddy。
- 文档：`docs/ci-cd.md`、`docs/deploy-azure.md`。

## 4. 非目标

- 订单取消/退款、审计日志、分页、scrypt 升级等业务功能；
- PaaS（Railway/Render/Fly/Zeabur）；
- Kubernetes/Helm、Vercel/Workers；
- 多架构镜像、多可用区、蓝绿/金丝雀；
- 阿里云 ACR / 大陆备案（后续可选）。

## 5. 验收标准

| # | 标准 | 证据 |
|---:|---|---|
| 1 | public repo，main + `v3.0.0.0` + `v3.5.0.0` | GitHub URL / `gh release list` |
| 2 | PR/push CI 绿，138/138 | Actions run |
| 3 | tag 推送后 Docker Hub + GHCR 各有 api/web 两镜像，digest 记录 | Actions artifact / 本地 inspect |
| 4 | `https://<domain>/api/health` 返回 `version=3.5.0.0`、`db=up` | curl 输出 |
| 5 | HTTP→HTTPS、证书有效、HSTS | curl -I / 浏览器 |
| 6 | 生产仅 admin，无 userA/userB | 登录测试 |
| 7 | 部署前备份存在；备份恢复后数据回来 | `backup.sh`/`restore.sh` 输出 |
| 8 | 健康检查失败自动回滚上一版 | `deploy.sh` 演练 |
| 9 | 仓库无 `.env`/token/私钥；workflow 日志无 secret | secret scan / 检查 |
| 10 | 文档可复现 | docs 链接 |

## 6. 风险与已知限制

- 单 VM，无高可用；部署窗口短暂中断。
- Docker Hub token 未轮换（用户决定）；只存 GitHub Secret，风险已知。
- Azure VM 产生费用；演示后应 `az vm deallocate`。
- 大陆访问 Azure 香港节点受网络影响；后续可加 ACR。
- CI 目前为 tests + `verify --quick`；`verify --full` 需要 Docker，后续可加。
- 生产首启必须空卷；复用开发卷会被 `classroom-data-present` 拒绝。

## 7. 实施顺序

1. public repo + LICENSE + CI；
2. R3.5 部署资产 + 版本 3.5.0.0；
3. Azure VM + Docker/Caddy；
4. release workflow 推 Docker Hub/GHCR；
5. VM 手工部署验证；
6. deploy workflow + 回滚/备份演练；
7. docs/evidence/retro。
