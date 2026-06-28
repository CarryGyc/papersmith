export function normalizeSelectionState(value = {}, now = new Date()) {
  const selection = value && typeof value === 'object' ? value : {}
  const text = typeof selection.text === 'string' ? selection.text : ''
  const range = normalizeRange(selection.range)
  const hasSelection = Boolean(text.trim() && range)

  return {
    version: 1,
    hasSelection,
    text: hasSelection ? text : '',
    range: hasSelection ? range : null,
    docVersion: normalizeDocVersion(selection.docVersion),
    updatedAt: typeof selection.updatedAt === 'string' ? selection.updatedAt : now.toISOString()
  }
}

function normalizeDocVersion(value) {
  return Number.isInteger(value) && value > 0 ? value : 1
}

function normalizeRange(range) {
  if (!range || typeof range !== 'object') return null
  if (!Number.isInteger(range.from) || !Number.isInteger(range.to)) return null
  if (range.from < 0 || range.to <= range.from) return null
  return { from: range.from, to: range.to }
}
