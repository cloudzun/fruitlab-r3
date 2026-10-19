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

## 2. B：Docker

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

方式：Gitee `docker-compose.cn.yml`（ACR）+ `docker-compose.override.yml` 写 `DEMO_ALLOW_ANY_HOST=1`；`docker compose pull/up -d`。

## 3. C：原生 Node/PostgreSQL（无 Docker）

```text
node v22.20.0
psql (PostgreSQL) 16.15
node serve.mjs --host 0.0.0.0 --port 4176 --url postgres://fruitlab:***@127.0.0.1:5432/fruitlab

GET http://120.26.221.64:4176/api/health
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true,...}

userA login=200
order=201（FL-20261019-110542-47UN）
home=200
admin_login=200；admin_products=200（14）；admin_orders=200（1）
```

步骤：

```bash
apt-get install -y postgresql postgresql-contrib
service postgresql start
# Node 22.20.0 binary -> /opt/node-v22.20.0-linux-x64
git clone https://gitee.com/cloudzun/fruitlab-r3.git /root/fruitlab-c
cd /root/fruitlab-c
npm ci
export DATABASE_URL="postgres://fruitlab:fruitlab-demo-pass@127.0.0.1:5432/fruitlab"
node cli.mjs db migrate
node cli.mjs db seed
SERVE_STATIC=1 PUBLIC_URL=http://120.26.221.64:4176 COOKIE_SECURE=0 \
  node serve.mjs --host 0.0.0.0 --port 4176 --url "$DATABASE_URL"
```

## 4. 结论

- B 和 C 在同一台 Linux 虚机上可同时运行（不同端口、不同数据源）。
- B 用容器 Postgres + volume；C 用本机 PostgreSQL 16 服务，不依赖 Docker。
- 两者商城登录/下单、管理员接口均通过。
- 这台机器目前保留，供演示/复核；不用时停 ECS 并释放 EIP。
