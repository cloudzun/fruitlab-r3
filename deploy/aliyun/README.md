# 阿里云杭州 Demo（IP + 端口，无域名/无 TLS）

> **状态：演示资源已删除（2026-10-19）**；以下内容仅作复现记录，不要照抄 IP/资源 ID。
> 原演示：`http://116.62.60.211:4175`（已下线）
> 账号：`userA` / `userB` / `admin`，口令 `demo1234`（`APP_ENV=development`）。
> 镜像仓库：`registry.cn-hangzhou.aliyuncs.com/chengzh/{fruitlab-r3,fruitlab-r3-web,postgres}`。
> 仅课堂/内部 demo：HTTP 明文、安全组 22/4175 全开；演示完请 stop/destroy。

## 1. 资源

| 资源 | 值 |
|---|---|
| 地域 | `cn-hangzhou` |
| VPC | `vpc-bp1ybdws9qr9oazcvj6ro` |
| vSwitch | `vsw-bp1a65vtodrk5tbhzy8hp`（cn-hangzhou-h） |
| 安全组 | `sg-bp1czqqz0653spw0s0an`（22/4175，0.0.0.0/0） |
| ECS | `i-bp1hfqh71we8i4xjf9yy`，`ecs.e-c1m2.large`（2C4G），Ubuntu 24.04 |
| EIP | `eip-bp1cf4jxnb6864buf5bp3` / `116.62.60.211` |
| ACR | `registry.cn-hangzhou.aliyuncs.com/chengzh` |

## 2. 当前部署

```bash
# ECS 上
cd /opt/fruitlab
docker compose -f docker-compose.demo.yml ps
docker compose -f docker-compose.demo.yml logs --tail=50 api web
```

镜像：

| 镜像 | digest |
|---|---|
| `registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3:3.5.0.0` | `sha256:65ae8a4d10a711f42f4881443e886c34386e980a6829530b64fa57ebd780529f` |
| `.../fruitlab-r3-web:3.5.0.0` | `sha256:b56a2592be8182e7d9cfcfa666a21be5f8e0cc8a0a59d9b3db2e9f2c832ce568` |
| `.../postgres:16-alpine` | `sha256:1a66d744c1b459e13b05a8fca341da84cb63383e99ce262210efee5a319d4551` |

## 3. 重新部署/更新

```bash
# 本地（WSL）
docker login --username=cloudzun registry.cn-hangzhou.aliyuncs.com
docker buildx build --platform linux/amd64 --provenance=false --sbom=false \
  --output type=docker -t registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3:3.5.0.0 .
docker buildx build --platform linux/amd64 --provenance=false --sbom=false \
  --output type=docker -f Dockerfile.web \
  -t registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3-web:3.5.0.0 .
docker push registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3:3.5.0.0
docker push registry.cn-hangzhou.aliyuncs.com/chengzh/fruitlab-r3-web:3.5.0.0

# ECS
docker login --username=cloudzun registry.cn-hangzhou.aliyuncs.com
cd /opt/fruitlab
docker compose -f docker-compose.demo.yml pull
docker compose -f docker-compose.demo.yml up -d
```

> ACR 个人版不接受 Docker Hub 拉下来的多平台 OCI index（`application/vnd.oci.empty.v1+json` 报错），所以用本地单平台重建 + `--provenance=false --sbom=false` 后推送。

## 4. 校验

```bash
curl http://116.62.60.211:4175/api/health
# {"ok":true,"db":"up","version":"3.5.0.0",...}
bash deploy/aliyun/smoke-http.sh
# login=200 / order=201 / home=200
```

## 5. 停止/清理

```bash
# 停止 ECS（保留磁盘/数据）
aliyun ecs StopInstance --InstanceId i-bp1hfqh71we8i4xjf9yy

# 彻底清理（按顺序）
aliyun ecs StopInstance --InstanceId i-bp1hfqh71we8i4xjf9yy --ForceStop true
aliyun ecs DeleteInstance --InstanceId i-bp1hfqh71we8i4xjf9yy --Force true
aliyun vpc UnassociateEipAddress --AllocationId eip-bp1cf4jxnb6864buf5bp3
aliyun vpc ReleaseEipAddress --AllocationId eip-bp1cf4jxnb6864buf5bp3
aliyun ecs DeleteSecurityGroup --RegionId cn-hangzhou --SecurityGroupId sg-bp1czqqz0653spw0s0an
aliyun vpc DeleteVSwitch --RegionId cn-hangzhou --VSwitchId vsw-bp1a65vtodrk5tbhzy8hp
aliyun vpc DeleteVpc --RegionId cn-hangzhou --VpcId vpc-bp1ybdws9qr9oazcvj6ro
```

> 当前 EIP 是包年包月？按量 EIP 不释放会继续计费；停 ECS 后仍建议释放 EIP。
