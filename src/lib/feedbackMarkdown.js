const EMPTY_OVERALL_COMMENT = '（无整体修改意见。请不要对未标注内容进行整体性改写。）'

export function buildFeedbackMarkdown(documentPayload, overallComment = '') {
  const originalText = extractDocumentText(documentPayload?.document).trim()
  const annotations = Array.isArray(documentPayload?.annotations) ? documentPayload.annotations : []
  const normalizedOverallComment = normalizeExportText(overallComment)

  return [
    '# PaperSmith Revision Feedback',
    '',
    '## Revision Instructions',
    '请严格区分局部批注与整体批注的作用范围。',
    '',
    '- Local Comments 只适用于其对应的“标注文本”。请根据每条批注修改该标注文本，不要将局部批注扩展到未标注内容。',
    '- Overall Comment 只适用于未被 Local Comments 覆盖的其他内容。如果 Overall Comment 为空，请不要对未标注内容进行整体性改写。',
    '- 修订时请保持全文逻辑连贯；如局部修改影响上下文衔接，可做必要的最小衔接调整。',
    '',
    '## Overall Comment',
    normalizedOverallComment || EMPTY_OVERALL_COMMENT,
    '',
    '## Original Text',
    originalText || '（当前文档没有可导出的正文。）',
    '',
    '## Local Comments',
    formatLocalComments(annotations),
    ''
  ].join('\n')
}

function formatLocalComments(annotations) {
  if (annotations.length === 0) return '（无局部批注。）'

  return annotations
    .map((annotation, index) => {
      const markedText = normalizeExportText(annotation?.anchor?.text) || '（标注文本缺失）'
      const comment = normalizeExportText(annotation?.comment) || '（批注内容缺失）'

      return [
        `${index + 1}. 标注文本：${markedText}`,
        `   Comment：请按以下要求修改该标注文本：${comment}`
      ].join('\n')
    })
    .join('\n\n')
}

function extractDocumentText(node) {
  if (!node || typeof node !== 'object') return ''
  if (typeof node.text === 'string') return node.text

  const content = Array.isArray(node.content) ? node.content.map(extractDocumentText).join('') : ''
  if (node.type === 'heading' || node.type === 'paragraph') return `${content}\n\n`
  return content
}

function normalizeExportText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}
