
## 2026-09-05 第二轮暂停交接（用户要求暂停；尚未最终验收）

**后续约定：在本轮实际工作区和已保存成果基础上，继续原定“本地运行可靠性审计、根因修复与行为验收”，不要重头开始或把当前状态当成已验收发布版。** 用户先要求保存进度并继续，随后明确要求暂停，将进度和后续计划保存到 Obsidian。已停止正在运行的隔离审核测试，不再继续代码修改或新验收。

### 实际现场与备份
- 真实项目：`/Users/gavin/dev/SUNO/product-awen-music`，main，HEAD 仍为 `3ca4e3f7ec2ffe51ea6854b3b648dd9f61e1ae1c`。本轮未提交、未推送，保护了开始时所有未提交工作。
- 开始前完整备份：`/Users/gavin/dev/SUNO/awen-audit-backups/20260905-followup-b7b6fbtq/workspace/`；开始前差异 `tracked.patch`、状态 `status.txt`；暂停版完整代码另存 `paused-workspace/`，最新差异 `paused.patch`，新增文件也在暂停版副本中。
- 上一轮备份 `20260905-pEzrJ1` 仅有 index.before.html、server.before.py、start.before.sh，不能恢复本轮全部变更。
- 本地进度文件：`RELIABILITY_PROGRESS_2026-09-05.md`。旧 `RELIABILITY_AUDIT_2026-09-05.md` 是上一轮报告，不代表第二轮当前完成情况；需要后续整理最终记录。
- 暂停时 8000 仍由 PID 74348 的旧 Python 服务监听，cwd 已核实为真实项目；**尚未重启为本轮增加身份字段后的 server.py**。静态页面从磁盘读取，已是当前修改版，Python 内存代码仍旧。
- 没有正式数据迁移、真实 GitHub 写入、强推、reset/clean、收费生成或 Suno API 调用。正式浏览器 localStorage 尚未导出/改动；可访问 Chrome profile 当时未打开 Awen 标签页，不能宣称本地历史数据已全部核对。

### 三条链路和远端证据
1. 源码 Git：personal/main 的实时远端 SHA 与本机 HEAD 一致；origin（awenstudio）只读访问返回 Repository not found，可能是权限或仓库状态，未裁决。
2. 曲库 API：gavin881027/awen-music-library，main，docs/library.json。
3. 审核 API：gavin881027/suno-prompt-chatgpt，main，版本化初稿/结果/批准稿及 manifest。
- gh 当前凭据可读取两个私有业务仓库且返回 push 权限；这不等于浏览器 PAT 已验证，也不是写入验收。
- 实时曲库 22 项：14 album、8 song；审核 manifest 346 项（264 in_review、44 approved、28 needs_revision、2 reject、8 applied_to_suno），无重复曲库 ID/manifest key、无缺失引用。
- 审核仓库只读 bare 快照保存在备份目录 `review-remote.git`。对 503 个被引用文件逐一核对，未发现正文 sourceHash 与 manifest 不一致。证据与快照 commit 在项目 `REMOTE_INTEGRITY_2026-09-05.json`。未自动处理历史差异。

### 第二轮新增根因和已落盘修改
- **已复现：刷新重建已有 Suno 配方。** attachSongSunoRecipe / attachAlbumSunoRecipes 原来总按当前默认设置重新生成，导致 Instrumental 变为 structure-prompt，人工正文和参数被重建。已改为优先规范读取已保存 recipe，只有缺失时才生成。新 tests/recipe-persistence.test.mjs 对开始前副本 2/2 失败，当前 2/2 通过。
- **已复现：审核失败重试改变 reviewedAt。** 相同输入重新校验会生成新时间，导致同一历史文件正文冲突。新增持久化操作日志，冻结原输入、原 subject、时间及目标仓库；恢复通过先 GET 比对，避免重复 PUT。
- **已修复并有行为证据：手工编辑仍保留旧批准。** 编辑现在生成新 sourceHash，置 needs_revision、清空 approved/application 引用，保留 supersedes 历史。
- **代码证据：启动器自动换端口。** 双击脚本 8000 占用时原来选 8001/8002/8080，造成不同 origin 看不到原存储；现固定 8000，已有服务须经 check_server.py 身份核对。health 新增 projectRoot/PID/serverRevision；检查直连回环地址，避免本机代理干扰。
- **构建/发布复发来源：** build.py 原来把旧 src/V2 内容覆盖当前 docs；现在只输出 legacy-build。sync.sh 在本地 bare 验证中修复了 HTML 不变时漏发 untracked 新 JS，并一起携带 vendor 资源。
- 工作区同步保存及失败反馈、跨标签页版本保护/恢复分支；审核更新先保存主工作区，再做可选曲库同步。版本不同的工作区/曲库快照会提示保留双方。
- 审核初稿、导入结果、自动/人工采纳、标记已应用动作加入恢复日志；manifest 拒绝退回更旧审核轮次；曲库/审核请求固定读取和写入 main，并为主要异步操作捕获目标。仍需复核所有异步入口的目标切换边界。
- manifest 恢复查询由只按 id 改为 id + sourceHash，避免同 ID 多历史版本互相遮蔽。
- 运行依赖原来需外网 React/ReactDOM/Babel；本轮实际遇到上游下载截断。docs/vendor 保存了**原固定版本、原 SHA-384 一致**的副本，含 PROVENANCE.json，未升级依赖。测试可阻断全部外部网络。
- 封面上传回调改读最新 album，避免旧快照覆盖新编辑；分别提示封面文件与曲库记录的确认状态。此入口尚未独立行为验收。

### 验收事实（不要扩大结论）
已通过的运行记录：
- 开始时原 24 项 Node 测试；新增后 reliability.test.mjs 子集 15/15；recipe-persistence 2/2。
- tests/browser-reliability.mjs：本机 Chrome 实际 React，模板专辑刷新、quota 提示、库原字节保留；零真实远端写入。修正了旧测试脚本的引导遮挡和 fallbackAlbum 参数错误。
- tests/browser-library-sync.mjs：模拟 API 下断网保留、远端接受但响应丢失不重复 PUT、v2 响应不覆盖/确认 v3、本地远端冲突停止 PUT 且刷新保留。
- tests/browser-review-recovery.mjs 的此前完整版本通过：初稿 manifest 失败恢复；审核三文件部分失败恢复；手改 hash/批准失效；丢失响应无重复历史；手工标记已应用 Suno 在失败刷新后恢复；主工作区 quota 时编辑返回 false、原字节不变。测试从未调用 Suno。
- tests/startup-build-sync-test.py：临时项目旧构建不动运行版；同 origin 服务重启和身份/页面字节验证；本地 bare 发布带上缺失 JS，重复发布不新增提交。
- server-reliability-test.py 健康字段和超限上游响应明确失败通过。

**暂停时未通过/未完成：**
- 新增 tests/browser-workspace-lifecycle.mjs（真实双标签页、浏览器完整关闭、服务重启、profile 再打开）在第 26 行第一个编辑断言失败：actual false，expected true。需要先查为什么第二页初始化后第一页面编辑被拦截。整条生命周期不能标为通过。
- 最新扩展 browser-review-recovery.mjs 加入“自动采纳 needs_revision”和“人工采纳并复审”两种部分失败恢复场景；运行到初稿恢复通过时用户要求暂停，已终止。新增场景尚无最终结果。
- 最近的 recipe 读取修复、版本查询、封面回调、离线依赖和更多边界修改之后，尚未做一次完整最终回归。
- localStorage 仍有容量限制。恢复分支和操作日志也占容量，应测大库以及多标签页接近限额时行为；不能把单 key 原子写视作跨标签页事务。
- 原报告遗留的正式本地数据 vs 远端差异、浏览器 PAT、真实 GitHub 写入验收仍未完成。绝不自动重建未知丢失数据。

### 下次从这里继续（原计划不变）
1. 先读取本条交接和项目进度；核实 git status、文件差异、8000 实际 PID/cwd，保护暂停后用户的新工作。不要还原到远程 main 或覆盖 paused-workspace。
2. 优先复现/修复 workspace-lifecycle 第一个编辑失败，核查页面初始化是否无业务变更也写存储、跨标签页基线是否误判；验收快速编辑/两标签页保留双方及真正浏览器+服务重启。
3. 完成最新审核测试的自动采纳和人工采纳恢复，补足同版本并发、manifest 防回退、编辑途中旧任务返回、跨仓库设置变更等必要边界。检查旧审核历史不可覆盖和日志容量。
4. 检查所有未等待的业务保存及成功提示，确认当前本地成果在曲库失败后刷新仍可读；如需历史数据修复，先导出差异/预览，归属不清则保留双方。
5. 运行当前完整 Node、Python、浏览器故障验收、语法和 diff 检查；补齐原始失败/修复通过证据。不要仅用 lint/build 验收。
6. 确认没有生成请求后，安全重启已核实的 8000 服务到当前代码，验证新 health 身份与实际页面。固定 127.0.0.1:8000；不要自动换端口，localhost 也是另一个浏览器存储 origin。
7. 更新最终修复报告、状态解释、备份恢复/按文件回滚说明和待用户动作。真实 GitHub 仍只读；若必须写入，先列明仓库、测试分支、内容及 Actions/部署影响，再询问，不能直接推 main。

浏览器测试运行入口：AWEN_PLAYWRIGHT 指向
`/Users/gavin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`；
脚本使用已安装 Google Chrome（channel: chrome），隔离 context/profile 和模拟 API。

