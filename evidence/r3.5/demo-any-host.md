# 零配置 Demo（DEMO_ALLOW_ANY_HOST）验证（2026-10-19）

> 目标：Killercoda/ECS/Azure/ngrok 等外部地址不写 `PUBLIC_URL` 也能启动。
> 机制：`DEMO_ALLOW_ANY_HOST=1`，**仅 `APP_ENV!=production` 生效**；生产仍严格 Host/Origin 白名单。

## 1. 代码

- `config.mjs`：`demoAllowAnyHost: !isProduction && DEMO_ALLOW_ANY_HOST`
- `server/router.mjs`：`checkGuards()` 在 `demoAllowAnyHost` 时跳过 Host/Origin/Sec-Fetch-Site 检查
- 单元测试：`tests/demo-host.test.mjs`
  - development + 开关 → true
  - production + 开关 → false
  - 严格模式任意 Host → 403
  - demo 模式任意 Host + Origin → 200

## 2. 镜像

为支持该开关，`3.5.0.0` demo 镜像已重建并推送：

| 镜像 | digest |
|---|---|
| `chengzh/fruitlab-r3:3.5.0.0` | `sha256:65ae8a4d10a711f42f4881443e886c34386e980a6829530b64fa57ebd780529f` |
| `chengzh/fruitlab-r3-web:3.5.0.0` | `sha256:b56a2592be8182e7d9cfcfa666a21be5f8e0cc8a0a59d9b3db2e9f2c832ce568` |
| ACR 同名 tag | 同上 digest |

## 3. 零配置验证

```bash
# start-demo.sh 内部生成 override，设置 DEMO_ALLOW_ANY_HOST=1，并 pull 新镜像
bash start-demo.sh

# 模拟任意外部 Host/Origin
curl -H "Host: demo.killercoda.com" http://127.0.0.1:4175/api/health
→ 200 {"ok":true,"db":"up","version":"3.5.0.0",...}

userA 登录 / 下单
→ login=200 / order=200（幂等已有订单）
```

## 4. 结论

- 学生不再需要复制 Killercoda URL、不再需要 `sed PUBLIC_URL`；
- `start-demo.sh` 一条命令 + Killercoda 暴露 4175 即可；
- 生产 compose 不设置该开关，Host/Origin 白名单保持严格。
