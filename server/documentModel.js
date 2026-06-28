export function createStarterDocument(now = new Date()) {
  const updatedAt = now.toISOString()
  const document = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Welcome to PaperSmith' }]
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Ask Codex to draft text into this editor, annotate specific passages, and export focused feedback for revision.'
          }
        ]
      }
    ]
  }
  const annotations = []
  const overallComment = ''
  const welcomeVersion = createDocumentVersion({
    id: 'welcome',
    label: 'Welcome',
    source: 'system',
    createdAt: updatedAt,
    updatedAt,
    document,
    annotations,
    overallComment
  })

  return {
    version: 1,
    metadata: {
      title: 'Welcome to PaperSmith',
      author: 'PaperSmith',
      style: 'APA 7th'
    },
    document,
    annotations,
    overallComment,
    activeVersionId: welcomeVersion.id,
    versions: [welcomeVersion],
    updatedAt
  }
}

export function normalizeDocumentPayload(value, now = new Date()) {
  if (!value || typeof value !== 'object' || !isProseMirrorDoc(value.document)) {
    throw new Error('Expected PaperSmith document payload with a ProseMirror doc.')
  }

  const version = normalizePositiveInteger(value.version, 1)
  const metadata = normalizeMetadata(value.metadata)
  const document = value.document
  const annotations = Array.isArray(value.annotations) ? value.annotations : []
  const hasTopLevelOverallComment = Object.prototype.hasOwnProperty.call(value, 'overallComment')
  const overallComment = hasTopLevelOverallComment ? normalizeOverallComment(value.overallComment) : undefined
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : now.toISOString()

  if (isLegacyVerificationPayload({ document, annotations, versions: value.versions })) {
    return createStarterDocument(now)
  }

  const versions = normalizeVersions(value.versions, {
    document,
    annotations,
    overallComment: overallComment ?? '',
    updatedAt
  })
  const activeVersionId = resolveActiveVersionId(value.activeVersionId, versions)
  const syncedVersions = syncActiveVersion(versions, activeVersionId, {
    document,
    annotations,
    overallComment,
    updatedAt
  })
  const activeVersion = syncedVersions.find((candidate) => candidate.id === activeVersionId) ?? syncedVersions[0]

  return {
    version,
    metadata,
    document: activeVersion.document,
    annotations: activeVersion.annotations,
    overallComment: activeVersion.overallComment ?? '',
    activeVersionId: activeVersion.id,
    versions: syncedVersions,
    updatedAt
  }
}

export function insertTextAsVersion(payload, text, now = new Date()) {
  const cleanText = typeof text === 'string' ? text.trim() : ''
  if (!cleanText) {
    throw new Error('Text is required.')
  }

  const normalized = normalizeDocumentPayload(payload, now)
  const updatedAt = now.toISOString()
  const codexIndex = normalized.versions.filter((version) => version.source === 'codex').length + 1
  const document = textToDocument(cleanText)
  const annotations = []
  const nextVersion = createDocumentVersion({
    id: `codex-${now.getTime()}-${codexIndex}`,
    label: `Codex ${codexIndex}`,
    source: 'codex',
    createdAt: updatedAt,
    updatedAt,
    document,
    annotations,
    overallComment: ''
  })

  return {
    ...normalized,
    metadata: {
      ...normalized.metadata,
      title: nextVersion.label
    },
    document,
    annotations,
    overallComment: nextVersion.overallComment,
    activeVersionId: nextVersion.id,
    versions: [...normalized.versions, nextVersion],
    updatedAt
  }
}

export function selectDocumentVersion(payload, versionId, now = new Date()) {
  const normalized = normalizeDocumentPayload(payload, now)
  const selectedVersion = normalized.versions.find((version) => version.id === versionId)
  if (!selectedVersion) return normalized

  return {
    ...normalized,
    document: selectedVersion.document,
    annotations: selectedVersion.annotations,
    overallComment: selectedVersion.overallComment ?? '',
    activeVersionId: selectedVersion.id,
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

function createDocumentVersion({ id, label, source, createdAt, updatedAt, document, annotations, overallComment }) {
  return {
    id,
    label,
    source,
    createdAt,
    updatedAt,
    document,
    annotations,
    overallComment: normalizeOverallComment(overallComment)
  }
}

function normalizeVersions(value, activeContent) {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      createDocumentVersion({
        id: 'draft-1',
        label: 'Draft 1',
        source: 'local',
        createdAt: activeContent.updatedAt,
        updatedAt: activeContent.updatedAt,
        document: activeContent.document,
        annotations: activeContent.annotations,
        overallComment: activeContent.overallComment
      })
    ]
  }

  const versions = []
  const seenIds = new Set()

  value.forEach((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || !isProseMirrorDoc(candidate.document)) return

    const fallbackId = `draft-${index + 1}`
    const id = nonEmptyString(candidate.id) ?? uniqueVersionId(fallbackId, seenIds)
    const uniqueId = seenIds.has(id) ? uniqueVersionId(id, seenIds) : id
    seenIds.add(uniqueId)
    versions.push(
      createDocumentVersion({
        id: uniqueId,
        label: nonEmptyString(candidate.label) ?? `Draft ${index + 1}`,
        source: nonEmptyString(candidate.source) ?? 'local',
        createdAt: nonEmptyString(candidate.createdAt) ?? activeContent.updatedAt,
        updatedAt: nonEmptyString(candidate.updatedAt) ?? activeContent.updatedAt,
        document: candidate.document,
        annotations: Array.isArray(candidate.annotations) ? candidate.annotations : [],
        overallComment: candidate.overallComment
      })
    )
  })

  if (versions.length > 0) return versions
  return normalizeVersions([], activeContent)
}

function resolveActiveVersionId(value, versions) {
  const requestedId = nonEmptyString(value)
  if (requestedId && versions.some((version) => version.id === requestedId)) return requestedId
  return versions[0].id
}

function syncActiveVersion(versions, activeVersionId, activeContent) {
  return versions.map((version) => {
    if (version.id !== activeVersionId) return version
    return {
      ...version,
      document: activeContent.document,
      annotations: activeContent.annotations,
      overallComment:
        activeContent.overallComment === undefined ? version.overallComment : normalizeOverallComment(activeContent.overallComment),
      updatedAt: activeContent.updatedAt
    }
  })
}

function uniqueVersionId(baseId, seenIds) {
  let suffix = 1
  let id = baseId
  while (seenIds.has(id)) {
    suffix += 1
    id = `${baseId}-${suffix}`
  }
  return id
}

function textToDocument(text) {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)

  return {
    type: 'doc',
    content: blocks.map((block) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: block }]
    }))
  }
}

function isLegacyVerificationPayload(payload) {
  if (Array.isArray(payload.versions) && payload.versions.length > 0) return false
  const text = extractDocumentText(payload.document)
  return /Codex inserted verification paragraph|PaperSmith sync check|SSE verification/.test(text)
}

function extractDocumentText(node) {
  if (!node || typeof node !== 'object') return ''
  if (typeof node.text === 'string') return node.text
  return Array.isArray(node.content) ? node.content.map(extractDocumentText).join(' ') : ''
}

function isProseMirrorDoc(value) {
  return value && typeof value === 'object' && value.type === 'doc' && Array.isArray(value.content)
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizePositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function normalizeOverallComment(value) {
  return typeof value === 'string' ? value : ''
}
