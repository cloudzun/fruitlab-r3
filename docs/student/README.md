# FruitLab 学生文档入口

> 当前版本：`3.5.0.0`
> 只讲当前版本；不涉及历史版本迭代。

## 先选场景

| 你的目标 | 推荐环境 | 看哪份文档 |
|---|---|---|
| 10 分钟看效果、课堂验证 | **A. Killercoda 沙盒** | [`quickstart.md`](quickstart.md) A 节 |
| 连续几天运行、课堂服务器、想保留数据 | **B. Linux 虚机 + Docker** | [`quickstart.md`](quickstart.md) B 节 |
| 克隆仓库、改代码、研究实现 | **B（有 Docker）或 C（无 Docker）** | [`development.md`](development.md) |
| 想知道项目是什么、架构/功能 | 任意 | [`overview.md`](overview.md) |
| 遇到报错 | 任意 | [`troubleshooting.md`](troubleshooting.md) |

## 三种环境

| | A Killercoda | B Linux 虚机 | C 纯本地无 Docker |
|---|---|---|---|
| 安装成本 | 最低（浏览器） | 中（装 Docker） | 高（Node 22 + PostgreSQL 16） |
| 持久化 | **不持久**，实例过期即消失 | 持久（磁盘/卷） | 持久（本机 PG） |
| 适合开发 | 不适合 | 适合 | 适合（无 Docker 时） |
| 启动方式 | Traffic 开 4175 → `start-demo.sh` | 安全组开 4175 → `start-demo.sh` | `node cli.mjs dev` |
| 推荐场景 | 快速测试 | 长期运行/课堂 | 克隆研究/二次开发 |

## 快速入口

- 快速测试（A/B）：[`quickstart.md`](quickstart.md)
- 克隆与开发（B/C）：[`development.md`](development.md)
- 项目概览：[`overview.md`](overview.md)
- 排错：[`troubleshooting.md`](troubleshooting.md)

## 一句话

- **只想看效果**：Killercoda + `start-demo.sh`；
- **想长期运行**：Linux 虚机 + Docker；
- **想改代码**：B 或 C，看 `development.md`；
- **A 是临时沙盒，不适合开发。**
