# 阿里云杭州 Demo 证据（2026-10-19）

> 形态：大陆 ECS + EIP + **IP:4175 + HTTP**，无域名、无 TLS、无备案。
> 访问：<http://116.62.60.211:4175>
> 账号：`userA` / `userB` / `admin`，口令 `demo1234`（development seed）。
> 镜像：阿里云 ACR 个人版（命名空间 `chengzh`）。

## 1. 资源

| 资源 | 值 |
|---|---|
| VPC | `vpc-bp1ybdws9qr9oazcvj6ro` |
| vSwitch | `vsw-bp1a65vtodrk5tbhzy8hp`（cn-hangzhou-h） |
| 安全组 | `sg-bp1czqqz0653spw0s0an`；入方向 22、4175（0.0.0.0/0） |
| ECS | `i-bp1hfqh71we8i4xjf9yy`，`ecs.e-c1m2.large`（2C4G），Ubuntu 24.04 |
| EIP | `eip-bp1cf4jxnb6864buf5bp3`，`116.62.60.211` |
| ACR | `registry.cn-hangzhou.aliyuncs.com/chengzh` |

## 2. 镜像（ACR）

| 镜像 | digest |
|---|---|
| `.../chengzh/fruitlab-r3:3.5.0.0` | `sha256:65ae8a4d10a711f42f4881443e886c34386e980a6829530b64fa57ebd780529f` |
| `.../chengzh/fruitlab-r3-web:3.5.0.0` | `sha256:b56a2592be8182e7d9cfcfa666a21be5f8e0cc8a0a59d9b3db2e9f2c832ce568` |
| `.../chengzh/postgres:16-alpine` | `sha256:1a66d744c1b459e13b05a8fca341da84cb63383e99ce262210efee5a319d4551` |

ACR 个人版不接受 Docker Hub 多平台 OCI index（`application/vnd.oci.empty.v1+json`），
改用本地单平台重建（`--provenance=false --sbom=false --output type=docker`）后推送成功。

## 3. 运行状态

```text
fruitlab-aliyun-demo-api-1  Up (healthy)
fruitlab-aliyun-demo-db-1   Up (healthy)
fruitlab-aliyun-demo-web-1  Up (healthy)
```

```text
GET http://116.62.60.211:4175/api/health
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true,"uptimeSeconds":22}

userA login=200
{"ok":true,"user":{"id":"U4bf2228ef7ffced5","username":"userA","role":"user"}}

create_order=201
{"ok":true,"order":{"orderNumber":"FL-20261019-011931-PBSC",...}}

home=200
```

## 4. 配置要点

- `APP_ENV=development`、`DEMO_PASSWORD=demo1234`
- `PUBLIC_URL=http://116.62.60.211:4175`
- `COOKIE_SECURE=0`（HTTP 必须）、`TRUST_PROXY=1`
- `web` 容器 `4175:8080`；无宿主机 Caddy
- `db` 卷 `fruitlab-demo-pgdata`
- 安全组 22/4175 全开；**不打 80/443，不绑域名，不备案**
- 仅 demo：HTTP 明文、无 TLS；不要放真实数据

## 5. 清理

见 `deploy/aliyun/README.md` 的 stop/destroy 命令；EIP 停 ECS 后也应释放，避免继续计费。
