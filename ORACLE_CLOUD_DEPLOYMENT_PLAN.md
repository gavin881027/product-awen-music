# Awen Music：Oracle Cloud Always Free 部署计划（待审阅）

> 状态：规划稿，尚未部署。  
> 目的：交由 ChatGPT 审阅并提出修订意见；审阅通过后再实施。  
> 原则：不使用 Suno 非官方 API；不自动在 Suno 创建歌曲或消耗 Suno 额度。

## 1. 目标

将 Awen Music 从本机 `http://127.0.0.1:8000/` 部署为一个仅供项目所有者使用的 HTTPS 私人后台。

上线后的核心能力：

- 生成 Study With Me / Suno 音乐配方与 16 首专辑方案；
- 调用已授权的文本 AI Provider（优先官方 DeepSeek V4 Flash）；
- 管理曲库、专辑、Prompt ID 和 GPT 审核状态；
- 向 GitHub 审核仓库写入初稿、审核结果、批准版本和版本历史；
- 在电脑、平板和手机上安全访问同一套后台。

本计划默认它是**单用户私人生产工具**，不是公开注册的 SaaS。

## 2. 项目与仓库

| 用途 | 地址 | 角色 |
| --- | --- | --- |
| Awen 应用（个人 fork） | https://github.com/gavin881027/product-awen-music | 生产部署源代码 |
| Awen 上游仓库 | https://github.com/awenstudio/product-awen-music | 比对与同步参考 |
| Prompt 审核库 | https://github.com/gavin881027/suno-prompt-chatgpt | 审核初稿、JSON 审核结果、批准 Prompt 与 manifest |

### 当前代码状态

- 本地目录：`/Users/gavin/dev/SUNO/product-awen-music`
- 当前已提交基线：`e23dc4377ef0`（2026-08-26）
- 当前 GitHub `main` 与该基线一致。
- 本机存在尚未提交的改动，主要在 `docs/index.html` 与 `README.md`，包括：专辑整批审核、第二轮复审、审核后 Prompt 展示、以及官方 DeepSeek V4 Flash Provider 支持。

**部署前必须先审阅、测试、提交并推送本机改动。**不得把当前远程 `main` 当作完整最新版本。

## 3. 当前架构与问题

```text
浏览器中的 Awen 单页应用（docs/index.html）
  ├─ localStorage：歌曲、专辑、Provider 配置、GitHub PAT 等
  ├─ GitHub Contents API：曲库与 Prompt 审核文件
  └─ POST /api/llm
       └─ Python server.py
            └─ DeepSeek / OpenCode / SynapAI 等文本 Provider
```

当前 `server.py` 是为本机开发设计的：

- 仅绑定 `127.0.0.1`；
- 仅允许 `localhost / 127.0.0.1` Origin；
- 前端向它提交 `endpoint`、`apiKey`、`payload`；
- Provider Key 与 GitHub PAT 目前可保存在浏览器 `localStorage`。

该设计可用于本机，但**不能原样公开到互联网**。若直接暴露，匿名访问者可能滥用代理，且浏览器端密钥存在不必要的风险。

## 4. Oracle Always Free 适配性

Oracle Always Free 的 Ampere A1 配额目前可提供合计 2 OCPU、12GB 内存、200GB 块存储及每月 10TB 出站流量。Awen 不运行本地模型，主要负载是静态页面、轻量 API 代理和 GitHub/API 请求，因此资源足够。

注意事项：

- Always Free Compute 应部署在账号的 Home Region；
- A1 可用容量可能暂时不足；
- 长期闲置的免费账户可能被 Oracle 视为废弃而暂停；
- 必须确保免费资源总和不超出 2 OCPU / 12GB，以免试用期结束后资源被回收。

参考：

- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- https://www.oracle.com/cloud/free/

## 5. 推荐生产架构

```text
访问者（仅项目所有者）
  ↓
Cloudflare Access（邮箱身份验证，可选但强烈推荐）
  ↓ HTTPS
Caddy（TLS 证书、反向代理、基础安全响应头）
  ↓ 仅监听 127.0.0.1
Awen Web/API 服务（Docker Compose 或 systemd）
  ├─ 官方 DeepSeek API / 经批准的备用 Provider
  ├─ GitHub Contents API
  └─ 可选：本地受限日志与健康检查
```

### 推荐选择：Cloudflare Access + Caddy

理由：项目是单用户私人后台，不需要自行维护注册、重置密码、会话管理和多用户权限。Cloudflare Access 负责外层身份验证；Caddy 负责 HTTPS 与反向代理；Awen 后端只服务于已通过外层访问控制的请求。

备选方案是应用内登录，但需要额外实现密码哈希、HttpOnly Cookie、CSRF、会话轮换、登录限流和找回流程，初期成本更高。

## 6. 必须实施的安全改造

### 6.1 Provider API 改造

将现有“浏览器传入任意 endpoint + apiKey”的代理改为服务器端受控 Provider：

1. 前端仅传递 `providerId` 和生成请求内容；
2. 服务端使用固定 Provider 映射：Provider URL、模型、超时和对应环境变量 Key；
3. 不接受浏览器传入任意上游 URL 或 API Key；
4. Provider 域名采用 HTTPS 白名单；
5. 限制请求体大小、单次时长、并发数与每用户/每 IP 频率；
6. 错误响应不得泄露 Key、上游原始 HTML 或内部堆栈；
7. 日志只保留状态、耗时、Provider ID 和匿名请求 ID，不记录 Prompt 正文或凭据。

优先服务端配置：

- `deepseek-official-v4-flash` → `https://api.deepseek.com/responses`
- 模型：`deepseek-v4-flash`
- 其他 Provider 只有在实际需要时才启用。

### 6.2 GitHub 同步改造

1. GitHub PAT 移至服务端环境变量；
2. 前端只调用受保护的曲库 / 审核 API，不再持有 PAT；
3. 审核 Token 与曲库 Token 尽量分开，并使用 Fine-grained PAT；
4. Token 仅授予对应仓库的 `Contents: Read and write` 权限；
5. 保留现有 GitHub 409 合并重试逻辑；
6. Prompt 审核仓库继续作为审核历史的权威副本。

### 6.3 Web 与服务器安全

- HTTPS 强制启用，HTTP 自动跳转 HTTPS；
- 防火墙仅开放 TCP `22`（SSH）与 `443`（HTTPS）；不开放 `8000`；
- Awen 进程只监听 loopback，由 Caddy 代理；
- SSH 仅密钥登录，禁用 root 直接登录与密码登录；
- CORS 仅允许最终生产域名；
- 增加安全响应头、请求大小限制与基础速率限制；
- 不把 `.env`、密钥、备份凭据或 `.pem` 文件提交到 Git；
- Docker / 系统软件应及时更新，并运行健康检查。

## 7. 部署前准备

### 7.1 用户需要准备

- [ ] Oracle Cloud 账号、Home Region 和 Always Free A1 实例；
- [ ] 稳定公网 IP；
- [ ] 一个子域名，例如 `awen.example.com`；
- [ ] DNS 管理权限；推荐使用 Cloudflare；
- [ ] Cloudflare Access 中允许访问的邮箱；
- [ ] 官方 DeepSeek API Key；
- [ ] 审核仓库与曲库所需的最小权限 GitHub PAT；
- [ ] SSH 公钥；私钥不得交给代码仓库或 AI；
- [ ] 是否迁移现有浏览器 localStorage 中未同步的歌曲、专辑和设置。

### 7.2 服务器上需创建但不提交的环境变量

以下为变量名称示例，真实值不写入任何 Markdown、Git 或聊天记录：

```dotenv
AWEN_ALLOWED_ORIGINS=https://awen.example.com
DEEPSEEK_API_KEY=...
GITHUB_REVIEW_TOKEN=...
GITHUB_LIBRARY_TOKEN=...
AWEN_LOG_LEVEL=info
```

环境文件权限应限制为服务账户可读，例如 `0600`。

### 7.3 数据迁移原则

- GitHub 审核仓库中的 `prompts/inbox/`、`reviews/`、`prompts/approved/`、`manifest.json` 是可跨设备保留的审核历史；
- 当前浏览器 localStorage 内的未收藏/未同步内容不会自动出现在新域名；
- 部署前应选择：
  1. 实现导出 / 导入 JSON；或
  2. 将需要保留的内容先同步到 GitHub；或
  3. 接受线上环境从空白状态开始。

## 8. 分阶段实施计划

### 阶段 A：代码基线与审计

1. 检查 `git status`、`git diff` 和现有测试；
2. 审阅并合并本机未提交的功能改动；
3. 执行自动测试与手动回归：单曲、16 首专辑、DeepSeek Provider、GitHub 收藏、整张专辑审核、审核 JSON 导入；
4. 提交并推送至个人仓库 `main`；
5. 建立可回滚标签，例如 `pre-oracle-deployment`。

验收：生产部署只从一个可复现、已测试、已推送的 Git commit 构建。

### 阶段 B：生产化改造

1. 将 Provider Key 和 GitHub PAT 从浏览器迁移至服务端；
2. 定义受控 API 合约与 Provider 白名单；
3. 调整前端，使其不保存服务器密钥；
4. 保持本地开发模式可用，使用开发环境变量或本地 token modal；
5. 为 API 增加身份验证前提、Origin 校验、限流与错误脱敏；
6. 为 localStorage 设计最小可用的导出/导入迁移方式。

验收：浏览器 DevTools、页面源码和前端存储中没有真实 Provider Key 或 GitHub PAT。

### 阶段 C：部署构件

推荐使用 Docker Compose，构件应包括：

- ARM64 兼容的应用 Dockerfile；
- `compose.yml`：应用服务、受限环境文件、重启策略、健康检查；
- Caddyfile：生产域名、反向代理、安全响应头、上传/请求限制；
- `.env.example`：仅变量名，不含真实值；
- systemd 单元（如 Docker Compose 不作为唯一开机管理方式）；
- `/healthz` 健康检查端点；
- 最小日志轮转与磁盘空间告警说明；
- 部署、更新、回滚和备份脚本或文档。

验收：在 ARM64 环境构建成功；服务重启后可自动恢复；容器仅暴露 loopback 端口。

### 阶段 D：Oracle 与域名配置

1. 创建 Ubuntu ARM 实例，资源总额不超过 Always Free 限制；
2. 创建非 root 管理用户，配置 SSH 公钥与安全更新；
3. 配置 OCI Security List / NSG 和 UFW：仅 `22`、`443`；
4. 配置 DNS 与 Cloudflare Proxy；
5. 配置 Cloudflare Access，仅允许指定邮箱；
6. 在服务器上拉取已批准 Git commit；
7. 上传或安全录入环境变量文件；
8. 启动服务、取得 TLS 证书、完成健康检查。

验收：未认证访问被拒绝；认证后 HTTPS 页面可用；`http://` 自动跳转；公网无法访问 8000。

### 阶段 E：功能验证与上线

1. 生成单曲：验证官方 DeepSeek V4 Flash；
2. 生成 16 首专辑：验证完整结果、失败回退与界面不会永久加载；
3. GitHub 收藏/同步：验证目标仓库写入；
4. 整张专辑审核：验证 16 首初稿、审核 JSON、批准版本、下一轮复审和 `manifest.json`；
5. 重启服务器：验证自动恢复；
6. 检查日志：确认无 Prompt 正文、API Key、GitHub PAT；
7. 使用手机或另一台电脑验证身份验证与跨设备审核历史。

验收：所有核心流程通过，且未在客户端或日志中暴露密钥。

## 9. 运维、备份与回滚

### 备份

- GitHub 审核仓库是 Prompt 审核历史的主备份；
- 服务器每日备份部署配置、非敏感数据库/状态（若未来引入）；
- 密钥单独在密码管理器或云端密钥管理中保存，不进入备份仓库；
- 定期验证从 Git commit + 环境变量恢复新服务器的流程。

### 更新

1. 在本地或测试环境运行测试；
2. 提交并推送；
3. 服务器拉取指定 commit；
4. 构建新镜像并进行健康检查；
5. 通过后切换；失败则回滚到上一个 Git tag / 镜像。

### 监控

- 服务在线和 `/healthz`；
- CPU、内存、磁盘、容器重启次数；
- Provider 请求成功率与耗时（不含正文）；
- GitHub 写入失败、409 重试、认证失败；
- Oracle 账单与 Always Free 用量警报。

## 10. 尚需用户确认的决定

1. 最终域名或子域名是什么？
2. 是否使用 Cloudflare Access（推荐）？
3. 是否只限本人使用，还是未来支持多人？
4. 是否迁移当前浏览器 localStorage 内容？若迁移，哪些数据必须保留？
5. GitHub 曲库仓库与 Prompt 审核仓库是否继续分离？
6. 生产环境是否只启用官方 DeepSeek，还是保留 OpenCode / SynapAI 备用 Provider？
7. 是否允许服务器保存 GitHub 写入 Token，还是保留用户端 OAuth / PAT 授权流程？

## 11. 请 ChatGPT 审阅的重点

请审阅此计划，并重点检查：

1. 是否遗漏了公开部署时的安全风险；
2. Cloudflare Access + Caddy 是否适合单用户私人后台；
3. 服务端 Provider / GitHub Token 迁移方案是否合理；
4. Oracle Always Free ARM 部署、备份、监控和回滚是否可行；
5. 分阶段顺序是否正确，是否存在会导致数据丢失或密钥泄露的步骤；
6. 哪些内容应在实施前补充为明确技术规格或验收标准。

请不要提供或要求任何真实 API Key、PAT、SSH 私钥、Cookie 或密码。

