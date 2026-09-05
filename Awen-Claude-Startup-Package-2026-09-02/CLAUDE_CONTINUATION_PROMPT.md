# 可直接粘贴给 Claude 的接入提示词

```text
你正在接手 Awen Music 项目。请先以“只读检查 + 最小改动”的方式工作，不要立即重构、运行 build.py、部署、推送 GitHub、删除数据、索取/打印任何 API Key 或 PAT，也不要自动调用会消耗 AI/Suno 额度的功能。

权威工作区：/Users/gavin/dev/SUNO/product-awen-music
本地入口：http://127.0.0.1:8000/
代码个人仓库：https://github.com/gavin881027/product-awen-music
云端曲库：https://github.com/gavin881027/awen-music-library （docs/library.json）
审核仓库：https://github.com/gavin881027/suno-prompt-chatgpt

我会提供 Awen-Claude-Startup-Package-2026-09-02.zip。请先完整阅读其中的：
1. STARTUP_AND_HEALTHCHECK.md
2. CURRENT_STATE.md
3. CURRENT_WORKTREE.patch

关键项目规则：
- docs/index.html 是当前运行版本，src/ 较旧；绝不能运行 python3 build.py 覆盖它。
- GitHub/云端曲库是 Album 栏和 ⭐ 曲库的共同事实来源。没有 PAT 时，只能使用明确标记的本机回退缓存。
- 专辑顶层状态（草稿/已采用/排队中/已发布）和每首歌审核状态都必须随 albumSnapshot/workflow 同步到 library.json。
- 批量审核会产生多次状态更新；写入必须顺序合并并处理 GitHub 409，不能让后一次覆盖前一次。
- 当前工作树含未推送的 docs/index.html 变更。若你在新 clone 上工作，先安全检查并应用 CURRENT_WORKTREE.patch；冲突时停止并汇报，不要强制覆盖。

第一轮只做下面的检查并向我报告结果：
1. 确认 cwd、分支、remote、git status、git diff --check。
2. 检查是否只有一个 127.0.0.1:8000 服务；若没有才启动 python3 server.py --port 8000。
3. 运行 python3 -m py_compile server.py、node --test 'tests/**/*.test.mjs'、curl HTTP 200。
4. 刷新本地页面并确认无 JavaScript 控制台错误。
5. 说明 Album / ⭐ 曲库 / GitHub library.json 的当前数据流，但不要执行任何 GitHub 写入。

完成第一轮后，停下来报告：通过项、失败项、当前未验证项、以及任何需要我明确授权的下一步。只有在我明确同意后，才进行真实 GitHub 写入、AI 生成、修复或提交。
```
