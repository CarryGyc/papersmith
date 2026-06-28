---
name: papersmith
description: PaperSmith 中文总入口。用于用户提到 PaperSmith、论文写作插件、右侧编辑器、Codex 输出同步、PaperSmith 已打开后的正文写作请求、选中文本改写、批注反馈、feedback markdown、local comments、overall comment、或需要判断该用哪个 PaperSmith workflow 的场景。
---

# PaperSmith 总入口

使用这个 skill 判断当前 PaperSmith 任务应该进入哪个专项 workflow。它负责路由，不负责承载所有细节。

## 路由表

| 用户意图 | 使用的专项 skill |
| --- | --- |
| 打开 PaperSmith、恢复编辑器、检查服务是否在线 | `papersmith-open-editor` |
| PaperSmith 已打开后，用户要求写正文、改正文、润色正文、生成论文段落或修订稿 | `papersmith-live-draft-sync` |
| 把 Codex 生成内容同步为右侧编辑器中的新 draft | `papersmith-insert-text` |
| 根据 PaperSmith 导出的 `.md` 批注反馈改稿 | `papersmith-revise-from-feedback` |
| 改写当前 PaperSmith 选中文本 | `papersmith-rewrite-selection` |
| 做学术论文语言、逻辑、APA 风格润色 | `papersmith-academic-polish` |

## 判断规则

- 用户说“打开、启动、连不上、检查 PaperSmith”，优先进入 `papersmith-open-editor`。
- PaperSmith 已经打开后，用户要求写正文、改正文、润色正文、生成论文段落或修订稿，优先进入 `papersmith-live-draft-sync`。
- 用户明确说“把这段发到 PaperSmith、插入右侧、同步到编辑器”，且正文内容已经确定时，进入 `papersmith-insert-text`。
- 用户提供 `PaperSmith Revision Feedback`、`Original Text`、`Local Comments`、`Overall Comment`，优先进入 `papersmith-revise-from-feedback`。
- 用户说“改我选中的、当前 selection、这句选中文本”，优先进入 `papersmith-rewrite-selection`。
- 用户只要求论文表达更学术、更自然、更符合 APA 或英文论文风格，优先进入 `papersmith-academic-polish`。

## 全局约束

- PaperSmith 默认地址是 `http://127.0.0.1:43227/`。
- 可用 MCP 工具包括 `insert_papersmith_text` 和 `get_papersmith_selection`。
- 不要手动编辑 `papersmith/` 状态目录，除非用户明确要求。
- 当前 MCP 会把生成文本同步为新的 Codex draft version，不能直接替换选区或覆盖整篇文档；涉及替换时必须说明能力边界。
- PaperSmith 写作流程中，聊天回复必须先显示正文；调用 `insert_papersmith_text` 时只传正文，不传解释说明。
- 用户用中文提问时，用中文回复；涉及论文正文时按用户提供的语言写作。

## 示例触发语

- “打开 PaperSmith。”
- “把这段发到右侧编辑器。”
- “根据这个 feedback md 改稿。”
- “改写我当前选中的这句话。”
- “把这段润色成学术论文风格，然后同步到 PaperSmith。”
