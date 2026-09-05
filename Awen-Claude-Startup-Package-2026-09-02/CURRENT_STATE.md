# 当前项目状态与 Claude 接手说明

## 运行架构

- 运行入口：`docs/index.html`，单文件 React/Babel 应用。
- 本地服务：`server.py`，固定绑定 `127.0.0.1`，默认端口 8000。
- AI：浏览器把 provider 请求交给 `/api/llm`；`server.py` 再转发至已配置的 HTTPS endpoint。
- 无可用 AI/返回异常时，应用会降级到模板引擎，不能让加载中的 Album 永远卡住。
- `src/` 是较旧拆分源码；当前功能直接维护在 `docs/index.html`。不要运行 `build.py`，否则可能覆盖新版行为。

## 当前曲库与审核设计

| 部分 | 当前事实来源 | 同步位置 |
| --- | --- | --- |
| Album 列表 | 曲库中的 `type: "album"` 记录 | `awen-music-library/docs/library.json` |
| ⭐ 曲库 | 同一份曲库记录 | 同上 |
| Album 顶层状态 | `status` / `workflow.albumStatus` | 同上 |
| 每曲 GPT 审核/采纳/Suno 应用状态 | `albumSnapshot.data.tracks[*].promptReview` 与 `workflow.tracks[*]` | 同上 |
| 完整审核文件和批准版本 | Prompt 审核仓库 | `suno-prompt-chatgpt` |

`library.json` 是曲库展示的唯一事实来源；浏览器 localStorage 只是在没有 PAT、网络异常时的临时回退缓存。首次加载旧版本缓存时可进行一次性迁移，之后 GitHub 记录优先。

## 当前未提交工作树

基线提交：`3ca4e3f7ec2ffe51ea6854b3b648dd9f61e1ae1c`。

当前未提交文件：`docs/index.html`。

当前文件 SHA-256：

```text
81ea6b449d01b33dff05d742b72fa08f489d36c89b413ca0b272a75dc9f92907
```

该修改包含：

1. GitHub/云端曲库作为 Album 和 ⭐ 曲库的共同来源。
2. `library.json` v3 的完整 `albumSnapshot` 与旧记录迁移。
3. 专辑生成、审核结果、GPT 修订采纳、封面、固定/发布状态回写曲库。
4. Album 状态与逐曲审核状态的 `workflow` 记录。
5. GitHub 写入队列与一次 409 自动重试，避免批量审核相互覆盖。

完整差异在 `CURRENT_WORKTREE.patch`。它只包含代码，不包含任何密钥。

## 当前已知限制/待验证项

1. 本地测试已通过，但没有在本包生成时进行真实 GitHub 写入；需要用户提供已配置的 PAT 并授权一次状态切换验证。
2. GitHub PAT 是浏览器本地设置，不会随项目或压缩包移动。需要 Fine-grained PAT 对 `gavin881027/awen-music-library` 有 `Contents: Read and write`。
3. 封面上传的二进制文件与 `library.json` 写入是两个远端动作；必须单独验证二者都成功。
4. `README.md`/旧 `HANDOFF.md` 的早期架构描述有部分过时内容；本包和实际 `docs/index.html` 优先级更高。
5. 不要直接发布或部署。这是本地工具；Oracle/生产部署需要另行审批和完整安全评审。

## 推荐修改路径

1. 先复现问题并做最小改变。
2. 直接修改 `docs/index.html`，不用 `build.py`。
3. 执行 Python 编译检查、Node 测试、HTTP 200 和浏览器无控制台错误检查。
4. 涉及云端数据时，以 GitHub 最新 `library.json` 为基线；不要用本机旧缓存盲写覆盖。
5. 未经授权不提交、不推送、不部署。
