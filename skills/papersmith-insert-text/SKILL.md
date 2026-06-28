---
name: papersmith-insert-text
description: 将 Codex 生成的文本发送到本地 PaperSmith 编辑器。用于用户说把这段发到 PaperSmith、插入右侧编辑器、同步到论文编辑器、append 到 PaperSmith、或基于当前 PaperSmith selection 生成并写入文本的场景。
---

# PaperSmith 文本插入

使用这个 skill 将 Codex 生成的内容写入 PaperSmith，而不是手动修改本地 JSON 状态文件。

## 工作流程

1. 确认 PaperSmith 编辑器可达：`PAPERSMITH_URL` 或 `http://127.0.0.1:43227/`。
2. 如果任务依赖当前选中文本，先调用 `get_papersmith_selection` 读取 selection。
3. 生成要写入的文本，确保不是空字符串或纯空白。
4. 调用 `insert_papersmith_text`，参数为 `{ "text": "..." }`。
5. 只有工具返回 `{ "ok": true }` 后，才告诉用户已经写入 PaperSmith。

## 当前能力边界

- 当前 MCP 工具支持“追加插入文本”，不支持直接替换当前选区或覆盖整篇文档。
- 如果用户要求“替换选中内容”，先给出改写文本；只有用户接受追加写入时，才用 `insert_papersmith_text` 写入。
- 不要把密码、令牌、私密路径、浏览器 cookie 或无关本地数据写入 PaperSmith。

## 兜底方式

如果 MCP 工具暂不可用，但本地编辑器服务正在运行，可以向 `/api/insert-text` POST JSON：

```json
{
  "text": "要插入 PaperSmith 的文本"
}
```
