---
name: papersmith-revise-from-feedback
description: 根据 PaperSmith 导出的 feedback markdown 修改论文文本。用于用户上传、粘贴或引用包含 PaperSmith Revision Feedback、Original Text、Local Comments、Overall Comment 的 .md 反馈文件，并要求 Codex 按局部批注和整体意见改稿的场景。
---

# PaperSmith 反馈改稿

使用这个 skill 解析 PaperSmith 导出的反馈 Markdown，并按用户批注修改论文文本。

## 输入识别

优先识别这些部分：

- `Original Text`：待修改原文。
- `Local Comments`：针对具体标注文本的局部批注。
- `Overall Comment`：只作用于未被局部批注覆盖的其余内容。

如果用户只粘贴了部分字段，也要尽量工作；缺失关键原文时，先要求用户补充原文或反馈文件。

## 修改原则

1. 严格区分局部批注和整体意见。
2. `Local Comments` 只修改对应的“标注文本”，不要把局部要求扩展到未标注内容。
3. `Overall Comment` 只修改未被 `Local Comments` 覆盖的内容。
4. 如果 `Overall Comment` 为空或写明无整体意见，不要对未标注内容做整体性改写。
5. 为了保持上下文连贯，可以做最小必要衔接，但不要借此重写整段。
6. 保留用户原文的核心论点、术语和引用意图；不要新增未经用户提供的文献、数据或结论。

## 输出方式

- 默认先在当前 Codex 聊天中给出完整修订稿。
- 如果用户要求同步到 PaperSmith，再使用 `papersmith-insert-text` 将修订稿同步为新的 Codex draft version。
- 当前 MCP 不支持直接覆盖原文；不要声称已经替换 PaperSmith 当前文档。

## 推荐输出结构

当任务较复杂时，按以下顺序回复：

1. 简短说明已按局部批注和整体意见处理。
2. 给出修订后的完整文本。
3. 如有必要，列出 2-4 条关键修改说明。

## 质量标准

- 局部批注必须逐条落实。
- 修改后的文本应符合学术论文写作习惯，避免口语化和过度承诺。
- 如果原文是英文，输出英文；如果原文是中文，输出中文，除非用户要求翻译。
