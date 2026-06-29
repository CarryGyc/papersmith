import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyFeedbackFile, createAnnotation, getDocument, putDocument, putSelection } from '../../src/lib/apiClient.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('loads the document payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => JSON.stringify({ payload: { document: { type: 'doc', content: [] } } })
      }))
    )

    await expect(getDocument()).resolves.toEqual({ document: { type: 'doc', content: [] } })
  })

  it('saves documents with PUT JSON and returns the document payload', async () => {
    const documentPayload = { document: { type: 'doc', content: [] } }
    const savedPayload = { version: 2, document: { type: 'doc', content: [] } }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ payload: savedPayload })
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(putDocument(documentPayload)).resolves.toEqual(savedPayload)
    expect(fetchMock).toHaveBeenCalledWith('/api/document', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(documentPayload)
    })
  })

  it('throws on failed saves', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'broken'
      }))
    )

    await expect(putDocument({ document: { type: 'doc', content: [] } })).rejects.toThrow(
      '500: broken (/api/document)'
    )
  })

  it('preserves status and URL context when an error response body cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => {
          throw new Error('stream unavailable')
        }
      }))
    )

    await expect(getDocument()).rejects.toThrow('500: <unreadable response body> (/api/document)')
  })

  it('returns an empty object for successful empty response bodies', async () => {
    const selectionPayload = { text: 'retrieval practice', range: { from: 120, to: 138 }, docVersion: 3 }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => ''
      }))
    )

    await expect(putSelection(selectionPayload)).resolves.toEqual({})
  })

  it('throws URL context for invalid JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => '{'
      }))
    )

    await expect(getDocument()).rejects.toThrow('Invalid JSON response (/api/document)')
  })

  it('throws URL context for network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    await expect(getDocument()).rejects.toThrow('Network request failed (/api/document): offline')
  })

  it('rejects document responses without a payload envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => JSON.stringify({ ok: true })
      }))
    )

    await expect(getDocument()).rejects.toThrow('Missing payload in response (/api/document)')
  })

  it('saves selection with PUT JSON and returns parsed API JSON', async () => {
    const selectionPayload = { text: 'retrieval practice', range: { from: 120, to: 138 }, docVersion: 3 }
    const responsePayload = {
      ok: true,
      selection: { version: 1, hasSelection: true, text: 'retrieval practice', range: { from: 120, to: 138 }, docVersion: 3 }
    }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify(responsePayload)
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(putSelection(selectionPayload)).resolves.toEqual(responsePayload)
    expect(fetchMock).toHaveBeenCalledWith('/api/selection', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(selectionPayload)
    })
  })

  it('creates annotations with POST JSON and returns parsed API JSON', async () => {
    const annotationPayload = {
      type: 'clarity',
      comment: 'Define the retention window.',
      selection: { text: 'long-term retention', range: { from: 42, to: 61 }, docVersion: 1 }
    }
    const responsePayload = {
      ok: true,
      annotation: { id: 'ann_123', type: 'clarity', status: 'anchored' },
      payload: { version: 2, document: { type: 'doc', content: [] }, annotations: [] }
    }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify(responsePayload)
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createAnnotation(annotationPayload)).resolves.toEqual(responsePayload)
    expect(fetchMock).toHaveBeenCalledWith('/api/annotations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(annotationPayload)
    })
  })

  it('copies feedback as a local markdown file through the API', async () => {
    const responsePayload = {
      ok: true,
      path: 'E:\\gyc_re\\papersmith\\papersmith\\exports\\papersmith-feedback.md',
      fileName: 'papersmith-feedback.md',
      copiedToClipboard: true
    }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify(responsePayload)
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(copyFeedbackFile('# PaperSmith Revision Feedback')).resolves.toEqual(responsePayload)
    expect(fetchMock).toHaveBeenCalledWith('/api/feedback-file', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ markdown: '# PaperSmith Revision Feedback' })
    })
  })

  it('rejects malformed annotation creation responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => JSON.stringify({ ok: true, annotation: { id: 'ann_123' } })
      }))
    )

    await expect(
      createAnnotation({
        type: 'clarity',
        comment: 'Define the retention window.',
        selection: { text: 'long-term retention', range: { from: 42, to: 61 }, docVersion: 1 }
      })
    ).rejects.toThrow('Malformed annotation response (/api/annotations)')
  })
})
