---
name: papersmith-open-editor
description: 打开或恢复本地 PaperSmith 编辑器。用于用户要求打开 PaperSmith、启动论文写作插件、检查右侧编辑器是否在线、恢复连接、确认 http://127.0.0.1:43227 是否可用等场景。
---

# PaperSmith 打开与恢复

使用这个 skill 让本地 PaperSmith 编辑器进入可用状态。

## 工作流程

1. 从 PaperSmith 项目根目录工作。
2. 如果编辑器未运行，执行 `npm run dev` 启动本地服务。
3. 默认编辑器地址是 `http://127.0.0.1:43227/`。只有默认端口被占用时才使用 `PAPERSMITH_PORT`。
4. 先请求 `GET /api/document` 验证服务可达，再告诉用户编辑器已连接。
5. 当用户需要查看或交互时，在浏览器打开编辑器地址。

## 注意事项

- PaperSmith 的本地文档状态在 `papersmith/` 目录中；除非用户明确要求，不要手动编辑这些状态文件。
- 保留现有 C2 编辑器界面和批注流程，不要因为启动/恢复任务顺手重构 UI。
- 如果服务能打开但 Codex 无法插入文本，继续检查 PaperSmith MCP 工具是否可用。
