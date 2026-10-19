# FruitLab 学生本地运行手册（Windows + Docker）

> 版本：R3.5 / `3.5.0.0`
> 适用：Windows 10/11（64 位），只使用 **Docker Desktop**，不要求 Linux 基础。
> 目标：在自己的电脑上启动 FruitLab，完成一次商城下单，并会用管理员面板。
> 预计：安装 Docker 15–30 分钟；启动与操作 15 分钟。

---

## 0. 你将得到什么

启动后，浏览器打开：

```text
http://127.0.0.1:4175
```

- 14 种水果的商城
- 注册 / 登录、购物袋、下单、我的订单、查订单
- 管理员面板（订单 / 商品）
- 账号：`userA` / `userB` / `admin`，口令都是 `demo1234`
- 不需要域名、HTTPS、阿里云账号

---

## 1. 先检查电脑

Windows 要求：

| 项 | 要求 |
|---|---|
| 系统 | Windows 10 64 位 21H2+ 或 Windows 11 |
| 虚拟化 | BIOS/UEFI 中已开启 |
| 内存 | 建议 8 GB 以上 |
| 磁盘 | 至少 2 GB 空闲 |
| 网络 | 能访问 Gitee / 阿里云 ACR；Docker Hub 可选 |

打开 **PowerShell**（开始菜单搜索 PowerShell），先试：

```powershell
docker --version
docker compose version
```

如果两条都正常显示版本号，说明已装 Docker，可直接跳到第 3 节。
如果提示“不是内部或外部命令”，继续第 2 节。

---

## 2. 安装 Docker Desktop（只写这一种）

### 2.1 安装 WSL2

1. 右键开始菜单 → **终端（管理员）** 或 **Windows PowerShell（管理员）**。
2. 执行：

```powershell
wsl --install
```

3. 完成后**重启电脑**。
4. 重启后再执行：

```powershell
wsl --update
wsl --status
```

看到默认 WSL 版本为 2 即可。若提示没有启用虚拟化，需要进 BIOS/UEFI 开启 Intel VT-x / AMD-V。

### 2.2 安装 Docker Desktop

1. 打开 <https://www.docker.com/products/docker-desktop/> 下载 Windows 版。
2. 如果官网下载很慢，向老师要 **Docker Desktop 离线安装包**（Windows amd64）。
3. 双击安装，保持默认选项；安装完成后重启。
4. 启动 Docker Desktop：
   - 首次会要求接受协议；
   - 可以跳过登录（Skip / Continue without signing in）；
   - 设置里确认 **Use the WSL 2 based engine** 已勾选。
5. 等左下角状态变为 **Engine running**。

### 2.3 验证

新开一个 PowerShell 窗口：

```powershell
docker --version
docker compose version
docker info
```

三条都应成功。`docker compose version` 必须能看到 `v2.x`。
然后试运行：

```powershell
docker run --rm hello-world
```

看到 `Hello from Docker!` 即成功。若公司网络拦 Docker Hub，这一步可能失败，不影响后续使用国内镜像版。

---

## 3. 下载 compose 文件

在 PowerShell 中：

```powershell
mkdir $HOME\fruitlab-demo -Force
cd $HOME\fruitlab-demo
```

### 3.1 国内推荐：阿里云 ACR 版

```powershell
curl.exe -fsSL https://gitee.com/cloudzun/fruitlab-r3/raw/main/deploy/student/docker-compose.cn.yml -o docker-compose.yml
```

### 3.2 默认：Docker Hub 版

如果 Docker Hub 访问正常，也可以用：

```powershell
curl.exe -fsSL https://gitee.com/cloudzun/fruitlab-r3/raw/main/deploy/student/docker-compose.yml -o docker-compose.yml
```

> 两个版本只能同时起一个，都占用 `4175` 端口。
> 国内网络优先用 **3.1 ACR 版**；它不登录阿里云，三个镜像已公开。

检查文件是否下载成功：

```powershell
Get-Content .\docker-compose.yml | Select-Object -First 5
```

看到 `name: fruitlab-student-cn`（或 `fruitlab-student-demo`）即可。

### 3.3 Gitee 打不开时

1. 浏览器打开对应 Gitee 链接；
2. 右键 → 另存为 `docker-compose.yml`；
3. 或直接把本文 **附录 A** 的 YAML 复制到 `docker-compose.yml`。

---

## 4. 启动、检查、停止

### 4.1 启动

在 `fruitlab-demo` 目录：

```powershell
docker compose -f docker-compose.yml up -d
```

第一次会拉取三个镜像，约 1–5 分钟（国内 ACR 版通常更快）。

### 4.2 检查

```powershell
docker compose -f docker-compose.yml ps
```

应看到三个容器都是 `Up (healthy)`：

```text
fruitlab-student-...-api-1   Up (healthy)
fruitlab-student-...-db-1    Up (healthy)
fruitlab-student-...-web-1   Up (healthy)
```

再执行：

```powershell
curl.exe http://127.0.0.1:4175/api/health
```

期望：

```json
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true}
```

### 4.3 打开商城

```powershell
start http://127.0.0.1:4175
```

或手动在浏览器输入 `http://127.0.0.1:4175`。

> 一定要用 `127.0.0.1:4175`，不要用 `localhost` 或随便改端口；否则可能出现 `host-not-allowed`。

### 4.4 停止 / 重置

```powershell
# 停止，保留数据
docker compose -f docker-compose.yml down

# 停止并删除数据库数据（重新 seed）
docker compose -f docker-compose.yml down -v
```

---

## 5. 商城操作步骤（必做）

### 5.1 浏览商城

1. 打开 `http://127.0.0.1:4175`。
2. 页面中部是 **商城**，应看到 **14 种商品**，每张卡有图片、名称、规格、价格、`加入购物袋` 按钮。
3. 页面下方有 **购物袋**（初始 0 件）。

### 5.2 未登录先加购

1. 点任意商品（例如“海南香蕉”）的 **加入购物袋**。
2. 右上角购物袋数量变成 1。
3. 在购物袋里点 **去结账**，系统会提示需要登录。

### 5.3 登录

1. 点右上角 **登录 / 注册**。
2. 用户名：`userA`
3. 口令：`demo1234`
4. 点 **登录**。
5. 成功后导航会显示 `我的订单`、`退出登录`。

### 5.4 加购与改数量

1. 在商城加购 2 种商品，例如香蕉 + 苹果。
2. 在 **购物袋**：
   - 用 `+` / `-` 改数量；
   - 看单项小计和 **合计**。
3. 点 **去结账**。

### 5.5 下单与订单号

1. 结账成功后出现 **订单已提交** 收据。
2. 记录订单号，格式类似：

```text
FL-20261019-014341-ZJ02
```

3. 收据里有下单时间、商品、数量、单价、合计。

### 5.6 我的订单

1. 点导航 **我的订单**；
2. 点 **刷新**；
3. 应看到刚才的订单，金额与收据一致。

### 5.7 查订单

1. 点导航 **查订单**；
2. 输入订单号（首尾空格、字母大小写会被忽略）；
3. 点 **查询**，应返回该订单；只能查自己账号下的订单。

### 5.8 重启后数据仍在

```powershell
docker compose -f docker-compose.yml restart
```

浏览器刷新 → 重新登录 `userA` → **我的订单** 里订单仍在。
说明数据在 Postgres volume 中，不是浏览器本地存储。

---

## 6. 管理员面板（必做）

### 6.1 登录管理员

1. 先点 **退出登录**（如果当前是 userA）。
2. 用 `admin` / `demo1234` 登录。
3. 导航会出现 **管理**，点进去。

### 6.2 订单面板

1. **订单** 区域点 **刷新**；
2. 可看到所有用户的订单（不只是自己的）；
3. 核对订单号、时间、商品、合计。

### 6.3 商品面板

1. **商品** 区域点 **刷新**；
2. 每个商品有：
   - **价格（分）**：例如 `899` 表示 ¥8.99；
   - **库存**；
   - **保存**；
   - **上架 / 下架**。
3. 做一次练习：
   - 把“海南香蕉”库存改成 `50`，点 **保存**；
   - 状态显示 `已保存`；
   - 回到 **商城** 刷新，库存已更新；
   - 把价格改回原值，避免影响后续同学。
4. 点 **下架** 后，该商品从商城消失；再点 **上架** 恢复。

> 管理员的所有修改直接写数据库，重启容器后仍保留。

---

## 7. 停止与清理

```powershell
# 停止（保留订单/账号数据，下次还能看）
docker compose -f docker-compose.yml down

# 彻底清理（删数据库，下次重新 seed）
docker compose -f docker-compose.yml down -v
```

建议下课前执行 `down`；如果机房多人共用电脑，执行 `down -v` 清空。

---

## 8. 常见问题

| 现象 | 处理 |
|---|---|
| `docker` 不是命令 | Docker Desktop 没装好/没启动；重开 PowerShell |
| Docker Desktop 左下角不是 Engine running | 点启动；等状态变绿 |
| `wsl --install` 报错 | 用管理员 PowerShell；重启；`wsl --update`；检查 BIOS 虚拟化 |
| `docker compose` 不是命令 | Docker Desktop 版本太旧；升级到带 Compose v2 的版本 |
| Docker Hub 拉取超时 | 改用 **国内 ACR 版** `docker-compose.cn.yml` |
| `pull access denied` | 确认用的是 ACR 版；三个 ACR 仓库已公开，不需要登录 |
| 4175 被占用 | `netstat -ano \| findstr :4175` 找到 PID，`taskkill /PID <PID> /F`；或改端口并同步 `PUBLIC_URL` |
| 页面打开但 API 403 `host-not-allowed` | 用 `127.0.0.1:4175`；不要只改端口不改 `PUBLIC_URL` |
| 订单没了 | 执行过 `down -v` 会删数据；只 `down` 不会 |
| 管理员入口看不到 | 确认用 `admin/demo1234` 登录；普通账号不显示“管理” |
| 修改价格后金额不对 | 价格单位是“分”，`899` = ¥8.99 |

---

## 9. 提交/验收清单

- [ ] `docker compose ps` 三个容器 healthy
- [ ] `/api/health` 返回 `version: 3.5.0.0`
- [ ] 完成一次登录 + 加购 + 下单，记录订单号
- [ ] 我的订单 / 查订单能看到该订单
- [ ] `docker compose restart` 后订单仍在
- [ ] 管理员面板改一次库存并保存，商城能看到变化
- [ ] 说明自己用的是 Docker Hub 版还是 ACR 版

---

## 附录 A：国内 ACR compose 全文（离线备用）

把下面内容保存为 `docker-compose.yml`：

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

> Docker Hub 默认版只需把三个 `image:` 换成：
> - `postgres:16-alpine`
> - `chengzh/fruitlab-r3:3.5.0.0`
> - `chengzh/fruitlab-r3-web:3.5.0.0`

## 附录 B：命令速查

```powershell
cd $HOME\fruitlab-demo

# 启动
docker compose -f docker-compose.yml up -d

# 状态 / 健康
docker compose -f docker-compose.yml ps
curl.exe http://127.0.0.1:4175/api/health

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
| 本机地址 | `http://127.0.0.1:4175` |
| 普通用户 | `userA` / `userB`，口令 `demo1234` |
| 管理员 | `admin` / `demo1234` |
| Docker Hub 镜像 | `chengzh/fruitlab-r3:3.5.0.0`、`chengzh/fruitlab-r3-web:3.5.0.0` |
| ACR 镜像 | `registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3:3.5.0.0` 等 |
| Gitee compose | `https://gitee.com/cloudzun/fruitlab-r3/raw/main/deploy/student/` |
