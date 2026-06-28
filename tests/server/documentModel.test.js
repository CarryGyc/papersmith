import { describe, expect, it } from 'vitest'
import { createStarterDocument, normalizeDocumentPayload } from '../../server/documentModel.js'

describe('document model', () => {
  it('creates a starter academic document', () => {
    const payload = createStarterDocument(new Date('2026-06-28T00:00:00.000Z'))

    expect(payload.version).toBe(1)
    expect(payload.document.type).toBe('doc')
    expect(payload.document.content[0].type).toBe('heading')
    expect(payload.metadata.title).toBe('Untitled Paper')
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

  it('rejects invalid document payloads', () => {
    expect(() => normalizeDocumentPayload({ document: null })).toThrow('Expected PaperSmith document payload')
  })
})
