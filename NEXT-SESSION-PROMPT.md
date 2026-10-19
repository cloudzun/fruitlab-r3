# FruitLab R3.5 下一个会话 · 启动提示词

> **用法**：把下面分隔线之间的内容整段复制到新会话。
> **目的**：让新会话快速建立项目上下文，在**不改错版本、不重复造轮子、不产生云成本**的前提下继续工作。

---

你是 FruitLab 项目的后续开发代理。先不要写代码，也不要启动云资源。

**第一步：读文档、看仓库状态，然后向我复述你的理解；等我确认后，再开始具体任务。**

## 一、项目是什么

FruitLab 是《通用 AI Coding 现代软件工程实战》课程的配套教学演示商城，用来演示从浏览器端到服务端、数据库、容器化、部署与学员复现的迭代过程。

当前工作区有两部分：

1. **课程与教材**：`C:\Users\cheng\OneDrive - CloudZun Studio\Project\2026 年度项目\20261008 浙江移动AICoding`
2. **当前代码仓库**：`D:\vibecoding\easyvibe\r3-fruitlab`

版本关系：

- R1：`1.0.0.0`，纯浏览器端，10 商品，localStorage，62 测试；代码在 `D:\vibecoding\easyvibe\r1-fruitlab`，**永久冻结**。
- R2：`2.0.0.0`，Node + SQLite，14 商品，账号/角色/管理员/CLI，96 测试；代码在 `D:\vibecoding\easyvibe\r2-fruitlab`，**R3 起冻结**。
- R3：`3.0.0.0`，PostgreSQL 16 + 逻辑三层 + 三容器，可部署/备份恢复；当前仓库就是 R3 线。
- R3.5：`3.5.0.0`，**没有新增业务功能**；做 CI/CD、公开仓库、公开镜像、A/B/C 学员复现环境、零配置 demo、文档与验证。

## 二、先读这些（按顺序）

1. `R1-R3.5-迭代概述.md` —— 四轮主线、承接关系、各阶段文档路径
2. `R3.5-总结.md` —— 当前交付状态；明确“无新增功能”
3. `docs/student/overview.md` —— 当前 R3 架构与功能（不讲 R1/R2 演进）
4. `PRD-R3.md` —— R3 的架构/端口/分层/部署约束
5. `PRD-R3.5.md` —— R3.5 的范围与非目标
6. `README.md`、`CHANGELOG.md`、`DECISIONS.md` —— 运行方式、版本、历史决策
7. `docs/student/README.md`、`quickstart.md`、`development.md`、`troubleshooting.md` —— 学员 A/B/C 路径
8. `通用AI_Coding课程与教材\HANDOFF.md` —— 课程侧交接（按当前版本阅读）

如要追溯历史，再看课程工作区 `reference-app/reports/` 下的 R1/R2/R3 八环讲解记录；**不要凭记忆补历史**。

## 三、当前状态（先核对，不要假设）

- 版本：`3.5.0.0`
- 测试：**140/140**，真实 PostgreSQL
- 公开仓库：`https://github.com/cloudzun/fruitlab-r3`
- 镜像：
  - Docker Hub：`chengzh/fruitlab-r3:3.5.0.0`、`chengzh/fruitlab-r3-web:3.5.0.0`
  - 阿里云 ACR：`registry.cn-hangzhou.aliyuncs.com/chengzh/...:3.5.0.0`
  - 三个 ACR 仓库公开，匿名可拉；**不需要登录**
- 云资源：截至 2026-10-19，**阿里云 ECS/EIP/VPC/安全组与 Azure Demo 资源均已删除**；不要假设有在线 Demo。
- 本地：仓库、公开镜像、学生文档、证据保留。
- 学员环境：
  - A Killercoda（临时）
  - B Linux 虚机 + Docker（持久）
  - C 纯本地 Node 22 + PostgreSQL 16（无 Docker）
- 网络事实：
  - 国内 ECS 访问 GitHub raw 可能 `Connection reset`
  - 学员主路径用 Gitee compose + ACR
  - `start-demo.sh` 是 GitHub 可达时的可选项
- Demo 开关：`DEMO_ALLOW_ANY_HOST=1`
  - 只在 `APP_ENV!=production` 生效
  - 跳过 Host/Origin 白名单
  - 支持 127.0.0.1、局域网 IP、Killercoda/隧道域名
  - **生产模式仍严格校验，不能把开关带进生产**

## 四、铁律

1. **只改 `r3-fruitlab`**；R1/R2 冻结，一行不改。
2. **不要给 R1/R2 做容器镜像**；只有 R3 进入容器/发布线。
3. **R3.5 不加业务功能**。要加功能，先明确是否进入 R3.6/R4，并单独讨论。
4. **不要在未确认时创建云资源**。阿里云/Azure 都要花钱；先说明资源、预算、清理方案。
5. **不要提交密钥**：阿里云 AK/SK、Docker Hub token、ACR 密码、数据库密码一律不入库。
6. **不要用 `PUBLIC_URL` 解决 demo 地址问题**；demo 用 `DEMO_ALLOW_ANY_HOST=1`，严格模式才用 `PUBLIC_URL`。
7. **不要凭记忆补文档**；先查仓库/课程证据，路径和数字以文件为准。
8. **不要删除/覆盖 R3.5 证据**；新增验证要追加到 `evidence/r3.5/` 或新目录。
9. **不要擅自重写学生文档结构**；入口/overview/quickstart/development/troubleshooting 已对齐 A/B/C 场景。
10. **改动前先看 `git status` 和 `git log -5`**，确认工作树干净、没有别人的未提交修改。

## 五、开始工作前先做

```bash
cd D:\vibecoding\easyvibe\r3-fruitlab
git status --short
git log --oneline -5
```

然后读第二节文档，向我复述：

- 当前版本与四轮迭代关系
- 当前架构（Postgres + L1 三层 + L2 三容器）
- A/B/C 三种环境的区别
- 哪些东西已冻结、哪些不能做
- 你准备执行的任务与验证方式

**确认后再动手。**

## 六、开发与验证命令

```bash
# 依赖
npm ci

# 测试 Postgres（Docker）
node scripts/pgctl.mjs up

# 全量测试（Node 22 + 真实 PG）
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres \
  node --test --test-concurrency=4

# 机械校验
node scripts/verify.mjs --quick

# 计数/证据刷新
node scripts/record-test-count.mjs
node scripts/verify-evidence.mjs --write
```

- 测试数量以 `evidence/test-count.txt` 为准。
- 提交前跑 `node scripts/verify.mjs --quick`；涉及文档/证据时刷新 manifest。
- 不要声称“跑过”而没有输出；需要时用 CI 或本地日志证明。

## 七、部署与学员环境

- B（Docker）：`deploy/student/docker-compose.cn.yml` + `docker-compose.yml`
- 学生启动器：`deploy/student/start-demo.sh`（GitHub 可达时）
- C（无 Docker）：`node cli.mjs dev --port 4176`
  - 本机/局域网同时可用：
    ```bash
    HOST=0.0.0.0 DEMO_ALLOW_ANY_HOST=1 COOKIE_SECURE=0 \
      node cli.mjs dev --port 4176
    ```
  - 不需要 `PUBLIC_URL`
- 生产/严格模式：`HOST=0.0.0.0 PUBLIC_URL=http://<地址>:<端口>`，地址必须完全一致。
- 云上 Demo 如需重建：先给方案与成本，使用独立资源组/命名，验证完删除 ECS/EIP/VPC/安全组。

## 八、关键文档地图

| 内容 | 路径 |
|---|---|
| 四轮迭代概述 | `R1-R3.5-迭代概述.md` |
| R3.5 总结 | `R3.5-总结.md` |
| 当前架构/功能 | `docs/student/overview.md` |
| 学生入口 | `docs/student/README.md` |
| 快速测试 A/B | `docs/student/quickstart.md` |
| 克隆与开发 B/C | `docs/student/development.md` |
| 排错 | `docs/student/troubleshooting.md` |
| R3 PRD | `PRD-R3.md` |
| R3.5 PRD | `PRD-R3.5.md` |
| 执行/复盘 | `R3.5-执行记录.md`、`R3.5-retro.md` |
| 学员镜像验证 | `evidence/r3.5/student-public.md` |
| B/C 验证 | `evidence/r3.5/bc-lab.md` |
| 零配置验证 | `evidence/r3.5/demo-any-host.md` |
| Killercoda | `evidence/r3.5/killercoda.md` |

## 九、任务边界

当前 R3.5 已收口，没有默认待办。接到新任务时：

1. 先判断属于哪个版本（R3.5 修补 / R3.6 / R4）；
2. 说明会改哪些文件、跑哪些验证、是否需要云资源；
3. 得到确认后执行；
4. 完成后更新文档/证据，跑校验，报告结果和遗留风险。

如果你觉得项目信息不足，先读文档并列出缺口，不要猜。
