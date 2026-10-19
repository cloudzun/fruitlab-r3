# 学生端公开镜像验证（2026-10-19）

> 目标：学生本地只有 Docker，不登录任何镜像仓库，能启动。
> 提供两个 compose：
> - `deploy/student/docker-compose.yml`：Docker Hub 默认
> - `deploy/student/docker-compose.cn.yml`：阿里云 ACR 国内专用

## 1. 默认 Docker Hub（匿名）

```text
docker logout
docker rmi chengzh/fruitlab-r3:3.5.0.0 chengzh/fruitlab-r3-web:3.5.0.0
docker pull chengzh/fruitlab-r3:3.5.0.0      → sha256:14c9b5bb...08599606
docker pull chengzh/fruitlab-r3-web:3.5.0.0  → sha256:121a2bc3...52fa0c7cc

docker compose -f deploy/student/docker-compose.yml up -d
fruitlab-student-demo-api-1  Up (healthy)
fruitlab-student-demo-db-1   Up (healthy)
fruitlab-student-demo-web-1  Up (healthy)

curl http://127.0.0.1:4175/api/health
{"ok":true,"db":"up","version":"3.5.0.0",...}
userA 登录=200；下单=201（FL-20261019-014341-ZJ02）；首页=200
```

## 2. 国内专用 ACR（匿名）

```text
docker logout registry.cn-hangzhou.aliyuncs.com
docker rmi registry.cn-hangzhou.aliyuncs.com/chengzh/{fruitlab-r3,fruitlab-r3-web,postgres}:...
docker compose -f deploy/student/docker-compose.cn.yml pull
→ api / web / postgres 均 Pulled（无登录）

docker compose -f deploy/student/docker-compose.cn.yml up -d
fruitlab-student-cn-api-1  Up (healthy)
fruitlab-student-cn-db-1   Up (healthy)
fruitlab-student-cn-web-1  Up (healthy)

curl http://127.0.0.1:4175/api/health
{"ok":true,"db":"up","version":"3.5.0.0",...}
```

## 3. 学生命令

默认 Docker Hub：

```powershell
curl.exe -fsSL https://raw.githubusercontent.com/cloudzun/fruitlab-r3/main/deploy/student/docker-compose.yml -o fruitlab-student.yml
docker compose -f fruitlab-student.yml up -d
```

国内 ACR：

```powershell
curl.exe -fsSL https://raw.githubusercontent.com/cloudzun/fruitlab-r3/main/deploy/student/docker-compose.cn.yml -o fruitlab-student-cn.yml
docker compose -f fruitlab-student-cn.yml up -d
```

打开 http://127.0.0.1:4175，账号 `userA/demo1234`。
两者都占 4175，同一时间只能起一个；切换前先 `down`。

## 4. 结论

- Docker Hub 两个业务镜像公开；`postgres:16-alpine` 官方公开。
- ACR 三个仓库已公开；匿名拉取成功。
- 默认 compose 与国内 compose 都实测通过，不需要 `docker login`。
- 当前本机保留默认 Docker Hub 栈运行；ECS 公网 demo 仍为 <http://116.62.60.211:4175>。
