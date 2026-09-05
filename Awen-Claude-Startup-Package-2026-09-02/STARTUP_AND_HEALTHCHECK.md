# 每次打开 Awen 的启动与健康检查

本清单的目标是：先确认正在运行的是正确项目、正确版本和正确数据源，再做任何生成、审核、同步或代码修改。

## 0. 安全边界（先执行）

- 把 `/Users/gavin/dev/SUNO/product-awen-music` 视为权威本机工作区。
- 不读取、打印、复制或提交 API Key、PAT、Cookie、localStorage 原文。
- 默认只读检查；任何 GitHub 写入、远端推送、删除、部署、配置变更或付费/额度消耗操作，都需要用户的当次授权。
- 不运行 `build.py`；不要用旧 `src/` 覆盖 `docs/index.html`。

## 1. 定位并保护当前工作树

在终端执行：

```bash
cd /Users/gavin/dev/SUNO/product-awen-music
pwd
git branch --show-current
git remote -v
git status --short
git diff --check
```

通过标准：

- `pwd` 必须是上述绝对路径。
- 当前分支通常为 `main`。
- 应看到个人远端 `gavin881027/product-awen-music`；上游 `awenstudio/product-awen-music` 只作参考。
- `git status` 如显示 `docs/index.html` 修改，不要丢弃它。这是当前版本的重要未推送改动。
- `git diff --check` 不能报告空白错误。

若 Claude 在一台新电脑上接手：先 clone 个人仓库，再将本包的 `CURRENT_WORKTREE.patch` 应用到 clone。应用前先检查补丁是否能干净匹配；若不能匹配，停止并比较差异，不能盲目覆盖。

## 2. 检查是否已有重复或失效服务器

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8000/
```

判断：

- 如果只有一个 Python 进程且 HTTP 200：复用它，不再启动第二个实例。
- 如果端口无监听或 HTTP 失败：进入第 3 步。
- 如果有多个可疑 Awen/Python 服务：先报告 PID、命令和端口；未经用户明确许可不要结束任何进程。

## 3. 正确启动本地页面

```bash
cd /Users/gavin/dev/SUNO/product-awen-music
python3 server.py --port 8000
```

打开：`http://127.0.0.1:8000/`

规则：

- 只允许 `127.0.0.1` / `localhost`，不要把 `server.py` 直接暴露到公网。
- 不要用 `file://.../docs/index.html` 打开；该页面无法正确使用本地 AI 代理。
- Codex/Claude 任务或终端关闭后，服务器可能停止；每次新会话都要做第 2 步检查。

## 4. 页面运行时检查（无副作用）

在浏览器刷新本地页面后，检查：

1. 页面没有“无法连接”“AI 生成失败”遗留弹窗或 JavaScript 错误。
2. 打开 Album：卡片应该默认折叠，只在用户点击后显示每首歌的 Prompt。
3. 打开 ⭐ 曲库后点击“刷新”：确认它加载的是配置的 GitHub 曲库，而不是另一个浏览器配置文件里的旧 localStorage。
4. AI 来源标签应显示实际本次生成所使用的 provider、`未调用 AI` 或 `来源未记录`，不能假装是当前选择的 provider。
5. 不要为了日常启动检查点击“生成 16 首专辑”或调用模型；这会消耗 API 配额。仅在用户授权测试 AI 时执行。

## 5. 云端曲库是 Album 的唯一事实来源

目标仓库：`gavin881027/awen-music-library`，文件：`docs/library.json`。

当前规则：

- `library.json` schema version 为 3。
- Album 栏从同一份曲库的 `type: "album"` 记录渲染；⭐ 曲库也读取同一集合。
- 每个 album 项保存 `albumSnapshot`（完整专辑卡片数据）、`status` 与 `workflow`。
- `workflow` 会保留顶层阶段状态（草稿 / 已采用 / 排队中 / 已发布）和每首歌曲的审核状态、审核轮次、是否采纳 GPT 修改、是否已应用 Suno。
- 旧 v1/v2 本地收藏仅迁移一次，避免已经从云端删除的专辑在旧电脑上重新出现。
- 无 GitHub PAT 时只能使用本机回退缓存，不能保证跨电脑一致；这是显式降级，不是云端同步成功。

每次打开后，用以下非破坏性标准检查一致性：

1. 先在 ⭐ 曲库执行刷新并等待完成。
2. Album 栏的专辑数量和 ID 应等于曲库中 `type: "album"` 的记录数量和 ID。
3. 如果两处不同，先停止任何写入，记录：浏览器、当前 `github_repo` 配置、是否有 PAT、`library.json` 的 SHA、页面错误信息。然后再诊断，不要用本机缓存覆盖 GitHub。

## 6. 需要用户授权后才能进行的云端端到端验证

以下检查会修改真实 GitHub 曲库，需在用户批准后执行：

1. 在一个测试 Album 上将状态切换一次（例如草稿 → 已采用）。
2. 等待“已同步到 GitHub 曲库”提示。
3. 读取 `gavin881027/awen-music-library/docs/library.json`，确认：
   - 对应 ID 的顶层 `status` 已改变；
   - `workflow.albumStatus` 与 UI 一致；
   - `workflow.statusUpdatedAt` 更新；
   - 审核后 `workflow.tracks` 中的状态/轮次/采纳标记与专辑卡片一致。
4. 刷新页面并在第二个浏览器/电脑读取，确认 Album 与 ⭐ 曲库仍一致。

批量审核情形：应用整张专辑的审核结果后，写入会顺序排队；GitHub 409 会重新读取最新 SHA 后自动重试一次。不要同时在两个终端大量修改同一张专辑；若仍出现冲突，应以 GitHub 最新文件为基线人工合并。

## 7. AI Provider 检查（只读优先）

- Provider 配置与 API Key 都存在浏览器 localStorage；不能从仓库或服务器文件假设它们存在。
- `server.py` 是本地同源代理：仅接受本机浏览器请求，转发 HTTPS provider 请求，不记录 Key/请求正文。
- 只检查设置界面是否显示预设与 endpoint 结构；不要索取或展示 Key。
- 若用户授权一次实际 AI 测试：测试单一低成本生成即可，确认 JSON 解析、provider 标签、模板回退和错误信息；不要自动生成 16 首专辑。

## 8. 最低验证命令

```bash
cd /Users/gavin/dev/SUNO/product-awen-music
python3 -m py_compile server.py
node --test 'tests/**/*.test.mjs'
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8000/
git diff --check
```

所有命令通过后，才可以把“本地可打开、代码静态检查通过”说成已验证。没有真实 PAT 写入测试时，必须明确说明 GitHub 同步只做了代码/读取验证。
