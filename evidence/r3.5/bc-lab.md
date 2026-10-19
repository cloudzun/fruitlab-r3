# 阿里云 B/C 实验记录（2026-10-19）

> 一台全新阿里云杭州 ECS，同一台机器上同时跑：
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

旧资源已删除：`i-bp1hfqh71we8i4xjf9yy`、`eip-bp1cf4jxnb6864buf5bp3`、旧 VPC/vSwitch/SG 均已清理。

## 2. 网络实测（重要）

| 目标 | 结果 |
|---|---|
| Gitee raw | 200，可下载 compose |
| 阿里云 ACR | 可匿名拉取公开镜像 |
| GitHub raw `start-demo.sh` | **不可用**：`curl: (35) Recv failure: Connection reset by peer` |
| Docker Hub | 未作为 B 主路径；按手册用 ACR |

因此 B 实际采用 **Gitee compose + override**，不是 GitHub `start-demo.sh`；C 用 **Gitee clone**，不是 GitHub。

## 3. B：Docker（Gitee + ACR）

```text
fruitlab-student-cn-web-1  Up (healthy)
fruitlab-student-cn-api-1  Up (healthy)
fruitlab-student-cn-db-1   Up (healthy)

GET http://120.26.221.64:4175/api/health
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true,...}

userA login=200
order=201（FL-20261019-030541-BE3K）
home=200
admin_login=200；admin_products=200（14）；admin_orders=200（1）
```

命令（与手册 quickstart 一致）：

```bash
curl -fsSL https://gitee.com/cloudzun/fruitlab-r3/raw/main/deploy/student/docker-compose.cn.yml -o docker-compose.yml
cat > docker-compose.override.yml <<'EOF'
services:
  api:
    environment:
      DEMO_ALLOW_ANY_HOST: "1"
EOF
docker compose -f docker-compose.yml -f docker-compose.override.yml pull
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

## 4. C：原生 Node/PostgreSQL（无 Docker）

```text
node v22.20.0
psql (PostgreSQL) 16.15
node cli.mjs dev --port 4176（HOST=0.0.0.0, PUBLIC_URL=http://120.26.221.64:4176）

GET http://120.26.221.64:4176/api/health
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true,...}

userA login=200
order=200（幂等已有订单 FL-20261019-110542-47UN）
home=200
admin_login=200；admin_products=200（14）；admin_orders=200（1）
```

命令（与手册 development C 一致）：

```bash
apt-get install -y postgresql postgresql-contrib xz-utils
service postgresql start
# Node 22.20.0 binary -> /opt/node-v22.20.0-linux-x64
git clone https://gitee.com/cloudzun/fruitlab-r3.git /root/fruitlab-c
cd /root/fruitlab-c
npm ci
export DATABASE_URL="postgres://fruitlab:fruitlab-demo-pass@127.0.0.1:5432/fruitlab"
node cli.mjs db migrate
node cli.mjs db seed
HOST=0.0.0.0 PUBLIC_URL=http://120.26.221.64:4176 COOKIE_SECURE=0 \
  node cli.mjs dev --port 4176
```

## 5. 与手册的偏差（已修正）

| 偏差 | 手册修正 |
|---|---|
| B 用 Gitee compose，不是 GitHub `start-demo.sh` | quickstart 改为 Gitee 主路径，`start-demo.sh` 标为可选 |
| C 外部访问不能用裸 `node cli.mjs dev` | development 增加 `HOST=0.0.0.0` + `PUBLIC_URL` + 端口放行 |
| C 用 Gitee clone，不是 GitHub | development 明确“国内优先 Gitee”，记录 GitHub raw reset |
| 安全组额外开 4176 | development C 远程访问章节写明 |

## 6. 结论

- B 和 C 在同一台 Linux 虚机上可同时运行（不同端口、不同数据源）。
- B 用容器 Postgres + volume；C 用本机 PostgreSQL 16 服务，不依赖 Docker。
- 两者商城登录/下单、管理员接口均通过。
- 这台机器目前保留，供演示/复核；不用时停 ECS 并释放 EIP。
