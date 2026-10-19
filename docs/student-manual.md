# FruitLab 学生上机手册（Killercoda Linux + Docker）

> 版本：R3.5 / `3.5.0.0`
> 适用：Killercoda 的 Linux 实例（Ubuntu / Docker playground），浏览器操作，不需要 Windows、不需要装 Docker Desktop。
> 目标：在 Killercoda 里启动 FruitLab，完成一次商城下单，并用管理员面板改一次库存。
> 预计：10–20 分钟。Killercoda 实例是临时的，实例结束数据不保留。

---

## 0. 你将得到什么

- 一个由 Killercoda 暴露的 HTTPS 地址（形如 `https://xxxx.killercoda.com`）
- 14 种水果的商城
- 账号：`userA` / `userB` / `admin`，口令都是 `demo1234`
- 下单、我的订单、查订单、管理员面板
- 不需要域名、不需要备案、不需要阿里云账号

---

## 1. 打开 Killercoda 实例

1. 打开 <https://killercoda.com/playgrounds>
2. 选择 **Ubuntu 24.04**（或 **Docker** playground，若列表中有）
3. 点 **Start**，等待 Linux 终端出现
4. 终端里先执行：

```bash
whoami
docker --version
docker compose version
```

- 如果三条都正常：直接去第 3 节。
- 如果提示 `docker: command not found`：继续第 2 节。

---

## 2. 安装 Docker（Killercoda 没有预装时）

在 Killercoda 终端执行：

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo service docker start
```

然后验证：

```bash
docker --version
docker compose version
docker info | head
```

如果 `docker-compose-v2` 安装不到（老 Ubuntu 镜像），用 Docker 官方脚本：

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo service docker start
docker compose version
```

如果提示 `permission denied`：

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

---

## 3. 先暴露端口 4175，拿到 Killercoda URL

1. 在 Killercoda 页面找 **Traffic**（或 **Ports**）面板；
2. 输入端口 **`4175`**；
3. 点 **Open / Access**；
4. 复制生成的地址，形如：

```text
https://abc123-4175.killercoda.com
```

> 这个地址就是应用的外部地址，下面记为 `PUBLIC_URL`。
> **不要**在末尾加 `/`；不要用 `127.0.0.1:4175` 打开。

---

## 4. 下载 compose

在 Killercoda 终端：

```bash
mkdir -p ~/fruitlab-demo
cd ~/fruitlab-demo

# 国内推荐：阿里云 ACR 公开镜像
curl -fsSL https://gitee.com/cloudzun/fruitlab-r3/raw/main/deploy/student/docker-compose.cn.yml -o docker-compose.yml
```

如果要用 Docker Hub 默认镜像：

```bash
curl -fsSL https://gitee.com/cloudzun/fruitlab-r3/raw/main/deploy/student/docker-compose.yml -o docker-compose.yml
```

> Docker Hub 在国内可能拉不动；优先用上面的 `docker-compose.cn.yml`（ACR，公开，不需要登录）。

---

## 5. 把外部 URL 写进 compose

在 Killercoda 终端，把你在第 3 节复制的地址填进去（保留引号）：

```bash
PUBLIC_URL="https://abc123-4175.killercoda.com"

sed -i "s|PUBLIC_URL: .*|PUBLIC_URL: $PUBLIC_URL|" docker-compose.yml
grep PUBLIC_URL docker-compose.yml
```

最后一行应显示你复制的 Killercoda 地址。

> 这一步不能省。Killercoda 通过 HTTPS 代理访问容器，应用会校验 Host/Origin；
> `PUBLIC_URL` 不匹配就会出现 `403 host-not-allowed`。

---

## 6. 启动与检查

```bash
docker compose -f docker-compose.yml up -d
```

第一次会拉三个镜像；等 1–3 分钟。

检查：

```bash
docker compose -f docker-compose.yml ps
```

应看到三个容器 `Up (healthy)`，例如：

```text
fruitlab-student-...-api-1   Up (healthy)
fruitlab-student-...-db-1    Up (healthy)
fruitlab-student-...-web-1   Up (healthy)
```

本机健康检查（带 Killercoda Host）：

```bash
HOST="${PUBLIC_URL#*://}"
curl -sS -H "Host: $HOST" http://127.0.0.1:4175/api/health
```

期望：

```json
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true}
```

然后直接打开第 3 节复制的 Killercoda 地址。

---

## 7. 商城操作步骤（必做）

### 7.1 浏览商城

1. 打开 Killercoda 地址；
2. 页面中部是 **商城**，应有 **14 种商品**；
3. 每张卡有图片、名称、规格、价格、`加入购物袋`。

### 7.2 未登录加购

1. 点任意商品（如“海南香蕉”）的 **加入购物袋**；
2. 购物袋数量变为 1；
3. 点 **去结账**，系统会要求先登录。

### 7.3 登录

1. 点右上角 **登录 / 注册**；
2. 用户名 `userA`，口令 `demo1234`；
3. 点 **登录**；
4. 导航出现 `我的订单`、`退出登录`。

### 7.4 加购与改数量

1. 再加购另一种商品；
2. 在 **购物袋** 用 `+` / `-` 改数量；
3. 看单项小计和 **合计**；
4. 点 **去结账**。

### 7.5 下单

1. 出现 **订单已提交** 收据；
2. 记录订单号，形如：

```text
FL-20261019-021742-7E1I
```

3. 收据包含时间、商品、数量、单价、合计。

### 7.6 我的订单 / 查订单

1. 点 **我的订单** → **刷新** → 看到刚才的订单；
2. 点 **查订单** → 输入订单号 → **查询**；
3. 只能查自己账号下的订单。

### 7.7 重启后数据仍在

```bash
docker compose -f docker-compose.yml restart
```

浏览器刷新 → 重新登录 `userA` → 我的订单仍在。
说明订单在 Postgres volume，不是浏览器本地存储。

---

## 8. 管理员面板（必做）

### 8.1 登录管理员

1. 先 **退出登录**；
2. 用 `admin` / `demo1234` 登录；
3. 导航出现 **管理**，点进去。

### 8.2 订单面板

1. **订单** 区域点 **刷新**；
2. 可看到所有用户的订单；
3. 核对订单号、时间、商品、合计。

### 8.3 商品面板

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
4. 点 **下架**，商城不再显示该商品；再 **上架** 恢复。

> 管理员修改直接写数据库，重启容器后仍保留。

---

## 9. 停止与重置

```bash
# 停止，保留数据
docker compose -f docker-compose.yml down

# 停止并删数据库（重新 seed）
docker compose -f docker-compose.yml down -v
```

Killercoda 实例结束/过期后，所有内容都会消失；下次重新按本手册来。

---

## 10. 常见问题

| 现象 | 处理 |
|---|---|
| 页面 403 `host-not-allowed` | `PUBLIC_URL` 不是 Killercoda 地址，或末尾多了 `/`；按第 5 节重新 `sed` 并 `docker compose up -d --force-recreate` |
| 打开 `127.0.0.1:4175` 打不开 | 这是 Killercoda 容器内部地址；必须用 Traffic 暴露的外部 HTTPS 地址 |
| `docker: command not found` | 按第 2 节安装；或换 Killercoda 的 Docker playground |
| `docker compose` 不是命令 | 安装 `docker-compose-v2`；或升级 Docker |
| Docker Hub 拉取超时 | 用 `docker-compose.cn.yml`（阿里云 ACR 公开镜像） |
| ACR `pull access denied` | 三个 ACR 仓库已公开；确认文件名是 `docker-compose.cn.yml`，不要手动改镜像地址 |
| 4175 没有 Open 按钮 | 先让容器跑起来，再在 Traffic/Ports 里输入 4175；或换端口并同步 `PUBLIC_URL` |
| 管理员入口没有 | 必须用 `admin/demo1234` 登录；普通账号看不到“管理” |
| 改价格后金额不对 | 价格单位是“分”，`899` = ¥8.99 |
| 订单没了 | 执行过 `down -v`；只 `down` 不会删数据 |
| Killercoda 实例过期 | 重新开实例，按第 3–6 节重来；数据不保留 |

---

## 11. 提交/验收清单

- [ ] `docker compose ps` 三容器 healthy
- [ ] `curl ... /api/health` 返回 `version: 3.5.0.0`
- [ ] 完成一次登录 + 加购 + 下单，记录订单号
- [ ] 我的订单 / 查订单能看到该订单
- [ ] `docker compose restart` 后订单仍在
- [ ] 管理员面板改一次库存并保存，商城能看到变化
- [ ] 说明自己用的是 Docker Hub 版还是 ACR 版

---

## 附录 A：ACR compose 全文（Gitee 打不开时用）

保存为 `docker-compose.yml`，并把 `PUBLIC_URL` 改成你的 Killercoda 地址：

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
      PUBLIC_URL: https://REPLACE-WITH-KILLERCODA-URL
      TRUST_PROXY: "1"
      COOKIE_SECURE: "0"
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

## 附录 B：命令速查

```bash
cd ~/fruitlab-demo

# 启动
docker compose -f docker-compose.yml up -d

# 状态 / 健康
docker compose -f docker-compose.yml ps
HOST="${PUBLIC_URL#*://}"
curl -sS -H "Host: $HOST" http://127.0.0.1:4175/api/health

# 日志
docker compose -f docker-compose.yml logs --tail=50 api

# 重启
docker compose -f docker-compose.yml restart

# 停止
docker compose -f docker-compose.yml down

# 删除数据
docker compose -f docker-compose.yml down -v
```

## 附录 C：账号与地址

| 项 | 值 |
|---|---|
| 外部地址 | Killercoda Traffic 里暴露 `4175` 后生成的 HTTPS 地址 |
| 普通用户 | `userA` / `userB`，口令 `demo1234` |
| 管理员 | `admin` / `demo1234` |
| Docker Hub 镜像 | `chengzh/fruitlab-r3:3.5.0.0`、`chengzh/fruitlab-r3-web:3.5.0.0` |
| ACR 镜像 | `registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3:3.5.0.0` 等 |
| 国内 compose | `https://gitee.com/cloudzun/fruitlab-r3/raw/main/deploy/student/docker-compose.cn.yml` |
