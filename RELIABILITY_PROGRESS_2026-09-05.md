# Awen 可靠性修复进度保存

更新时间：2026-09-05T12:40:40.062046+08:00

当前代码：`/Users/gavin/dev/SUNO/product-awen-music`，main，HEAD 未改变（3ca4e3f）。没有真实 GitHub 写入，没有 Suno API 调用。

## 现场保护
- 本轮开始前完整工作区副本：`/Users/gavin/dev/SUNO/awen-audit-backups/20260905-followup-b7b6fbtq/workspace/`。
- 同目录 `tracked.patch` 为开始前改动；`followup-checkpoint.patch` 为本次进度快照（仅 tracked 文件）。新增文件仍在当前工作区。
- `review-remote.git` 为审核仓库只读 bare 快照，未改写远端。

## 已实施，正在验收
- 固定启动器使用 127.0.0.1:8000，取消自动换端口；健康检查加入目录、PID、运行代码指纹。
- 工作区同步落盘、写入失败反馈、跨标签页冲突保护和恢复分支；编辑审核 prompt 后撤销旧批准，更新 sourceHash。
- 审核初稿、结果导入、采纳修改、已应用状态增加持久化恢复任务；冻结审核结果时间戳；远端已存在相同正文时不重复 PUT。
- 曲库请求固定目标，延迟确认不覆盖新编辑；审核 manifest 拒绝回退较新审核轮次。
- 旧 build.py 改为输出 legacy-build，不再覆盖运行版。
- React / ReactDOM / Babel 使用原有固定版本和 SHA-384 校验的本地副本（docs/vendor），未升级依赖。
- 发布脚本同时携带运行资源，并修复新文件未被 diff 检出的漏发；仅在本地 bare 仓库测试发布。

## 已通过
- 原有 24 项 Node 测试基线；新增工作区/审核日志测试后 reliability 子集 15 项通过。
- 实际 Chrome + React：模板专辑刷新、库写入失败可见、原字节保留。
- 实际 React + 模拟 GitHub：曲库断网、响应丢失、乱序同步、本地远端冲突与刷新。
- 实际 React + 模拟 GitHub：初稿 manifest 失败恢复；审核三文件部分失败恢复；响应丢失不重复写；手动 prompt 修改撤销批准。
- 临时项目：旧构建不改变运行版、同端口服务重启和身份检查、本地 bare 发布包含新资源且重复运行不新增提交。
- 真实远端只读：22 条库记录，346 条审核记录；503 个引用文件已核对，未发现缺失引用、重复 key 或 sourceHash 不一致。详见 REMOTE_INTEGRITY_2026-09-05.json。

## 正在定位 / 尚未完成
1. “标记已应用 Suno”在模拟 manifest 失败、刷新后恢复被版本保护拦截；正在比较刷新前后实际 source 内容，不能宣称该场景已通过。
2. 完成最新修改后的全套回归，以及审核采纳动作、主工作区多标签页行为验收。
3. 将正式 8000 服务重启为加入新身份字段的 server.py 并核实；目前该服务仍是本轮开始前进程，静态页面已读取当前磁盘代码。
4. 正式浏览器数据未导出或改动：可访问 Chrome profile 当前没有 Awen 标签页；本地历史数据与远端差异尚未裁决。
5. 需要整理最终根因、变更、验证边界、启动和回滚说明；不能把模拟 API 成功说成真实 GitHub 写入成功。


## 已暂停（用户最新指示）
最新完整交接见 RELIABILITY_PAUSED_2026-09-05.md，并已追加到 Obsidian Memory/Inbox/Awen Reliability Audit 2026-09-05.md。以该暂停交接为准，旧进度的部分待办已更新。
