# Awen 本地运行可靠性审计与修复（2026-09-05）

## 边界和现场

- 排查对象：`/Users/gavin/dev/SUNO/product-awen-music`，分支 `main`，开始时 HEAD 为 `3ca4e3f7ec2ffe51ea6854b3b648dd9f61e1ae1c`。
- `personal/main` 与 HEAD 当时没有领先或落后；没有执行 `reset`、`clean`、强制推送、真实 GitHub 写入或任何 Suno API 调用。
- 代码现场备份位于 `/Users/gavin/dev/SUNO/awen-audit-backups/20260905-pEzrJ1`，包含开始审计时的 `docs/index.html`、`server.py`、`start.sh`。
- 本轮没有读取、导出或改写用户浏览器 profile、Cookie、PAT、API Key 或正式 localStorage 数据。因而本报告不能替代用户数据的历史差异裁决。

## 实际架构和权威边界

| 数据/动作 | 实际位置或机制 | 结论 |
| --- | --- | --- |
| 工作台状态 | 浏览器 `awen_matrix_state_v1` / `.backup` | 本机持久化；不是服务器数据库。 |
| ⭐ 曲库 | 浏览器 `awen_local_library_v1`，可选 GitHub Contents API 的 `docs/library.json` | 本机先保存；远端只在确认写入后才算同步。 |
| 审核初稿、结果、批准文件 | `gavin881027/suno-prompt-chatgpt` 的 Contents API 和 `manifest.json` | 与 ⭐ 曲库同步是两条独立链路。 |
| 应用源码 Git | 当前仓库的 Git remotes | 与上述业务数据 GitHub API 写入不同。 |
| 本地服务 | `server.py` 静态站点 + `/api/llm` 本地代理 | 没有数据库或后台任务队列。 |
| 发布脚本 | `sync.sh` 复制到 `awenstudio/awenstudio.github.io` | 代码发布与业务数据同步不同。 |

Album 状态遵循既有要求：本地 Album 的人工状态控制是唯一可更改入口。后台刷新、封面、审核、收藏和一般同步不能把远端状态覆盖到本地；只有人工状态操作把该字段标记为允许向云端写入。

## 已复现根因、修复和证据

| 现象 | 根因证据 | 修复 | 验证 |
| --- | --- | --- | --- |
| `Unexpected end of JSON input` / 曲库读取失败 | 正式 `docs/library.json` 为 1,052,130 字节；GitHub Contents 元数据实际返回 `encoding: none`、空 `content`。旧代码对空字符串直接 `JSON.parse`。 | `docs/reliability.js` 在 Contents 无正文时按返回的 SHA 读取 Git Blob，并用 UTF-8 严格解码。 | 真实远端只读解析成功：22 项（14 albums、8 songs），无缺失/重复 ID；单元测试覆盖大文件 Unicode 解码。 |
| 刷新/慢请求后较新编辑被旧同步结果覆盖 | 旧逻辑在 `await` 前捕获曲库数组，成功后把旧数组重新写回 React/localStorage。 | 新 store 每次确认前重读磁盘；`acknowledge` 只确认相同版本，不回写旧请求快照。 | 回归测试：旧 PUT 回来后新标题仍保留且仍是待同步。 |
| 两标签页或本地/远端同时编辑静默覆盖 | 旧 merge 是“谁最后写谁赢”，没有共同基线或冲突记录。 | 持久化 `base`、`pending`、冲突双方和人工状态写入许可；同记录双改停止远端写入并允许导出恢复包。 | 回归测试覆盖不同记录合并、同记录冲突、删除冲突、重启后冲突保留。 |
| 本地存储失败仍看起来像成功 | `localStorage` 异常被吞掉，状态按钮先乐观更新。 | 写入失败显示可见错误；Album 状态仅在本地曲库写入成功后更新 UI；每次主记录写前保留 `.backup`。 | 回归测试模拟 quota 失败，原字节和备份均保留。 |
| GitHub 请求中断后重复 PUT 或错误显示已同步 | 旧网络重试可能在服务端已接受、客户端响应丢失时再次写入。 | PUT 不盲重试；下一轮先 GET/比对，内容相同则确认，不同才按 SHA 写入。请求和响应体均有超时/完整 JSON 检查。 | 回归测试覆盖“远端成功但响应丢失”，没有第二次 PUT。 |
| 生成端显示 `no JSON`，而上游响应可能被截断 | `server.py` 仅读前 2 MiB 后转发，可能把成功响应截成不完整 JSON。 | 上限改为 8 MiB，并读取多一个字节；超过上限返回明确 502，绝不转发半截响应。 | 隔离本地上游测试确认返回明确错误而不是损坏 JSON。 |
| 代码已改但本地页面仍是旧行为 | 8000 上实际运行的是旧 Python 进程；旧进程对新版 `/api/health` 返回空响应。 | 重启到当前工作树，并增加无敏感信息的 `/api/health`。 | `http://127.0.0.1:8000/api/health` 返回 `ok: true`。 |
| 发布后依赖文件缺失 | `sync.sh` 原来只复制 `docs/index.html`，没有复制新拆出的 `docs/reliability.js`。 | 发布脚本现在把两个运行时文件作为同一套工件复制和暂存。 | `bash -n sync.sh` 通过；没有执行同步或远端写入。 |

## 远端只读检查

- `gavin881027/awen-music-library`：私有、默认分支 `main`；上面的 22 条库记录可完整读取。
- `gavin881027/suno-prompt-chatgpt`：私有、默认分支 `main`；`manifest.json` 有 346 条版本记录：264 `in_review`、44 `approved`、28 `needs_revision`、2 `reject`、8 `applied_to_suno`。
- 审核 manifest 中同一曲目 ID 最多有 3 个版本。这与按 sourceHash 留存多轮初稿的设计相符，不能仅据此自动判定或合并历史版本。

## 验收结果

已通过：

- `node --test 'tests/**/*.test.mjs'`：24/24 通过，涵盖刷新/重启、本地失败、失败重试、丢失响应、多标签页、冲突、大文件、超时和损坏本地数据。
- `python3 tests/server-reliability-test.py`：通过健康检查和超大上游响应不截断测试。
- `python3 -m py_compile server.py tests/server-reliability-test.py`、`bash -n start.sh sync.sh`、`git diff --check`：通过。
- 本地更新服务的健康检查和静态 `reliability.js` 获取：通过。

受限项：

- 隔离的真实 Chromium UI 验收脚本已准备在 `tests/browser-reliability.mjs`，但本机缺少该 Playwright 版本对应的 Chromium 可执行文件。没有自动下载浏览器，也没有触碰用户浏览器 profile。因此 JSX/React 的完整点击链路尚未由自动浏览器完成。
- 未读取正式浏览器 localStorage，所以没有对“当前本机某条数据”和远端的历史冲突自动裁决；冲突会保留双方并可从页面导出恢复包。
- 审核仓库的一次操作仍可能涉及审核结果、批准稿、manifest 三个远端文件。代码会保留已写历史并可重试，但尚未引入跨文件的持久化操作日志；服务中断在中间时应使用同一审核 JSON 重试，并先核对 manifest。
- 现有 localStorage 容量仍受浏览器限制。大型库会触发可见失败和备份，而不是静默丢失；长期需要更大离线库时应评估 IndexedDB 迁移并先导出恢复包。

## 启动、检查和恢复

启动当前工作树：

```bash
cd /Users/gavin/dev/SUNO/product-awen-music
bash start.sh 8000
```

检查真正响应的本地服务：

```bash
curl http://127.0.0.1:8000/api/health
```

页面内应看到“本地已保存 · GitHub 待同步”或“当前曲库版本已获 GitHub 确认”。同步失败时不要刷新或重新生成；先点击“导出本地备份 / 冲突明细”，然后使用“重试曲库同步”。

如需审阅前恢复本次核心代码改动，可先把当前变更另存，再从上述审计备份恢复 `docs/index.html`、`server.py`、`start.sh`。`sync.sh` 与新增 `docs/reliability.js`、测试文件属于本次新增内容，应在代码审阅后通过 Git 差异逐项撤销，避免误删用户已有的未提交工作。
