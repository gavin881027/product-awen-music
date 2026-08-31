# Awen Music — Matrix Generator

> **V2.3** — Suno Recipe Bridge + Provider & Library Workflows

[English](#english) | [中文](#中文)

**Live:** [hiawen.com/music](https://hiawen.com/music/) · **Deploy repo:** [awenstudio.github.io](https://github.com/awenstudio/awenstudio.github.io)

---

<a id="中文"></a>

## 中文

一个 **lo-fi 学习音乐的 Prompt 工厂**。在 11 维度矩阵上配好"声音配方"，自动生成 Suno 风格框、编曲结构、封面/视频 prompt、YouTube 元数据、文件命名——从灵感到发布，一站式完成。

### 核心功能

- **11 维度矩阵** — 声音 7 维（环境 · 自然 · 时间 · 情绪 · 乐器 · 风格 · BPM）+ 视觉 4 维（角色 · 光线 · 色板 · 叙事母题）
- **4 种模式** — Pick 手选 · Shuffle 随机 · Decompose 反推 · Album 专辑
- **Musical Coherence Engine** — 自动生成调性、精炼风格框、5 段编曲结构（metatag 格式）
- **Track Role Signatures** — 每首歌在专辑中有独立角色和记忆点
- **Universe Builder** — 保存视觉身份，跨专辑复用
- **Suno 配方桥接** — 按 Lyrics → Style → Exclude → 参数 → Title → Workspace 的页面顺序逐项复制
- **互斥 Lyrics 路线** — 结构 Prompt 实验路线与 Instrumental 稳定路线一键切换，不再混用
- **配方快照曲库** — 单曲/专辑保存完整 Suno 配方；旧收藏自动升级到 schema v2
- **发布素材折叠区** — 封面、视频、缩略图、YouTube 元数据和文件名集中管理
- **AI + 离线双引擎** — AI 不可用时自动切换模板引擎，所有功能可用
- **8 种语言** — 中 · 英 · 日 · 韩 · 法 · 西 · 德 · 葡
- **4 套主题** — Console（深色）· Lo-fi（暖棕）· Clean（浅色）· Studio（中性深）

### 本地运行

无需安装，直接启动本地服务（包含通用 AI Provider 代理）：

```bash
python3 server.py --port 8000
# 打开 http://localhost:8000
```

不要直接用 `file://` 打开 `docs/index.html`，否则浏览器无法使用本地 Provider 代理。当前版本即使被双击，也会自动跳回 `http://127.0.0.1:8000/`；请先确保 `server.py` 或桌面启动脚本正在运行。

设置中可选择 MiMo、DeepSeek 官方（V4 Flash）、OpenCode Go（GLM-5.3、MiMo-V2.5-Pro、DeepSeek V4 Pro、GPT-5.6 Luna）、SynapAI Grok（Grok 4.5、4.3、Build 0.1、4.20 Multi-Agent）、SynapAI OpenAI（GPT-5.5）或任意 OpenAI-compatible 中转站。DeepSeek 官方 V4 Flash 使用 Responses API：`https://api.deepseek.com/responses`、模型 `deepseek-v4-flash`、快速非思考模式；该官方 API 是无状态的。SynapAI Grok 预设采用 Responses API，地址为 `https://api.synapai.top/v1`，并使用 `store: false`；SynapAI OpenAI · GPT-5.5 按其配置使用 `https://api.synapai.top/responses`、`reasoning.effort: "xhigh"` 与 `store: false`。切换同一 SynapAI Grok 组内的模型会保留本机已填的 Key。OpenCode Go 的官方预设会自动校准地址/协议；DeepSeek V4 Pro 预设关闭思考模式并使用严格 JSON 输出，503 时自动重试一次；Luna 若返回上游 404，会自动切换到同一订阅下的 MiMo-V2.5-Pro。API Key 仅保存在浏览器本地；`server.py` 绑定 `127.0.0.1`，用于解决浏览器 CORS，不记录请求正文或 Key。

曲库采用本地优先：点击 ⭐ 会立即保存到当前浏览器，即使 GitHub PAT 无权限也不会丢失。跨设备同步是可选功能；在设置中填写目标 `owner/repo`（可以是自己的 fork）和 Fine-grained PAT，Token 必须选中同一仓库并授予 `Contents: Read and write`，组织仓库可能还需管理员批准。

### 部署 & 同步

**开发流程：**
1. 在本地改代码 → 修改 `docs/index.html`
2. 推送到 GitHub：`git push origin main`
3. 运行同步脚本自动上线：
   ```bash
   ./sync.sh
   ```
4. 自动推送到 [awenstudio.github.io](https://github.com/awenstudio/awenstudio.github.io)
5. GitHub Pages 自动更新 → https://hiawen.com/music/ 生效

**部署说明：**
- **开发仓库：** 这个仓库（awen-music）私密，只有你能看
- **部署仓库：** [awenstudio.github.io](https://github.com/awenstudio/awenstudio.github.io) 公开，通过 GitHub Pages 提供网站服务
- **同步方式：** `sync.sh` 脚本（比 GitHub Actions 更简单可靠）

### AI 后端

- **Cloudflare Worker：** `workers/generate.js`（万能 AI 代理，支持 OpenAI / Anthropic / DeepSeek / MiMo 等）
- **认证：** 用户通过弹窗输入访问密码，存在 `localStorage`
- **离线降级：** AI 不可用时自动使用内置模板引擎

### 项目结构

```
awen-music/
├── docs/index.html              ← 完整构建（V2.3，与线上同步）
├── src/                         ← 拆分源码（V2.0 基础版）
│   ├── data.js                  矩阵数据 + prompt 引擎
│   ├── i18n.js                  多语言字符串
│   ├── components.jsx           通用组件
│   ├── cards.jsx                单曲卡片
│   ├── album.jsx                专辑控制台
│   ├── guide.jsx                首次使用引导
│   ├── tweaks-panel.jsx         设置面板
│   └── app.jsx                  App 根组件
├── workers/generate.js          ← Cloudflare Worker
├── CHANGELOG.md                 版本变更记录
├── FIX_LOG.md                   Bug 修复日志 + 代码规范
└── SUNO_BEST_PRACTICES.md       Suno 使用指南
```

> `src/` 目前是 V2.0 版本。V2.1–V2.3 的新功能直接在 `docs/index.html` 单文件中开发。后续计划回迁到拆分源码。

### 版本历史

| 版本 | 主要变更 |
|---|---|
| **V2.3** | Suno 配方桥接 · Provider 代理 · 曲库 schema v2 · Study With Me 低干扰约束 |
| **V2.2** | Musical Coherence Engine · Track Role Signatures · 增强 SongCard/AlbumCard |
| **V2.1** | 健壮性修复：safeLS · AbortController 超时 · TokenModal · Toast 通知 |
| **V2.0** | Universe Engine：11 维矩阵 · 视觉身份 · 专辑 DNA · 元数据生成 · Smart Decompose |
| **V1.0** | 7 维矩阵 · 4 模式 · 8 预设 · 离线引擎 |

---

<a id="english"></a>

## English

A **lo-fi study music prompt factory**. Configure a "sound recipe" on an 11-dimension matrix, then auto-generate Suno style boxes, arrangement structures, cover/video prompts, YouTube metadata, and file naming — end-to-end from inspiration to publish.

### Key Features

- **11-dimension matrix** — 7 sonic (Environment · Nature · Time · Mood · Instrument · Style · BPM) + 4 visual (Character · Light · Palette · Motif)
- **4 modes** — Pick · Shuffle · Decompose · Album
- **Musical Coherence Engine** — auto-generate musical key, refined style boxes, 5-segment arrangement structures (metatag format)
- **Track Role Signatures** — each song gets a unique role and signature element within an album
- **Universe Builder** — save and reuse visual identities across albums
- **Suno recipe bridge** — copy fields in the same order as Suno: Lyrics → Style → Exclude → controls → Title → Workspace
- **Mutually exclusive Lyrics routes** — switch between experimental structure Prompt and stable Instrumental workflows
- **Recipe snapshots** — persist full per-song/per-track Suno recipes with schema-v2 migration for existing favorites
- **Collapsible publishing assets** — cover, video, thumbnail, YouTube metadata, and filenames stay available without competing with Suno inputs
- **AI + offline dual engine** — graceful fallback to template engine when AI is unavailable
- **8 languages** — ZH · EN · JA · KO · FR · ES · DE · PT
- **4 themes** — Console (dark) · Lo-fi (warm) · Clean (light) · Studio (neutral dark)

### Run Locally

No install needed. Start the local server (including the generic AI-provider proxy):

```bash
python3 server.py --port 8000
# open http://localhost:8000
```

Do not open `docs/index.html` directly as a `file://` page; that origin cannot use the local provider proxy. Current builds redirect a double-clicked file to `http://127.0.0.1:8000/`, so start `server.py` or the desktop launcher first.

Settings support MiMo, official DeepSeek (V4 Flash), OpenCode Go (GLM-5.3, MiMo-V2.5-Pro, DeepSeek V4 Pro, and GPT-5.6 Luna), SynapAI Grok (Grok 4.5, 4.3, Build 0.1, and 4.20 Multi-Agent), SynapAI OpenAI (GPT-5.5), and arbitrary OpenAI-compatible relays. The official DeepSeek V4 Flash preset uses the Responses API at `https://api.deepseek.com/responses`, model `deepseek-v4-flash`, and a fast non-thinking default; the official API is stateless. SynapAI Grok presets use the Responses API at `https://api.synapai.top/v1` with `store: false`; the SynapAI OpenAI GPT-5.5 preset follows the supplied configuration at `https://api.synapai.top/responses`, with `reasoning.effort: "xhigh"` and `store: false`. Changing models inside the SynapAI Grok group retains the locally stored key. Official Go presets keep their documented routes/protocols. The DeepSeek V4 Pro preset disables thinking, requests strict JSON, and retries one transient 503; a Luna upstream 404 automatically falls back to MiMo-V2.5-Pro under the same Go subscription. API keys remain in browser localStorage; `server.py` binds to `127.0.0.1`, handles browser CORS, and never logs request bodies or keys.

The library is local-first: ⭐ saves immediately in the current browser even when GitHub permissions are unavailable. Optional cross-device sync accepts a configurable `owner/repo` (including your own fork). A fine-grained PAT must select that repository and grant `Contents: Read and write`; organization repositories may also require administrator approval.

### Deploy & Sync

**Workflow:**
1. Edit code locally → modify `docs/index.html`
2. Push to GitHub: `git push origin main`
3. Run sync script to go live:
   ```bash
   ./sync.sh
   ```
4. Auto-syncs to [awenstudio.github.io](https://github.com/awenstudio/awenstudio.github.io)
5. GitHub Pages updates → https://hiawen.com/music/ live

**Deployment notes:**
- **Dev repo:** this repo (awen-music) is private (only you can see it)
- **Live repo:** [awenstudio.github.io](https://github.com/awenstudio/awenstudio.github.io) is public and serves via GitHub Pages
- **Sync method:** `sync.sh` script (simpler and more reliable than GitHub Actions)

### AI Backend

- **Cloudflare Worker:** `workers/generate.js` (universal AI proxy — OpenAI / Anthropic / DeepSeek / MiMo compatible)
- **Auth:** user enters access password via modal, stored in `localStorage`
- **Offline fallback:** built-in template engine activates automatically when AI is unavailable

### Project Structure

```
awen-music/
├── docs/index.html              ← self-contained build (V2.3, synced with live)
├── src/                         ← split source files (V2.0 base)
│   ├── data.js                  matrix data + prompt engine
│   ├── i18n.js                  i18n strings
│   ├── components.jsx           shared components
│   ├── cards.jsx                song cards
│   ├── album.jsx                album console
│   ├── guide.jsx                first-run guide
│   ├── tweaks-panel.jsx         settings panel
│   └── app.jsx                  App root component
├── workers/generate.js          ← Cloudflare Worker
├── CHANGELOG.md                 release notes
├── FIX_LOG.md                   bug history + code rules
└── SUNO_BEST_PRACTICES.md       Suno usage guide
```

> `src/` is at V2.0 level. V2.1–V2.3 features were developed directly in the single-file `docs/index.html`. Back-porting to split source files is a future task.

### Version History

| Version | Key Changes |
|---|---|
| **V2.3** | Suno Recipe Bridge · Provider proxy · library schema v2 · low-distraction Study With Me constraints |
| **V2.2** | Musical Coherence Engine · Track Role Signatures · Enhanced SongCard/AlbumCard |
| **V2.1** | Robustness: safeLS · AbortController timeout · TokenModal · Toast notifications |
| **V2.0** | Universe Engine: 11-dim matrix · Visual identity · Album DNA · Metadata gen · Smart Decompose |
| **V1.0** | 7-dim matrix · 4 modes · 8 presets · Offline engine |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). For anything larger than a small fix, open an issue first.

## License

[MIT](LICENSE) © Awen Studio
