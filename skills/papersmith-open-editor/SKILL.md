---
name: papersmith-open-editor
description: 打开或恢复本地 PaperSmith 编辑器。用于用户要求打开 PaperSmith、启动论文写作插件、检查右侧编辑器是否在线、恢复连接、确认 http://127.0.0.1:43227 是否可用等场景；必须使用 Codex in-app browser，不要使用系统默认浏览器。
---

# PaperSmith 打开与恢复

使用这个 skill 让本地 PaperSmith 编辑器进入可用状态。

## 工作流程

1. 从 PaperSmith 项目根目录工作。
2. 如果编辑器未运行，执行 `npm run dev` 启动本地服务。
3. 默认编辑器地址是 `http://127.0.0.1:43227/`。只有默认端口被占用时才使用 `PAPERSMITH_PORT`。
4. 先请求 `GET /api/document` 验证服务可达，再告诉用户编辑器已连接。
5. 先验证服务已经可达，再打开 Codex in-app browser。不要先打开外置浏览器再切回 Codex in-app browser。
6. 当用户需要查看或交互时，必须在 Codex 的 in-app browser 中打开编辑器地址，不要调用系统默认浏览器、`start`、`Start-Process` 或 `explorer` 打开网页。
7. 成功打开后，明确告诉用户当前 session 已进入 PaperSmith 写作模式。
8. 后续让我生成、给出、发给你、输出或返回论文正文时，默认使用 `papersmith-live-draft-sync`；除非用户明确说“不要同步”或“只在聊天里给我”。

## 浏览器打开规则

- 优先使用 Codex in-app Browser / browser control 能力打开 `http://127.0.0.1:43227/`。
- 打开 PaperSmith 时必须同时使用 `browser:control-in-app-browser` skill；不要只验证服务在线就结束。
- 连接 in-app browser 后必须显式执行 `await (await browser.capabilities.get("visibility")).set(true)`，让用户能看到右侧浏览器。
- 如果没有现成的 PaperSmith 标签页，新建标签页必须使用 `browser.tabs.new()`，然后执行 `tab.goto("http://127.0.0.1:43227/")`。
- 如果当前环境没有可用的 in-app browser 控制能力，只把地址发给用户，并明确说明需要在 Codex 右侧浏览器里打开。
- 不要使用默认系统浏览器作为 PaperSmith 的打开方式；PaperSmith 的主要体验应该在 Codex 工作区内完成。
- 不要使用 `start`、`Start-Process`、`explorer`、`open` 或 URL 直接启动命令打开网页。

## 打开后的写作模式

- 成功打开 PaperSmith 后，把本轮对话视为 PaperSmith 写作模式。
- 在写作模式里，用户说“给我正文”“发给我 introduction”“输出上一版段落”“返回刚才写的内容”时，如果回复内容属于论文正文，必须使用 `papersmith-live-draft-sync`。
- 正文要先出现在 Codex 聊天框，再只把正文同步到 PaperSmith；说明、状态和调试信息不要同步。

## 注意事项

- PaperSmith 的本地文档状态在 `papersmith/` 目录中；除非用户明确要求，不要手动编辑这些状态文件。
- 保留现有 C2 编辑器界面和批注流程，不要因为启动/恢复任务顺手重构 UI。
- 如果服务能打开但 Codex 无法插入文本，继续检查 PaperSmith MCP 工具是否可用。
