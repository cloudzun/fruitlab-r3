# 阿里云 B/C 全面验证（2026-10-19）

> 一台全新阿里云杭州 ECS，同一台机器同时跑：
> - **B**：Docker Compose + ACR 公开镜像，`http://120.26.221.64:4175`
> - **C**：原生 Node 22 + PostgreSQL 16（无 Docker），`http://120.26.221.64:4176`

## 1. 资源

| 资源 | 值 |
|---|---|
| 地域 | `cn-hangzhou` |
| VPC | `vpc-bp1sixiy1vj6is8233sqe` |
| vSwitch | `vsw-bp100jdzny92ztj00u48k`（cn-hangzhou-h） |
| 安全组 | `sg-bp1fpc8jhnxugtqaegj7`（22/4175/4176） |
| ECS | `i-bp14mbfjkzxq9t2g0nlv`（`ecs.e-c1m2.large`，Ubuntu 24.04.5） |
| EIP | `eip-bp1cszvyeizza09qn9ams` / `120.26.221.64` |

旧资源已删除：`i-bp1hfqh71we8i4xjf9yy`、`eip-bp1cf4jxnb6864buf5bp3`、旧 VPC/vSwitch/SG。

## 2. 网络实测

| 目标 | 结果 |
|---|---|
| Gitee raw | 200，可下载 compose |
| 阿里云 ACR | 可匿名拉取公开镜像 |
| GitHub raw `start-demo.sh` | **不可用**：`curl: (35) Recv failure: Connection reset by peer` |
| Docker Hub | 未作为 B 主路径；按手册用 ACR |

## 3. B：干净重来（Docker + Gitee + ACR）

```bash
docker compose ... down -v       # 删卷
curl Gitee docker-compose.cn.yml
cat override（DEMO_ALLOW_ANY_HOST=1）
docker compose ... pull
docker compose ... up -d
```

结果：

```text
3 containers Up (healthy)
health 200 {"ok":true,"db":"up","version":"3.5.0.0",...}
userA login 200
order 201 FL-20261019-032107-V9ZP
home 200
admin_login 200; admin_products 200（14）; admin_orders 200（1）
```

管理员页面（真实浏览器）：

- 订单面板显示该订单；
- 海南香蕉库存改为 50 → 保存 → `已保存`；
- 下架 → 商城 14→13；上架 → 13→14；
- 库存改回 89 → 保存 → `已保存`。

持久化：

```text
restart 前订单数 1
docker compose restart
restart 后订单数 1；三容器 healthy；health 200
```

## 4. C：干净重来（Node 22 + PG 16，无 Docker）

```bash
fuser -k 4176/tcp
node cli.mjs db reset --yes
HOST=0.0.0.0 DEMO_ALLOW_ANY_HOST=1 COOKIE_SECURE=0 \
  node cli.mjs dev --port 4176
```

结果：

```text
health 200 {"ok":true,"db":"up","version":"3.5.0.0",...}
userA login 200（127.0.0.1 和 120.26.221.64 两个地址都通过）
order 201 FL-20261019-112333-KHZL
home 200
admin_login 200; admin_products 200（14）; admin_orders 200（1）
```

重启持久化：

```text
重启前 orders=1
重启 C 进程
重启后 orders=1；health 200
```

测试（本机 PG，无 Docker）：

```text
# tests 140
# pass 140
# fail 0
```

### C 的双地址验证

同一进程，`DEMO_ALLOW_ANY_HOST=1`、不设置 `PUBLIC_URL`：

```text
http://127.0.0.1:4176      health 200 / login 200 / order 200
http://120.26.221.64:4176  health 200 / login 200 / order 200
```

局域网/公网访问只需要 `HOST=0.0.0.0` + 防火墙放行端口；两个地址同时可用。

## 5. 与手册的对齐

| 项 | 结果 |
|---|---|
| quickstart B：Gitee compose + override | 已按此执行，通过 |
| development C：Node 22 + PG 16 + migrate/seed | 已按此执行，通过 |
| C 双地址：127.0.0.1 + 局域网/公网，`DEMO_ALLOW_ANY_HOST=1` | 已补入手册并验证 |
| GitHub raw start-demo | 不可用，已标为可选 |
| Docker Hub | 未作为主路径，手册用 ACR |

## 6. 结论

- B、C 都能在干净状态从零启动。
- 商城登录/下单、管理员订单/商品、库存保存、上下架、重启持久化均通过。
- C 不依赖 Docker，140 项测试在本机 PG 上通过。
- 当前 B/C 都在运行；不用时停 ECS 并释放 EIP。
