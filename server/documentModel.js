export function createStarterDocument(now = new Date()) {
  const updatedAt = now.toISOString()

  return {
    version: 1,
    metadata: {
      title: 'Untitled Paper',
      author: 'PaperSmith',
      style: 'APA 7th'
    },
    document: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Untitled Paper' }]
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Start writing here, or ask Codex to draft a section into PaperSmith.'
            }
          ]
        }
      ]
    },
    annotations: [],
    updatedAt
  }
}

export function normalizeDocumentPayload(value, now = new Date()) {
  if (!value || typeof value !== 'object' || !isProseMirrorDoc(value.document)) {
    throw new Error('Expected PaperSmith document payload with a ProseMirror doc.')
  }

  return {
    version: 1,
    metadata: normalizeMetadata(value.metadata),
    document: value.document,
    annotations: Array.isArray(value.annotations) ? value.annotations : [],
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now.toISOString()
  }
}

export function appendTextToDocument(payload, text, now = new Date()) {
  const cleanText = typeof text === 'string' ? text.trim() : ''
  if (!cleanText) {
    throw new Error('Text is required.')
  }

  const normalized = normalizeDocumentPayload(payload, now)

  return {
    ...normalized,
    document: {
      ...normalized.document,
      content: [
        ...normalized.document.content,
        {
          type: 'paragraph',
          content: [{ type: 'text', text: cleanText }]
        }
      ]
    },
    updatedAt: now.toISOString()
  }
}

function normalizeMetadata(value) {
  const metadata = value && typeof value === 'object' ? value : {}
  return {
    ...metadata,
    title: nonEmptyString(metadata.title) ?? 'Untitled Paper',
    author: nonEmptyString(metadata.author) ?? 'PaperSmith',
    style: nonEmptyString(metadata.style) ?? 'APA 7th'
  }
}

function isProseMirrorDoc(value) {
  return value && typeof value === 'object' && value.type === 'doc' && Array.isArray(value.content)
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
