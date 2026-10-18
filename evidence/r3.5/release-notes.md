# FruitLab R3.5 · 部署与 CI/CD

> 小版本 `3.5.0.0`：不改业务模型，只做「可部署收口 + 发布流水线」。

## 亮点

- **public GitHub 仓库**：<https://github.com/cloudzun/fruitlab-r3>（代码 MIT，文档/证据 CC BY-NC-SA 4.0）。
- **CI**：Node 22 + Postgres 16，138/138 测试 + `verify --quick`。
- **镜像发布**：tag 触发，Docker Hub + GHCR 双推，记录 digest；版本 tag 不复用。
- **Azure VM 生产部署**：Ubuntu 24.04 + Docker + 宿主机 Caddy 自动 HTTPS（Let's Encrypt）。
- **部署流水线**：GitHub Actions SSH → VM；部署前备份、健康检查、失败自动回滚。
- **线上**：<https://fruitlab-r3-chengzh-sea.eastasia.cloudapp.azure.com>（producion 仅 admin）。

## 镜像

| 镜像 | Docker Hub | GHCR |
|---|---|---|
| api | `chengzh/fruitlab-r3:3.5.0.0` | `ghcr.io/cloudzun/fruitlab-r3:3.5.0.0` |
| web | `chengzh/fruitlab-r3-web:3.5.0.0` | `ghcr.io/cloudzun/fruitlab-r3-web:3.5.0.0` |

当前 digest（tag 构建）：

```text
api  sha256:14c9b5bb3aa38a890b0e8006813fadd1e5aecb782b03aab05bdba50708599606
web  sha256:121a2bc3a9b32c8ea17720d513c731d6c6809366ed4b27747f25fea52fa0c7cc
```

## 验证

```text
GET https://fruitlab-r3-chengzh-sea.eastasia.cloudapp.azure.com/api/health
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true,...}

HTTP 308 → HTTPS；Let's Encrypt 证书；HSTS
admin 登录 200；userA 401（production 无演示账号）
下单 201；备份/恢复 after_delete=0 → after_restore=2
回滚 3.5.0.0 → 3.0.0.0 → rollback.sh → 3.5.0.0
```

## 文档与证据

- `docs/ci-cd.md`、`docs/deploy-azure.md`
- `R3.5-执行记录.md`、`R3.5-retro.md`
- `evidence/r3.5/`（Actions runs、digests、TLS、smoke、备份恢复、回滚）

## 已知限制

- 单 VM，无高可用/零停机。
- Docker Hub token 未轮换（用户决定），仅存 GitHub Secret。
- 未做 PaaS/K8s/多架构/ACR；CI 未跑 `verify --full`。
- VM 按小时计费，演示后可 `az vm deallocate`。
