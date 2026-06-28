import { randomUUID } from 'node:crypto'

const KNOWN_TYPES = new Set(['clarity', 'citation', 'structure', 'style', 'question'])

export function createAnnotation(value = {}, now = new Date()) {
  const annotation = value && typeof value === 'object' ? value : {}
  const selection = annotation.selection && typeof annotation.selection === 'object' ? annotation.selection : {}
  const text = typeof selection.text === 'string' ? selection.text : ''
  const range = normalizeRange(selection.range)

  if (!text.trim() || !range) {
    throw new Error('Cannot create annotation without selected text.')
  }

  return {
    id: `ann_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    type: normalizeType(annotation.type),
    comment: normalizeComment(annotation.comment),
    status: 'anchored',
    anchor: {
      text,
      range,
      docVersion: normalizeDocVersion(selection.docVersion)
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    author: 'You'
  }
}

function normalizeType(type) {
  return KNOWN_TYPES.has(type) ? type : 'clarity'
}

function normalizeComment(comment) {
  const value = typeof comment === 'string' ? comment.trim() : ''
  if (!value) throw new Error('Annotation comment is required.')
  return value
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
