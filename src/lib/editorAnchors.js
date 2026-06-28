export function selectionToAnchorPayload(editor, docVersion) {
  const selection = editor?.state?.selection ?? {}
  const range = normalizeRange(selection)
  const normalizedDocVersion = normalizeDocVersion(docVersion)

  if (!range) {
    return {
      text: '',
      range: null,
      docVersion: normalizedDocVersion
    }
  }

  const textBetween = editor?.state?.doc?.textBetween
  const text = typeof textBetween === 'function' ? textBetween.call(editor.state.doc, range.from, range.to, '\n', '\n') : ''

  return {
    text: typeof text === 'string' ? text : '',
    range,
    docVersion: normalizedDocVersion
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
