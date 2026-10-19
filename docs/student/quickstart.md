# 快速测试（A Killercoda / B Linux 虚机）

> 目标：10–20 分钟把 FruitLab 跑起来，完成一次商城下单和管理员改库存。
> A/B 都用 Docker + **Gitee compose**（国内可达）；A 临时，B 持久。

## 0. 网络前提（实测）

- **Gitee 可达**：下载 compose；
- **阿里云 ACR 可达**：拉三个公开镜像（B 实测走 ACR，Docker Hub 未作为主路径）；
- **GitHub raw 不一定可达**：阿里云 ECS 实测 `raw.githubusercontent.com` 会 `Connection reset`。
  所以本文**不依赖 GitHub**；如果要用 `start-demo.sh`，需先确认 GitHub 可访问。
- 不需要域名、HTTPS 配置；应用用 `DEMO_ALLOW_ANY_HOST=1`，不需要设置 `PUBLIC_URL`。

## 1. A. Killercoda 沙盒（快速、不持久）

### 1.1 开实例

1. <https://killercoda.com/playgrounds>
2. 选 **Ubuntu 24.04**（或 **Docker** playground）
3. Start，等待终端

### 1.2 有 Docker 就跳过安装

```bash
docker --version
docker compose version
```

没有 Docker：

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo service docker start
```

装不到 compose 插件时：

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo service docker start
```

### 1.3 暴露 4175

Killercoda 页面 → **Traffic**（或 **Ports**）→ 输入 `4175` → Open/Access，复制 HTTPS 地址。

### 1.4 启动

```bash
mkdir -p ~/fruitlab-demo
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

打开 **1.3 复制的 Killercoda 地址**。

> A 的特点：**实例结束/过期后数据消失**。要长期运行，用 B。

## 2. B. Linux 虚机 + Docker（持久）

### 2.1 机器

- Ubuntu 24.04（或同类 Linux）
- 2 vCPU / 4 GB 内存 / 20 GB 磁盘起
- 安全组/防火墙入方向：`4175`（SSH 按需）

### 2.2 安装 Docker

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git curl ca-certificates
sudo service docker start
sudo usermod -aG docker "$USER"
newgrp docker

docker --version
docker compose version
```

### 2.3 启动

```bash
mkdir -p ~/fruitlab-demo
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

浏览器打开：

```text
http://<虚机公网IP>:4175
```

> B 的特点：容器数据在 Docker volume 中；`down` 不删数据，`down -v` 才删。
> **实测网络**：Docker Hub 可能超时；本文用 Gitee compose 的 ACR 镜像。

## 3. 检查

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml ps
curl -sS http://127.0.0.1:4175/api/health
```

期望：

```text
fruitlab-student-cn-api-1  Up (healthy)
fruitlab-student-cn-db-1   Up (healthy)
fruitlab-student-cn-web-1  Up (healthy)

{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true}
```

## 4. 商城操作（必做）

1. 打开商城，确认 **14 种商品**；
2. 未登录加购 → 去结账 → 提示登录；
3. 用 `userA / demo1234` 登录；
4. 加购香蕉/苹果，用 `+/-` 改数量；
5. 去结账，记录订单号（`FL-YYYYMMDD-HHMMSS-XXXX`）；
6. **我的订单** → 刷新，核对金额；
7. **查订单** → 输入订单号 → 查询；
8. 刷新页面/重启容器，订单仍在（B 持久；A 在实例存活期内）。

## 5. 管理员面板（必做）

1. 退出 `userA`；
2. 用 `admin / demo1234` 登录；
3. 导航出现 **管理**；
4. **订单** → 刷新：查看所有用户订单；
5. **商品** → 刷新：
   - 价格单位是“分”（`899` = ¥8.99）；
   - 改库存/价格 → **保存**；
   - **下架** 后商城不显示，**上架** 恢复；
6. 回商城刷新，确认变化；练习后改回原值。

## 6. 停止 / 清理

```bash
# 停止，保留数据
docker compose -f docker-compose.yml -f docker-compose.override.yml down

# 停止并删数据
docker compose -f docker-compose.yml -f docker-compose.override.yml down -v
```

## 7. 可选：start-demo.sh

只有确认 GitHub 可达时：

```bash
curl -fsSL https://raw.githubusercontent.com/cloudzun/fruitlab-r3/main/deploy/student/start-demo.sh -o start-demo.sh
bash start-demo.sh
```

> 阿里云 ECS 实测 GitHub raw 可能 reset；失败就用上面的 Gitee 主路径。

## 8. 验收

- [ ] 三容器 healthy
- [ ] `/api/health` 返回 `version: 3.5.0.0`
- [ ] 登录 + 加购 + 下单成功，记录订单号
- [ ] 我的订单 / 查订单可查到
- [ ] 重启后订单仍在（B；A 在实例存活期内）
- [ ] 管理员改库存并保存，商城可见
- [ ] 能说明自己用的是 A 还是 B
