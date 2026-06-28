---
name: papersmith-insert-text
description: 将 Codex 生成的文本发送到本地 PaperSmith 编辑器，并保存为一个新的 Codex draft version。用于用户说把这段发到 PaperSmith、插入右侧编辑器、同步到论文编辑器、写入 PaperSmith、或基于当前 PaperSmith selection 生成并写入文本的场景。
---

# PaperSmith 文本插入

使用这个 skill 将 Codex 生成的内容写入 PaperSmith，而不是手动修改本地 JSON 状态文件。每次写入都会成为一个新的 Codex draft version，用户可以在 PaperSmith 顶部切换查看。

## 自动同步规则

- 当用户已经处在 PaperSmith 写作流程中，并要求 Codex 写一段正文、改写稿、润色稿或修订稿时，默认在聊天里给出内容后调用 `insert_papersmith_text` 同步到 PaperSmith。
- 如果用户明确说“不要同步”“只在聊天里给我”，不要调用写入工具。
- 如果生成内容只是解释、计划、命令说明或调试反馈，不要写入 PaperSmith。
- 如果回复包含正文和额外说明，只把正文传给 `insert_papersmith_text`；额外说明只能留在聊天里。

## 工作流程

1. 确认 PaperSmith 编辑器可达：`PAPERSMITH_URL` 或 `http://127.0.0.1:43227/`。
2. 如果任务依赖当前选中文本，先调用 `get_papersmith_selection` 读取 selection。
3. 生成要写入的文本，确保不是空字符串或纯空白。
4. 调用 `insert_papersmith_text`，参数为 `{ "text": "..." }`。
5. 只有工具返回 `{ "ok": true }` 后，才告诉用户已经同步到 PaperSmith，并说明这是一个新的 draft version。

## 当前能力边界

- 当前 MCP 工具支持“把生成文本同步为新的 draft version”，不支持直接替换当前选区或覆盖整篇文档。
- 如果用户要求“替换选中内容”，先给出改写文本；只有用户接受同步为新 draft 时，才用 `insert_papersmith_text` 写入。
- 不要把密码、令牌、私密路径、浏览器 cookie 或无关本地数据写入 PaperSmith。

## 兜底方式

如果 MCP 工具暂不可用，但本地编辑器服务正在运行，可以向 `/api/insert-text` POST JSON：

```json
{
  "text": "要插入 PaperSmith 的文本"
}
```
