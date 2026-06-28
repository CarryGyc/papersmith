import { describe, expect, it } from 'vitest'
import {
  createStarterDocument,
  insertTextAsVersion,
  normalizeDocumentPayload,
  selectDocumentVersion
} from '../../server/documentModel.js'

describe('document model', () => {
  it('creates a starter academic document', () => {
    const payload = createStarterDocument(new Date('2026-06-28T00:00:00.000Z'))

    expect(payload.version).toBe(1)
    expect(payload.document.type).toBe('doc')
    expect(payload.document.content[0].type).toBe('heading')
    expect(payload.metadata.title).toBe('Welcome to PaperSmith')
    expect(payload.activeVersionId).toBe('welcome')
    expect(payload.versions).toHaveLength(1)
    expect(payload.versions[0]).toMatchObject({
      id: 'welcome',
      label: 'Welcome',
      source: 'system',
      overallComment: ''
    })
    expect(payload.updatedAt).toBe('2026-06-28T00:00:00.000Z')
  })

  it('normalizes a valid document payload', () => {
    const payload = normalizeDocumentPayload({
      version: 1,
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
      metadata: { title: 'Draft' },
      updatedAt: '2026-06-28T00:00:00.000Z'
    })

    expect(payload.metadata.title).toBe('Draft')
    expect(payload.annotations).toEqual([])
    expect(payload.activeVersionId).toBe('draft-1')
    expect(payload.versions[0]).toMatchObject({
      id: 'draft-1',
      label: 'Draft 1',
      overallComment: ''
    })
  })

  it('preserves unknown metadata fields while normalizing known metadata', () => {
    const payload = normalizeDocumentPayload({
      version: 1,
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
      metadata: {
        title: ' Draft ',
        journal: 'Journal of PaperSmith',
        keywords: ['writing', 'automation']
      }
    })

    expect(payload.metadata).toEqual({
      title: 'Draft',
      author: 'PaperSmith',
      style: 'APA 7th',
      journal: 'Journal of PaperSmith',
      keywords: ['writing', 'automation']
    })
  })

  it('normalizes non-array annotations to an empty array', () => {
    const payload = normalizeDocumentPayload({
      version: 1,
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
      annotations: { id: 'note-1' }
    })

    expect(payload.annotations).toEqual([])
  })

  it('uses the provided time when normalized payloads need updatedAt', () => {
    const payload = normalizeDocumentPayload({
      version: 1,
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
    }, new Date('2026-06-28T12:34:56.000Z'))

    expect(payload.updatedAt).toBe('2026-06-28T12:34:56.000Z')
  })

  it('preserves array annotations during normalization', () => {
    const annotations = [{ id: 'note-1', text: 'Check citation' }]
    const payload = normalizeDocumentPayload({
      version: 1,
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
      annotations
    })

    expect(payload.annotations).toBe(annotations)
  })

  it('resets legacy verification documents to the welcome document', () => {
    const payload = normalizeDocumentPayload(
      {
        version: 1,
        metadata: { title: 'Untitled Paper' },
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Codex inserted verification paragraph 1782667211529.' }]
            }
          ]
        },
        annotations: [{ id: 'ann_legacy', comment: 'Old test comment.' }]
      },
      new Date('2026-06-28T12:00:00.000Z')
    )

    expect(payload.metadata.title).toBe('Welcome to PaperSmith')
    expect(payload.annotations).toEqual([])
    expect(payload.versions).toHaveLength(1)
    expect(payload.document.content[0].content[0].text).toBe('Welcome to PaperSmith')
  })

  it('creates a new active Codex draft version for inserted text', () => {
    const payload = createStarterDocument(new Date('2026-06-28T00:00:00.000Z'))
    const next = insertTextAsVersion(payload, 'First paragraph.\n\nSecond paragraph.', new Date('2026-06-28T01:00:00.000Z'))

    expect(next.activeVersionId).toBe('codex-1782608400000-1')
    expect(next.metadata.title).toBe('Codex 1')
    expect(next.versions.map((version) => version.label)).toEqual(['Welcome', 'Codex 1'])
    expect(next.document.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph.' }] }
    ])
  })

  it('selects an existing version with its own annotations and overall comment', () => {
    const payload = normalizeDocumentPayload({
      version: 1,
      metadata: { title: 'Drafts' },
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Version A' }] }] },
      annotations: [{ id: 'ann_a', comment: 'A' }],
      overallComment: 'Overall A',
      activeVersionId: 'version-a',
      versions: [
        {
          id: 'version-a',
          label: 'Version A',
          source: 'codex',
          document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Version A' }] }] },
          annotations: [{ id: 'ann_a', comment: 'A' }],
          overallComment: 'Overall A'
        },
        {
          id: 'version-b',
          label: 'Version B',
          source: 'codex',
          document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Version B' }] }] },
          annotations: [{ id: 'ann_b', comment: 'B' }],
          overallComment: 'Overall B'
        }
      ]
    })

    const selected = selectDocumentVersion(payload, 'version-b', new Date('2026-06-28T02:00:00.000Z'))

    expect(selected.activeVersionId).toBe('version-b')
    expect(selected.document.content[0].content[0].text).toBe('Version B')
    expect(selected.annotations).toEqual([{ id: 'ann_b', comment: 'B' }])
    expect(selected.overallComment).toBe('Overall B')
  })

  it('rejects invalid document payloads', () => {
    expect(() => normalizeDocumentPayload({ document: null })).toThrow('Expected PaperSmith document payload')
  })
})
