# Awen Music · Claude 接入与每次启动检查包

生成日期：2026-09-02（Asia/Shanghai）

这个包用于让 Claude 在不丢失当前 Awen 项目上下文的前提下，安全地接手“打开、检查、修复或继续开发”工作。

## 先读什么

1. `STARTUP_AND_HEALTHCHECK.md`：每次打开项目必须执行的检查。
2. `CURRENT_STATE.md`：当前架构、云端曲库规则、仓库及未完成验证。
3. `CLAUDE_CONTINUATION_PROMPT.md`：直接粘贴给 Claude 的接入提示词。
4. `CURRENT_WORKTREE.patch`：当前未推送的代码变更；它是本包与远端 `main` 的差异。

## 当前权威位置

| 用途 | 位置 |
| --- | --- |
| 本机权威工作区 | `/Users/gavin/dev/SUNO/product-awen-music` |
| 本地页面 | `http://127.0.0.1:8000/` |
| 代码个人远端 | `https://github.com/gavin881027/product-awen-music` |
| 收藏 / 云端曲库 | `https://github.com/gavin881027/awen-music-library` |
| GPT 审核记录仓库 | `https://github.com/gavin881027/suno-prompt-chatgpt` |

## 重要边界

- 当前工作树中的 `docs/index.html` 有未推送改动；不要把远端 clone 当作完整最新状态。先保留或应用 `CURRENT_WORKTREE.patch`。
- 不要运行 `python3 build.py`。当前运行版本是 `docs/index.html`，它比 `src/` 更新。
- 不要把 API Key、GitHub PAT、浏览器 localStorage、Cookie 或终端敏感输出写入包、日志或 Git。
- 没有用户明确授权时，不要 `git push`、运行 `sync.sh`、部署、删除曲库记录、覆盖远端 `library.json`、或生成会消耗 AI / Suno 额度的请求。

## 已完成的本地验证

- `python3 -m py_compile server.py` 通过。
- `node --test 'tests/**/*.test.mjs'`：12/12 通过。
- `http://127.0.0.1:8000/`：HTTP 200。
- 本地页面加载无控制台错误。

这些是本机静态与无凭据验证；尚未在本包生成时执行真实 GitHub 写入测试。
