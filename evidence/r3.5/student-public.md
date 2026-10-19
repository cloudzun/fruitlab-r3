# 学生端公开镜像验证（2026-10-19）

> 目标：学生本地只有 Docker，不登录阿里云，直接拉三个 ACR 公开镜像并启动。
> 方法：先 `docker logout` ACR，删除本地 ACR 镜像缓存，再匿名 `docker pull`；随后用 `deploy/student/docker-compose.yml` 启动。

## 1. 匿名拉取

```text
docker logout registry.cn-hangzhou.aliyuncs.com
docker rmi registry.cn-hangzhou.aliyuncs.com/chengzh/{fruitlab-r3,fruitlab-r3-web,postgres}:...

docker pull registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3:3.5.0.0
  Digest: sha256:85e805b38281ede9e138f4b2d2cb9d166ff22ef395913f98926b98865026366d
  Status: Downloaded newer image

docker pull registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3-web:3.5.0.0
  Digest: sha256:7510b39f0d1d687da0b4fbebb355c0e412100cb306bcae55201bbd02a669dd77
  Status: Downloaded newer image

docker pull registry.cn-hangzhou.aliyuncs.com/chengzh/postgres:16-alpine
  Digest: sha256:1a66d744c1b459e13b05a8fca341da84cb63383e99ce262210efee5a319d4551
  Status: Downloaded newer image
```

## 2. 学生 compose 启动

```text
docker compose -f deploy/student/docker-compose.yml up -d

fruitlab-student-demo-api-1   Up (healthy)
fruitlab-student-demo-db-1    Up (healthy)
fruitlab-student-demo-web-1   Up (healthy)

GET http://127.0.0.1:4175/api/health
{"ok":true,"db":"up","version":"3.5.0.0","schemaVersion":2,"seeded":true,...}
```

## 3. 业务闭环

```text
userA login=200
create_order=201（FL-20261019-013052-HHNY）
home=200
```

## 4. 结论

- 三个 ACR 仓库已公开；学生**不需要 docker login / 阿里云账号**。
- 学生本地命令：
  ```bash
  docker compose -f deploy/student/docker-compose.yml up -d
  # http://127.0.0.1:4175，userA/demo1234
  ```
- 本地验证用的 student 栈已启动；ECS 公网 demo 仍为 <http://116.62.60.211:4175>。
