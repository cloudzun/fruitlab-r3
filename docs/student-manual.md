# FruitLab 学生上机手册（Killercoda Linux + Docker，零配置版）

> 版本：R3.5 / `3.5.0.0`
> 适用：Killercoda 的 Linux 实例（Ubuntu / Docker playground），浏览器操作。
> 目标：启动 FruitLab，完成一次商城下单，并用管理员面板改一次库存。
> 特点：**不需要复制外部 URL，不需要改 PUBLIC_URL，不需要域名/HTTPS 配置。**

---

## 0. 你将得到什么

- 一个 Killercoda 暴露的 HTTPS 地址
- 14 种水果的商城
- 账号：`userA` / `userB` / `admin`，口令都是 `demo1234`
- 下单、我的订单、查订单、管理员面板

---

## 1. 打开 Killercoda 实例

1. 打开 <https://killercoda.com/playgrounds>
2. 选 **Ubuntu 24.04**（或 **Docker** playground）
3. 点 **Start**，等 Linux 终端出现
4. 终端执行：

```bash
whoami
docker --version
docker compose version
```

三条正常 → 跳到第 3 节；`docker: command not found` → 第 2 节。

---

## 2. 安装 Docker（没有预装时）

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo service docker start
```

验证：

```bash
docker --version
docker compose version
docker info | head
```

如果 `docker-compose-v2` 装不到：

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo service docker start
docker compose version
```

权限不足时：

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

---

## 3. 暴露端口 4175

1. Killercoda 页面找 **Traffic**（或 **Ports**）
2. 输入端口 **`4175`**
3. 点 **Open / Access**
4. 复制生成的 HTTPS 地址（形如 `https://xxx-4175.killercoda.com`）

> 这个地址只用来打开页面；应用已经开启 demo 模式，**不需要把它写进任何配置文件**。

---

## 4. 启动（推荐：一条命令）

在 Killercoda 终端：

```bash
mkdir -p ~/fruitlab-demo
cd ~/fruitlab-demo

curl -fsSL https://raw.githubusercontent.com/cloudzun/fruitlab-r3/main/deploy/student/start-demo.sh -o start-demo.sh
bash start-demo.sh
```

脚本会：

1. 从 Gitee 下载 compose（国内可用）；
2. 自动生成 `docker-compose.override.yml`，写入 `DEMO_ALLOW_ANY_HOST=1`；
3. `docker compose pull` 拉最新镜像；
4. 启动三容器；
5. 检查 `/api/health`。

看到类似输出即可：

```text
[start] PUBLIC_URL=http://127.0.0.1:4175
[start] 健康：{"ok":true,"db":"up","version":"3.5.0.0",...}
[start] 打开：http://127.0.0.1:4175
```

> 最后打印的 `127.0.0.1` 不用管；实际打开第 3 节的 **Killercoda HTTPS 地址**。

### 4.1 如果 GitHub 下载脚本失败

改用 compose + 手工 override：

```bash
cd ~/fruitlab-demo

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

> `DEMO_ALLOW_ANY_HOST=1` 只在 `APP_ENV=development` 生效；生产模式会忽略它，仍走严格 Host/Origin 白名单。

---

## 5. 检查

```bash
docker compose -f docker-compose.yml ps
```

或（如果用了脚本生成的文件）：

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml ps
```

应看到三个容器 `Up (healthy)`：

```text
fruitlab-student-...-api-1   Up (healthy)
fruitlab-student-...-db-1    Up (healthy)
fruitlab-student-...-web-1   Up (healthy)
```

也可以在本机看健康：

```bash
curl -sS http://127.0.0.1:4175/api/health
```

期望：

```json
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true}
```

然后打开 **第 3 节的 Killercoda HTTPS 地址**。

---

## 6. 商城操作步骤（必做）

### 6.1 浏览商城

1. 打开 Killercoda 地址；
2. 页面中部是 **商城**，应有 **14 种商品**；
3. 每张卡有图片、名称、规格、价格、`加入购物袋`。

### 6.2 未登录加购

1. 点任意商品（如“海南香蕉”）的 **加入购物袋**；
2. 购物袋数量变为 1；
3. 点 **去结账**，系统会要求先登录。

### 6.3 登录

1. 点右上角 **登录 / 注册**；
2. 用户名 `userA`，口令 `demo1234`；
3. 点 **登录**；
4. 导航出现 `我的订单`、`退出登录`。

### 6.4 加购与改数量

1. 再加购另一种商品；
2. 在 **购物袋** 用 `+` / `-` 改数量；
3. 看单项小计和 **合计**；
4. 点 **去结账**。

### 6.5 下单

1. 出现 **订单已提交** 收据；
2. 记录订单号，形如：

```text
FL-20261019-022022-CTZ9
```

3. 收据包含时间、商品、数量、单价、合计。

### 6.6 我的订单 / 查订单

1. 点 **我的订单** → **刷新** → 看到刚才的订单；
2. 点 **查订单** → 输入订单号 → **查询**；
3. 只能查自己账号下的订单。

### 6.7 重启后数据仍在

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml restart
```

浏览器刷新 → 重新登录 `userA` → 我的订单仍在。
说明订单在 Postgres volume，不是浏览器本地存储。

---

## 7. 管理员面板（必做）

### 7.1 登录管理员

1. 先 **退出登录**；
2. 用 `admin` / `demo1234` 登录；
3. 导航出现 **管理**，点进去。

### 7.2 订单面板

1. **订单** 区域点 **刷新**；
2. 可看到所有用户的订单；
3. 核对订单号、时间、商品、合计。

### 7.3 商品面板

1. **商品** 区域点 **刷新**；
2. 每个商品有：
   - **价格（分）**（例如 `899` = ¥8.99）
   - **库存**
   - **保存**
   - **上架 / 下架**
3. 做一次练习：
   - 把“海南香蕉”库存改为 `50`，点 **保存**；
   - 状态显示 `已保存`；
   - 回 **商城** 刷新，库存已更新；
   - 把价格/库存改回原值，避免影响后续同学。
4. 点 **下架** 后商城不显示；再 **上架** 恢复。

> 管理员修改直接写数据库，重启容器后仍保留。

---

## 8. 停止 / 重置

```bash
# 停止，保留数据
docker compose -f docker-compose.yml -f docker-compose.override.yml down

# 停止并删数据库（重新 seed）
docker compose -f docker-compose.yml -f docker-compose.override.yml down -v
```

Killercoda 实例结束/过期后，所有内容都会消失；下次重新来。

---

## 9. 常见问题

| 现象 | 处理 |
|---|---|
| 页面 403 `host-not-allowed` | 用的旧镜像或旧 override：执行第 4 节，确保 `DEMO_ALLOW_ANY_HOST=1` 且 `docker compose pull` 拉到新镜像 |
| 页面打不开 | 确认 Traffic 暴露了 `4175`；`docker compose ps` 三容器 healthy |
| `docker: command not found` | 第 2 节安装；或换 Killercoda 的 Docker playground |
| `docker compose` 不是命令 | 安装 `docker-compose-v2`；或升级 Docker |
| Docker Hub 拉取超时 | 用 Gitee 的 `docker-compose.cn.yml`（ACR 公开镜像） |
| ACR `pull access denied` | 三个 ACR 仓库已公开；确认文件名是 `docker-compose.cn.yml` |
| 4175 没有 Open 按钮 | 先启动容器，再在 Traffic/Ports 输入 4175 |
| 管理员入口没有 | 必须用 `admin/demo1234`；普通账号看不到“管理” |
| 改价格后金额不对 | 价格单位是“分”，`899` = ¥8.99 |
| 订单没了 | 执行过 `down -v`；只 `down` 不会删 |
| Killercoda 实例过期 | 重开实例，按第 3–4 节重来；数据不保留 |

---

## 10. 提交/验收清单

- [ ] `docker compose ps` 三容器 healthy
- [ ] `/api/health` 返回 `version: 3.5.0.0`
- [ ] 完成登录 + 加购 + 下单，记录订单号
- [ ] 我的订单 / 查订单能看到该订单
- [ ] `docker compose restart` 后订单仍在
- [ ] 管理员面板改一次库存并保存，商城能看到变化
- [ ] 说明自己用的是 Docker Hub 版还是 ACR 版

---

## 附录 A：ACR compose 全文（离线备用）

保存为 `docker-compose.yml`：

```yaml
name: fruitlab-student-cn

services:
  db:
    image: registry.cn-hangzhou.aliyuncs.com/chengzh/postgres:16-alpine
    environment:
      POSTGRES_USER: fruitlab
      POSTGRES_DB: fruitlab
      POSTGRES_PASSWORD: fruitlab-demo-pass
    volumes:
      - fruitlab-student-cn-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fruitlab -d fruitlab"]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 10s
    restart: unless-stopped

  api:
    image: registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3:3.5.0.0
    environment:
      DATABASE_URL: postgres://fruitlab:fruitlab-demo-pass@db:5432/fruitlab
      APP_ENV: development
      HOST: 0.0.0.0
      PORT: "3000"
      SERVE_STATIC: "0"
      PUBLIC_URL: http://127.0.0.1:4175
      TRUST_PROXY: "1"
      COOKIE_SECURE: "0"
      DEMO_ALLOW_ANY_HOST: "1"
      DEMO_PASSWORD: demo1234
      SESSION_TTL_SECONDS: "86400"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 10s
    restart: unless-stopped

  web:
    image: registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3-web:3.5.0.0
    ports:
      - "4175:8080"
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 5s
    restart: unless-stopped

volumes:
  fruitlab-student-cn-pgdata:
    name: fruitlab-student-cn-pgdata
```

> Docker Hub 默认版只需把三个 `image:` 换成 `postgres:16-alpine`、`chengzh/fruitlab-r3:3.5.0.0`、`chengzh/fruitlab-r3-web:3.5.0.0`，并保留 `DEMO_ALLOW_ANY_HOST: "1"`。

## 附录 B：命令速查

```bash
cd ~/fruitlab-demo

# 启动（脚本版）
bash start-demo.sh

# 启动（手工 override 版）
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d

# 状态 / 健康
docker compose -f docker-compose.yml ps
curl -sS http://127.0.0.1:4175/api/health

# 日志
docker compose -f docker-compose.yml logs --tail=50 api

# 重启
docker compose -f docker-compose.yml -f docker-compose.override.yml restart

# 停止
docker compose -f docker-compose.yml -f docker-compose.override.yml down

# 删除数据
docker compose -f docker-compose.yml -f docker-compose.override.yml down -v
```

## 附录 C：账号与地址

| 项 | 值 |
|---|---|
| 外部地址 | Killercoda Traffic 里暴露 `4175` 后生成的 HTTPS 地址 |
| 普通用户 | `userA` / `userB`，口令 `demo1234` |
| 管理员 | `admin` / `demo1234` |
| Docker Hub 镜像 | `chengzh/fruitlab-r3:3.5.0.0`、`chengzh/fruitlab-r3-web:3.5.0.0` |
| ACR 镜像 | `registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3:3.5.0.0` 等 |
| 学生启动器 | `https://raw.githubusercontent.com/cloudzun/fruitlab-r3/main/deploy/student/start-demo.sh` |
| 国内 compose | `https://gitee.com/cloudzun/fruitlab-r3/raw/main/deploy/student/docker-compose.cn.yml` |
