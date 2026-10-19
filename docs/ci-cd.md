# CI/CD（R3.5）

> 仓库：<https://github.com/cloudzun/fruitlab-r3>（public）
> 镜像：Docker Hub `chengzh/fruitlab-r3[-web]` + GHCR `ghcr.io/cloudzun/fruitlab-r3[-web]`
> 部署：GitHub Actions → SSH → Azure VM（详见 `docs/deploy-azure.md`）

## 1. 流水线全景

```text
push main / PR
  └─ ci.yml：Node 22 + Postgres 16 service + 140 tests + verify --quick

tag v3.5.0.0（或手动 release）
  └─ release.yml
       ├─ build-push：api/web → Docker Hub + GHCR，digest artifact
       └─ deploy：environment=production → SSH → VM ./deploy.sh <tag>
                     备份 → pull → up -d → health → 失败自动回滚
```

## 2. CI（`.github/workflows/ci.yml`）

- 触发：`push main`、`pull_request`、`workflow_dispatch`。
- Postgres service：`postgres:16-alpine`，映射 `55432:5432`，与本地测试约定一致。
- `TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres`。
- 步骤：`npm ci` → `node --test --test-concurrency=4` → `node scripts/verify.mjs --quick` → 上传 `evidence/test-count.txt`。
- 注意：lockfile 的 `resolved` 已改为 `registry.npmjs.org`；npmmirror 在 GitHub runner 上曾 504。

本地等价：

```powershell
node scripts/pgctl.mjs up
$env:TEST_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:55432/postgres"
node --test --test-concurrency=4
node scripts/verify.mjs --quick
```

## 3. 发布（`.github/workflows/release.yml`）

### 触发

- `push` tag `v3.5.*`；
- `workflow_dispatch`：输入 `version`（如 `3.5.0.0`），可选 `deploy=true`。

### 产物

| 镜像 | Docker Hub | GHCR |
|---|---|---|
| api | `chengzh/fruitlab-r3:<tag>` | `ghcr.io/cloudzun/fruitlab-r3:<tag>` |
| web | `chengzh/fruitlab-r3-web:<tag>` | `ghcr.io/cloudzun/fruitlab-r3-web:<tag>` |

- `linux/amd64`；版本 tag 不复用；`latest` 不自动更新。
- digest 写入 Actions artifact `image-digests-<tag>` 与 job summary。

### Secrets

| Secret | 说明 |
|---|---|
| `DOCKERHUB_USERNAME` | `chengzh` |
| `DOCKERHUB_TOKEN` | Docker Hub token（用户决定沿用，不轮换；只存 secret） |
| `VPS_HOST` | Azure VM 公网 IP / DNS |
| `VPS_USER` | `azureuser` |
| `VPS_SSH_KEY` | VM 私钥（专用 key） |

> 不再使用 `VPS_KNOWN_HOSTS` secret：deploy 时用 `ssh-keyscan -t ed25519 "$VPS_HOST"` 现场写入 known_hosts，避免跨平台换行/CR 差异导致匹配失败。

GHCR 用 `GITHUB_TOKEN`（workflow 已声明 `packages: write`），无需额外 secret。

## 4. 部署（release 的 deploy job）

- `needs: build-push`；`environment: production`（可后续加 required reviewers）。
- 通过 SSH 执行 VM 上 `/opt/fruitlab/deploy.sh <tag>`。
- `deploy.sh`：备份 → 记录上一版 → `compose pull` → `up -d` → `wait-health.sh`；失败自动回滚 `.previous_tag`。
- 手工部署等价：

```bash
cd /opt/fruitlab
./deploy.sh 3.5.0.0
./rollback.sh                 # 回上一版
./restore.sh /var/backups/fruitlab/fruitlab-YYYYmmdd-HHMMSS.dump
```

## 5. 版本发布步骤

```powershell
cd D:\vibecoding\easyvibe\r3-fruitlab
# 1) 改 VERSION / package.json / CHANGELOG，跑测试
# 2) 提交、推分支
git push origin release/r3.5
# 3) 打 tag（触发 release + deploy）
git tag v3.5.0.0
git push origin v3.5.0.0
```

## 6. 排障

| 现象 | 处理 |
|---|---|
| CI `npm ci` 504 | 确认 lock 指向 npmjs；workflow 已 `npm config set registry` |
| release 登录 Docker Hub 失败 | 检查 `DOCKERHUB_*` secrets；token 是否仍有效 |
| deploy SSH 失败 | 检查 `VPS_*` secrets、NSG 22、公钥是否在 VM |
| deploy 后 health 失败 | 看 VM `docker compose ps/logs`；脚本应已尝试回滚 |
| GHCR 拉取 401 | 包默认 private；改 public 或 `docker login ghcr.io` |
| 生产启动报 `classroom-data-present` | 用了开发卷；换新卷 `fruitlab-r3-prod-pgdata` |

## 7. 已知限制

- CI 未跑 `verify --full`（需要 Docker build/preflight；后续可加）。
- 部署为单机、无零停机；发布瞬间有短暂重启。
- 未做自动回滚数据库迁移（R3.5 无 schema 变更）；未来有迁移时先备份并人工确认。

## 8. R3.5 实测

| run id | workflow | 结果 |
|---|---|---|
| `39174842686` | ci | failure（npmmirror 504） |
| `39175247654` | ci | success（140/140） |
| `39175675684` | ci | success |
| `39175688760` | release | success（build+push） |
| `39176037433` | ci | success |
| `39176077847` | release+deploy | failure（known_hosts） |
| `39176200583` | ci | success |
| `39176206939` | release+deploy | success（Azure VM 部署） |

证据：`evidence/r3.5/`。
