const EMPTY_OVERALL_COMMENT = '（无整体修改意见。请不要对未标注内容进行整体性改写。）'
const EMPTY_ORIGINAL_TEXT = '（当前文档没有可导出的正文。）'
const EMPTY_LOCAL_COMMENTS = '（无局部批注。）'
const MISSING_MARKED_TEXT = '（标注文本缺失）'
const MISSING_COMMENT = '（批注内容缺失）'

export function buildFeedbackMarkdown(documentPayload, overallComment = '') {
  const originalText = extractDocumentText(documentPayload?.document).trim()
  const annotations = Array.isArray(documentPayload?.annotations) ? documentPayload.annotations : []
  const normalizedOverallComment = normalizeExportText(overallComment)
  const exportText = originalText || EMPTY_ORIGINAL_TEXT

  return [
    '# PaperSmith Revision Feedback',
    '',
    '## How Codex Should Use This File',
    '请严格区分局部批注与整体批注的作用范围。',
    '',
    '- Local Comments 只适用于其对应的“标注文本”。请按照每条 comment 的要求修改该标注文本，不要把局部批注扩展到未标注内容。',
    '- Overall Comment 只适用于未被 Local Comments 覆盖的其他内容。如果 Overall Comment 为空，请不要对未标注内容进行整体性改写。',
    '- 修订时请保持全文逻辑连贯；如果局部修改影响上下文衔接，可以做必要的最小衔接调整。',
    '- 请输出修改后的完整正文，不要只回复 comments 或修改说明。',
    '',
    '## Current Draft（完整原文）',
    fencedText(exportText),
    '',
    '## Local Comments（局部批注）',
    formatLocalComments(annotations),
    '',
    '## Overall Comment（整体批注）',
    normalizedOverallComment || EMPTY_OVERALL_COMMENT,
    '',
    '## Expected Codex Output',
    '请基于 Current Draft 输出一版修改后的完整正文。Local Comments 内标注过的文本按对应 comment 修改；未被 Local Comments 覆盖的其他内容只按 Overall Comment 修改。'
  ].join('\n')
}

function formatLocalComments(annotations) {
  if (annotations.length === 0) return EMPTY_LOCAL_COMMENTS

  return annotations
    .map((annotation, index) => {
      const markedText = normalizeExportText(annotation?.anchor?.text) || MISSING_MARKED_TEXT
      const comment = normalizeExportText(annotation?.comment) || MISSING_COMMENT

      return [
        `### Local Comment ${index + 1}`,
        `- 标注文本：${markedText}`,
        `- Comment / 修改要求：请按这个要求改这部分：${comment}`,
        '- 作用范围：只修改上面的标注文本；如需保持上下文连贯，只做必要的最小衔接调整。'
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

function fencedText(value) {
  const fence = value.includes('```') ? '````' : '```'
  return `${fence}text\n${value}\n${fence}`
}
