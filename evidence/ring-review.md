# 证据 · review 环（R3，4/7 环）

> 对象：build 提交 `1a56eb0`；修复提交见 git log（review 环收尾提交）。
> 执行：codex 独立子代理只读复核 + 官方 `/cso` launcher（WSL）+ 人工处置与回归测试。

## 1. 真实命令与产物

```powershell
# codex 同族复核（stdin 提示，避免 PowerShell 多行参数问题）
Get-Content evidence/codex/review-prompt.txt -Raw |
  & "C:\Users\cheng\AppData\Local\OpenAI\Codex\bin\9614f1d9b40d9c4f\codex.exe" exec `
    -c model="opencode-go/deepseek-v4.1-flash" -c model_reasoning_effort="medium" `
    --sandbox danger-full-access -C "D:\vibecoding\easyvibe\r3-fruitlab" -
# 报告：evidence/codex/review-codex.md（同族，非跨模型）；13 findings

# 官方 cso（WSL）
wsl -e bash -lc 'cd /mnt/c/Users/cheng/gstack/bin && ./gstack-cso-launcher start --repo /mnt/d/vibecoding/easyvibe/r3-fruitlab --code --offline --budget 600'
# run 1792294626627-4aa9fb56ea93339d；submit 4 findings；finish → finished / partial
```

- cso 产物：`evidence/cso-r3/`（report.md、report.json、submission.json、start.json、inspect.json、snapshot.json、history-status.json）。
- 第一次 `start` 生成的 run 未提交、未 finish，作为“启动尝试”保留在 launcher 状态中；正式 run 为上述 id，报告如实写 `partial`。

## 2. codex findings（13 条）与修复

| 编号 | 级别 | 摘要 | 状态 |
|---|---|---|---|
| F-R3-01 | High | router 把 SQLSTATE 字符串当应用错误码 → 500 且泄露 | 已修 + 测试 |
| F-R3-02 | High | classroom/production seed 未隔离，演示库可当生产 | 已修（app_meta + 拒绝污染）+ 测试 |
| F-R3-03 | High | restore 缺表/缺列被当空表，恢复可“成功清库” | 已修（固定白名单 + schemaVersion + 行数校验）+ 测试 |
| F-R3-04 | High | health 不签发 CSRF cookie，客户端恢复路径不可用 | 已修 + 测试 |
| F-R3-05 | Medium | 账号桶键含 IP、成功清 IP 桶 | 已修 + 测试 |
| F-R3-06 | Medium | `getForUpdate` 无 `FOR UPDATE`、扣库存不校验 listed | 已修 + 测试 |
| F-R3-07 | Medium | `--port` 覆盖后 publicOrigin 未重建 | 已修 + 进程级测试 |
| F-R3-08 | Medium | Host 白名单缺 `localhost:<port>` | 已修 + 测试 |
| F-R3-09 | Medium | 无会话 logout 返回 401 | 已修 + 测试 |
| F-R3-10 | Medium | CLI 未把 40001/40P01/57014/55P03 映射为退出码 3 | 已修 + 测试 |
| F-R3-11 | Medium | restore.sh 未校验就启动 api | 已修（脚本校验失败即停） |
| F-R3-12 | Medium | health 超时不销毁连接，可能耗尽池 | 已修（release(true)）+ 测试 |
| F-R3-13 | Medium | `.env.example` 占位口令可通过 production 校验 | 已修 + 测试 |

## 3. cso（官方 launcher）结果

- run `1792294626627-4aa9fb56ea93339d`；submit 4 findings；finish `partial`；elapsed 498s。
- 4 条 Low：备份权限/内容、限流进程内、本地无 TLS、CLI restore 版本校验。
- 处置：备份 0700/0600 已修；restore schemaVersion 已修；限流与 TLS 作为文档边界（单实例/localhost demo）。
- 未评估：history-inputs、stride、data-classification；离线 scanner profiles 不可用；二进制图片 withheld。**不称全量通过**。

## 4. 回归与门禁

```text
node --test --test-concurrency=4   # 137/137 pass（连续 4 次 0 失败）
node scripts/record-test-count.mjs
node scripts/verify.mjs --full     # PASS（见 ring-ship/最终证据）
```

## 5. 诚实边界

1. codex 复核未运行测试/容器；是同族静态复核。
2. cso 是离线静态 run（`partial`），不是跨模型、不是全量安全通过。
3. F-R3-11（restore.sh）为容器脚本，未纳入 `node --test`，以脚本 + qa 环手工恢复证据为准。
4. 修复后的复测：以 qa 环的真实容器/浏览器证据和 ship 环最终 verify 为准。
