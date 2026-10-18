# GitHub Actions 流水线（R3.5 实测）

> 仓库：<https://github.com/cloudzun/fruitlab-r3>（public）
> 工作流：`.github/workflows/ci.yml`、`.github/workflows/release.yml`

## 1. 实测运行

| run id | workflow | 触发 | 结果 | 说明 |
|---|---|---|---|---|
| `39174842686` | ci | push | **failure** | 首次 CI；npmmirror 504 |
| `39175247654` | ci | push | success | 改 npmjs 后 138 测试通过 |
| `39175675684` | ci | push | success | R3.5 资产合并后 CI |
| `39175688760` | release | dispatch | success | 首次构建/推送 3.5.0.0（deploy=false） |
| `39176037433` | ci | push | success | Caddy/health 修复后 CI |
| `39176077847` | release | dispatch deploy=true | **failure** | deploy 失败：known_hosts 不匹配 |
| `39176200583` | ci | push | success | deploy host key 修复后 CI |
| `39176206939` | release | dispatch deploy=true | **success** | build-push + deploy 全通 |

## 2. ci.yml

- Node 22 + `npm ci`（lock 指向 npmjs）+ Postgres 16 service（55432）。
- `node --test --test-concurrency=4` → 138/138。
- `node scripts/verify.mjs --quick` → 6/6。
- artifact：`evidence/test-count.txt`。

## 3. release.yml

- `workflow_dispatch`：`version=3.5.0.0`，`deploy=true/false`。
- tag `v3.5.*` 也会触发（正式发版时使用）。
- build-push：`Dockerfile` + `Dockerfile.web`，linux/amd64，推 Docker Hub + GHCR。
- digest：`docker buildx imagetools inspect` 写入 artifact 与 job summary。
- deploy：`needs: build-push`，SSH 到 Azure VM，执行 `/opt/fruitlab/deploy.sh <tag>`。
- host key：部署时 `ssh-keyscan -t ed25519 "$VPS_HOST"` 现场写入 known_hosts，避免 secret 换行/CR 差异。

## 4. 真实失败与修复

| 失败 | 根因 | 修复 |
|---|---|---|
| CI npm ci 504 | npmmirror 在 GitHub runner 超时 | package-lock 的 `resolved` 改 `registry.npmjs.org` |
| release dispatch 404 | workflow 只在 `release/r3.5` 分支 | 合并到 default branch `main` 后 dispatch |
| deploy SSH 失败 | `VPS_KNOWN_HOSTS` 与 runner 写入格式不一致 | deploy 时 `ssh-keyscan` 现场取 host key |
| deploy 后 health 失败 | 内网 curl 未带 `Host`，API Host 白名单 403 | `wait-health.sh` 带 `Host: <PUBLIC_URL host>` |
| Caddy 证书失败 | `admin@example.com` 被 LE 判 forbidden domain | Caddyfile 去掉 email；清 ACME 状态重签 |

## 5. 结论

GitHub 作为唯一源、Actions 作为质量门与发布/部署执行器，链路已真实跑通；
首次失败均保留在 run 列表，修复后重跑成功，不是“一次就绿”的演示。
