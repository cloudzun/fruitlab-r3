# Killercoda 实例实测（2026-10-19）

> 实例：`https://bf808e6e6d5b67d9-1-4175.papa.r.killercoda.com`
> 用途：验证“Linux 虚机 + Docker + IP:端口”学生上机方案。

## 1. 修正前

```text
GET /api/health → 403
{"ok":false,"code":"host-not-allowed","message":"请求 Host 不被允许"}
```

原因：compose 里 `PUBLIC_URL` 仍是 `http://127.0.0.1:4175`，Killercoda 通过自己的 HTTPS 域名代理访问。

## 2. 修正

```bash
PUBLIC_URL="https://bf808e6e6d5b67d9-1-4175.papa.r.killercoda.com"
sed -i "s|PUBLIC_URL: .*|PUBLIC_URL: $PUBLIC_URL|" docker-compose.yml
docker compose -f docker-compose.yml up -d --force-recreate
```

## 3. 修正后

```text
GET /api/health → 200
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true}
```

浏览器实测：

- 首页：14 种商品加载正常
- `userA/demo1234` 登录成功
- 加购海南香蕉 → 去结账 → 订单 `FL-20261019-022022-CTZ9`
- 我的订单显示该订单
- 页面未出现 `host-not-allowed`

## 4. 结论

- Killercoda 方案可行；关键是 `PUBLIC_URL` 必须等于 Killercoda 暴露的 HTTPS 地址。
- 手册已改为 Linux/Killercoda 版本，并保留“下载后 sed 注入 PUBLIC_URL”的步骤。
- Gitee 上的 compose 仍是旧版硬编码；手册的 sed 步骤兼容旧版和后续变量版。
