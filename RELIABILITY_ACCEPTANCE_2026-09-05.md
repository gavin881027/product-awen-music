# Awen 本地可靠性修复与验收

本记录接续 RELIABILITY_PAUSED_2026-09-05.md，取代其中“暂停中”的执行状态。代码已实施并完成下列隔离行为验收；正式浏览器历史数据与真实 GitHub 写入不在已验收范围内。所有改动仍未提交，未推送任何远端。

## 现场与权威边界

项目 `/Users/gavin/dev/SUNO/product-awen-music`，main，HEAD `3ca4e3f7ec2ffe51ea6854b3b648dd9f61e1ae1c`。保护了开始时已有的未提交改动。

| 对象 | 保存/读取位置 | 确认与冲突规则 |
|---|---|---|
| 当前 prompt、单曲/专辑工作区 | 当前 origin 的 localStorage `awen_matrix_state_v1` | 保存必须写入成功；工作区正文被其他标签页改动时拒绝覆盖并保存恢复分支。编号等元数据变更可合并。 |
| 已保存 Suno 配方 | 单曲 recipe / 专辑 track.sunoRecipe | 已保存字段优先；仅缺少 recipe 时使用默认值生成，刷新不重建。 |
| ⭐ 曲库 | `awen_local_library_v1`，可选 GitHub `gavin881027/awen-music-library:main/docs/library.json` | 本地保存先完成，base/pending/conflicts 持久化；远端 GET/PUT 明确确认相应版本，旧响应不确认新编辑。 |
| Album 人工状态 | 工作区/本地 Album 状态 | 保留既有规则：只有人工状态操作授权向远端更新该字段，不以远端整体覆盖。 |
| 审核历史 | `gavin881027/suno-prompt-chatgpt:main` 的版本文件与 manifest | id + sourceHash 绑定版本；文件已存在同文则复用，冲突不盲写；manifest 防旧轮次回退。 |
| 审核未完成操作 | `awen_review_operation_v1.*` | 远端动作前保存输入、版本、时间；重试先核对原版本、逐文件确认；无法安全继续时保留任务。 |
| 源码 Git | 本机 .git → personal/origin | 完全独立于业务 API；本次未 commit/push。 |
| 网页发布 | sync.sh → awenstudio.github.io | 同时发布 HTML、reliability.js、vendor；本次仅临时本地 bare 仓库验证。 |

没有服务器数据库，重启 Python 不迁移浏览器数据。`localhost`、`127.0.0.1`、不同端口以及不同浏览器 profile 的存储彼此独立。

## 已发现根因 → 修复 → 行为证据

1. **刷新后配方变了（已复现）**：attachSongSunoRecipe/attachAlbumSunoRecipes 原来重建已有配方，把 Instrumental 改回默认结构路线，丢失人工正文/参数。改为读取已有 recipe。相同回归测试针对开始前代码 **2/2 失败**，当前 **2/2 通过**。
2. **审核部分写入后无法重试（已复现）**：相同结果重新校验生成新的 reviewedAt，与同名已存在历史文件冲突。新增持久化操作记录冻结时间、输入和原版本；GET 同文确认后仅补缺失文件。实际 React + 模拟 GitHub 通过初稿、批准、自动/人工采纳、已应用标记的 manifest 失败/刷新恢复。
3. **编辑后沿用旧批准（代码与行为验证）**：手工修改未撤销 approved。现生成新 sourceHash、needs_revision，保留 supersedes，清除旧批准及应用引用；编辑失败返回 false。真实运行时验证刷新保存与 quota 失败原字节保留。
4. **双标签页误报冲突（已复现）**：新页初始化推进 seq，旧页把元数据变化当正文冲突。现只在正文变更时拒绝覆盖，元数据合并。真实两页快速编辑通过；关闭整个浏览器、重启服务、重开同一隔离 profile 后仍能读主版本和被拒绝编辑的恢复分支。
5. **切换端口像丢失数据（代码证据）**：旧双击脚本自动转到 8001 等地址。现固定 8000，已有服务检查目录与 serverRevision。原 PID 74348 经 cwd、无活动连接检查后重启为 PID 84793；check_server.py 和 start.sh 8000 均确认当前版本。
6. **修改再次消失（代码证据与隔离验证）**：旧 build.py 从过期 src 覆盖当前 docs。现只输出 legacy-build。临时项目验证运行版逐字节不变。
7. **外网故障导致页面无法启动（本轮遇到下载截断）**：核心 React/ReactDOM/Babel 从 CDN 加载。现保存原版本、原 SHA-384 校验一致的本地副本；无需升级。真实浏览器验收阻断外部网络仍可启动和读取。
8. **漏发新增依赖（已在本地发布链路验证）**：未暂存新文件不在 git diff 中。发布前暂存明确工件后比较，带上 vendor；本地 bare 仓库验证 HTML 不变也发布新 JS，重复运行无新提交。

上一轮大文件 Contents 空正文→SHA blob 读取、库旧响应覆盖、本地写入吞错、代理截断等修复保留；本轮再次通过相关回归，不把旧报告文字当成新验证。

## 修改文件

- docs/index.html：保存、审核恢复与版本校验、配方读取、业务同步状态、版本化 manifest 查询；保留原 UI 流程。
- docs/reliability.js：工作区/库持久化、恢复分支、审核日志、GitHub 传输。
- server.py / check_server.py / start.sh / Awen Music.command：运行身份、固定入口、复用正确进程。
- build.py / sync.sh：阻止旧构建覆盖及发布工件缺失。
- docs/vendor：原固定版 React/ReactDOM/Babel 和 PROVENANCE.json。
- tests 下新增/修正回归与浏览器故障测试；本记录、暂停交接、REMOTE_INTEGRITY_2026-09-05.json 为审计证据。

## 实际验收

- `node --test tests/*.test.mjs`：30/30 通过（其中原有两项为观察性测试，不能当成缺陷已修复）。
- `python3 tests/server-reliability-test.py`：健康身份字段与超大上游明确失败通过。
- `python3 tests/startup-build-sync-test.py`：旧构建防覆盖、临时服务同 origin 重启、身份检查、本地 bare 发布/重复发布通过。
- `tests/browser-reliability.mjs`：真实 React 渲染、模板专辑刷新、quota 可见失败、原库字节保留。
- `tests/browser-library-sync.mjs`：同步失败保留、成功响应丢失不重复 PUT、延迟响应不覆盖新编辑、双向冲突/刷新保留。
- `tests/browser-review-recovery.mjs`：初稿恢复、审核部分写入恢复、修改 hash/撤销批准、丢失响应、已应用事件、自动采纳、人工采纳复审、主工作区 quota 失败全部通过。
- `tests/browser-workspace-lifecycle.mjs`：真实两标签页快速编辑、拒绝旧写入并保留双方、完整关闭浏览器+重启 Python+同 profile 重开，通过。
- Python 编译、脚本语法、git diff --check 通过。

浏览器脚本使用本机 Chrome 的隔离 profile/context。运行：

```sh
cd /Users/gavin/dev/SUNO/product-awen-music
export AWEN_PLAYWRIGHT=/Users/gavin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node tests/browser-workspace-lifecycle.mjs
```

这些模拟 API / 本地 bare 测试不是实际 GitHub 推送成功，也没有任何 Suno API 请求。

## 正式数据与剩余边界

真实远端只读快照：22 项曲库、346 项 manifest；503 个引用文件无缺失引用、无重复 key、未发现 sourceHash 与 manifest 不一致。详见 REMOTE_INTEGRITY_2026-09-05.json；这是检查时快照，不代表以后一直一致。源码 personal/main 检查时与本机 HEAD 一致；origin 返回 Repository not found，具体权限/仓库归属仍未裁决。

尚未验证：正式浏览器的 PAT 和历史 localStorage、历史本地版本与远端逐项差异、真实 API 写权限/Actions、封面上传完整行为、所有可能的设置切换或同时打开大量标签页交错。没有找到可访问的正式 Awen 标签页，因此未猜测恢复丢失内容。没有执行历史数据修复；如导入实际恢复包，先提供双方差异再决定。

localStorage 仍受容量限制，恢复分支/完成日志会占空间；失败会报错并保留已有字节，不能保证磁盘/浏览器强杀前尚未收到的生成结果。多个 localStorage 键不是事务，极端跨进程同时写仍依靠保存的分支人工恢复。冲突/不同版本任务不会自动裁决；恢复包可导出，但尚无一键自动合并导入。无收费生成端到端验收。

## 使用与恢复

正确入口：http://127.0.0.1:8000/ 。执行 `bash start.sh 8000` 或双击项目内 Awen Music.command；已有当前服务会复用，错误版本会明确退出，不换端口。

查看页面工作区保存错误、曲库待同步/已确认和审核恢复任务数。库同步失败使用“重试曲库同步”，审核失败使用“重试未完成审核”；发生版本冲突先“导出本地备份 / 冲突明细”，不要反复刷新或重新生成。仅明确远端确认的版本显示已同步。

开始前完整代码：`/Users/gavin/dev/SUNO/awen-audit-backups/20260905-followup-b7b6fbtq/workspace/`；暂停版含新增文件：同目录 `paused-workspace/`。本轮最终相对暂停版变化另存 `resumed.patch`，最终现场存 `accepted-workspace/`。备份包含代码，不含正式浏览器数据备份。审核仓库只读快照为同目录 review-remote.git。

回滚先另存当前代码和页面导出的恢复包，停止已核实 PID，然后仅恢复对应备份中的被修改文件；新增文件先移到保留目录，不运行 git reset/clean，不覆盖 .git 或正式浏览器存储。恢复代码不会撤销 localStorage 中已经保存的数据。恢复后以 start.sh 8000 启动。禁止用远程 main 覆盖包含已有工作的本地现场。

当前不需要批准远端写入。若需真实同步验收，另行提供具体仓库、隔离分支、测试文件以及 Actions/部署影响，再请求批准。

## 正式浏览器与真实 GitHub 写入续验（2026-09-05）

- 已在正式 `127.0.0.1:8000` 浏览器来源复现并修复 `Storage quota exceeded` 的两个成因：历史正常保存累积的 writer 临时副本，以及大曲库冲突时把远端完整快照与双方全文再次塞进同一个 localStorage 记录。
- 现在常规 writer 副本会清理，备份轮转不足不会阻断主记录；超过 256 KiB 的远端基线不再复制进 localStorage。大冲突只保存冲突 ID、双方内容指纹和 `repo/path/file SHA`，本地正文仍在曲库记录内，远端正文保留在 GitHub 的不可变 blob/提交历史中。
- 正式页面重新加载后显示“本地已保留 · 22 项版本冲突待核对”，不再显示主曲库 key 的配额错误；14 张历史专辑仍在页面可读。没有点击“重试曲库同步”，没有写入任何业务 main 数据。
- 正式浏览器 PAT 真实写入已确认：
  - `gavin881027/awen-music-library:codex-reliability-audit-20260905/reliability-audit/browser-pat-write.json`，文件 SHA `85e2f29bbae13d66f03e457810d8a394666fe19b`。
  - `gavin881027/suno-prompt-chatgpt:codex-reliability-audit-20260905/reliability-audit/browser-pat-write.json`，文件 SHA `5725f064b1aff0c940e3409ebc76694198a58b6b`。
- 两次写入均由页面按正文和 SHA 回读确认；两个 main SHA 仍分别为 `1b0b4342003e9b7741432b48956fa8459d488c9d`、`954fdae7521a3bfd5dc8494ed56918e642555291`。两仓库各自 Actions workflow 数为 0，未触发已知工作流。
- 新增“大型差异只保留索引和远端 SHA”的回归；`tests/reliability.test.mjs` 22/22 通过。完整 Node 回归现为 36/36 通过，服务/启动/浏览器场景通过记录保持有效。


## 收藏时再次出现存储配额错误（2026-09-05）

### 现象与根因

正式浏览器在 Album 点击收藏后同时报出 `awen_matrix_state_v1` 与 `awen_local_library_v1` 的 `Storage quota exceeded`。此前修复已清理历史 writer 临时副本和大型远端冲突副本，但收藏仍会把整份工作区和整份曲库 JSON 写回同一浏览器来源；包含大量重复 prompt 正文的历史记录仍可能超过该来源的空间上限。

### 修复

- 对这两个主记录及各自滚动备份采用同步、无损、向后兼容的 UTF-16 LZ78 压缩：只有压缩后更短才替换存储值，既有未压缩值仍可读取。
- 恢复包导出时自动解码，导出的 JSON 保持可读；主记录写入仍先写临时值、再切换主值，不能因压缩失败误报成功。
- 同一远端版本反复对账时只保存本轮冲突索引，不再追加旧冲突正文或重复索引；远端正文仍由 GitHub blob/SHA 保留，本地正文仍由本地曲库记录保留。

### 验证

- 正式页面重新加载后可读取 14 张历史专辑，状态为“本地已保留 · 22 项版本冲突待核对”，未再显示两个主记录的配额错误。
- `node --test tests/*.test.mjs`：39/39 通过；新增压缩往返、压缩后刷新读取、重复对账不累积冲突三项回归。
- `python3 tests/server-reliability-test.py` 与 `python3 tests/startup-build-sync-test.py` 通过。
- 隔离浏览器执行真实 React 保存、刷新和超大重复 prompt 场景通过；所有 GitHub/API 流量被拦截，零远程写入。

正式 profile 未再次点击未收藏专辑的收藏按钮：该操作会启动已有 PAT 的业务 main 同步，而当前 22 项历史差异尚未裁决。以上正式重新加载验证与隔离浏览器行为测试证明本地保存路径已可写且可重读；待冲突裁决后再执行业务 main 同步验收。


## Provider 实际调用复验（2026-09-05）

用户截图中的“Provider 请求失败”来自浏览器 fetch 层，不能据此推断为 API Key、模型或 HTTP 上游错误。复验时本地 `127.0.0.1:8000/api/health` 正常，当前页面配置为 DeepSeek 官方 V4 Flash、Responses API 和官方 base URL。

设置页新增“测试 Provider 连接”：只发送固定的最小 JSON 指令，成功时要求返回 `{"ok":true}`；不会创建歌曲、专辑或 GitHub 写入。正式浏览器用当前已存凭据实际调用成功，页面显示“连接成功：DeepSeek 官方 · V4 Flash”。因此当前 API Key、代理、模型路由和最小 Responses 响应解析均已确认可用。截图中的一次失败尚无保留日志，不能把它裁定为持续性鉴权或路由问题。

隔离浏览器回归拦截所有外部 HTTPS，并模拟本地 `/api/llm` 最小响应；确认设置页恰好发送一次探针、成功状态可见，且未发生业务远程写入。
