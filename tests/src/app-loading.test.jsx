import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.jsx'

vi.mock('../../src/components/EditorSurface.jsx', () => ({
  default({ documentPayload, onChange, onSelectionChange }) {
    const bodyText = extractText(documentPayload.document)
    return (
      <section aria-label="Paper editor">
        <p>{bodyText}</p>
        <p>Version {documentPayload.version}</p>
        <p>Annotations {documentPayload.annotations?.length ?? 0}</p>
        <button
          aria-label="Mock editor change"
          type="button"
          onClick={() =>
            onChange({
              ...documentPayload,
              document: paragraphDocument('Edited copy')
            })
          }
        >
          edit
        </button>
        <button
          aria-label="Mock editor change A"
          type="button"
          onClick={() =>
            onChange({
              ...documentPayload,
              document: paragraphDocument('Edit A')
            })
          }
        >
          edit A
        </button>
        <button
          aria-label="Mock editor change B"
          type="button"
          onClick={() =>
            onChange({
              ...documentPayload,
              document: paragraphDocument('Edit B')
            })
          }
        >
          edit B
        </button>
        <button
          aria-label="Mock selection change"
          type="button"
          onClick={() =>
            onSelectionChange({
              hasSelection: true,
              text: 'Edited',
              range: { from: 1, to: 7 },
              docVersion: documentPayload.version
            })
          }
        >
          select
        </button>
        <button
          aria-label="Mock alternate selection change"
          type="button"
          onClick={() =>
            onSelectionChange({
              hasSelection: true,
              text: 'Later',
              range: { from: 8, to: 13 },
              docVersion: documentPayload.version
            })
          }
        >
          select later
        </button>
      </section>
    )
  }
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('App document loading', () => {
  it('loads and displays document title', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            payload: {
              version: 1,
              metadata: { title: 'Loaded Paper', author: 'PaperSmith', style: 'APA 7th' },
              document: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Loaded Paper' }] }] },
              annotations: [],
              updatedAt: '2026-06-28T00:00:00.000Z'
            }
          })
      }))
    )

    render(<App />)

    expect(await screen.findByText('Loaded Paper')).toBeInTheDocument()
  })

  it('refreshes the editor when the document event stream reports an external change', async () => {
    const eventSources = []
    const FakeEventSource = createFakeEventSource(eventSources)
    let documentGets = 0
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url !== '/api/document') return jsonResponse({})
        documentGets += 1
        const text = documentGets === 1 ? 'Initial copy' : 'Codex synced copy'
        return jsonResponse({ payload: documentPayload(text) })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    expect(eventSources).toHaveLength(1)
    expect(eventSources[0].url).toBe('/api/document-events')

    await act(async () => {
      eventSources[0].emit('document-changed', { updatedAt: '2026-06-28T00:01:00.000Z' })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByText('Codex synced copy')).toBeInTheDocument()
  })

  it('switches draft versions with version-scoped annotations and overall comments', async () => {
    const documentSaves = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/document' && options?.method === 'PUT') {
          const payload = JSON.parse(options.body)
          documentSaves.push(payload)
          return jsonResponse({ payload })
        }
        return jsonResponse({ payload: versionedDocumentPayload() })
      })
    )

    render(<App />)
    expect(await screen.findByText('Draft A text')).toBeInTheDocument()
    expect(screen.getByText('Comment for A')).toBeInTheDocument()
    expect(screen.getByLabelText('Overall comment')).toHaveValue('Overall A')

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Draft B' }))

    expect(screen.getByText('Draft B text')).toBeInTheDocument()
    expect(screen.getByText('Comment for B')).toBeInTheDocument()
    expect(screen.queryByText('Comment for A')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Overall comment')).toHaveValue('Overall B')

    fireEvent.change(screen.getByLabelText('Overall comment'), { target: { value: 'Overall B revised' } })
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })

    expect(documentSaves.at(-1)).toMatchObject({
      activeVersionId: 'draft-b',
      overallComment: 'Overall B revised'
    })
    expect(documentSaves.at(-1).versions.find((version) => version.id === 'draft-b').overallComment).toBe(
      'Overall B revised'
    )
    expect(documentSaves.at(-1).versions.find((version) => version.id === 'draft-a').overallComment).toBe('Overall A')
  })

  it('copies feedback for only the currently visible draft version', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ payload: versionedDocumentPayload() })))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(<App />)
    expect(await screen.findByText('Draft A text')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Draft B' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy feedback' }))

    expect(writeText).toHaveBeenCalledTimes(1)
    const markdown = writeText.mock.calls[0][0]
    expect(markdown).toContain('# PaperSmith Revision Feedback')
    expect(markdown).toContain('## Current Draft（完整原文）')
    expect(markdown).toContain('## Local Comments（局部批注）')
    expect(markdown).toContain('## Overall Comment（整体批注）')
    expect(markdown).toContain('Draft B text')
    expect(markdown).toContain('Comment for B')
    expect(markdown).toContain('Overall B')
    expect(markdown).not.toContain('Draft A text')
    expect(markdown).not.toContain('Comment for A')
    expect(markdown).not.toContain('Overall A')
  })

  it('renders document content in a stable workspace center row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ payload: documentPayload('Initial copy') })))

    render(<App />)

    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    expect(screen.getByLabelText('Document')).toHaveClass('workspace-center')
  })

  it('shows stored annotations in the inspector list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          payload: documentPayload('Initial copy', {
            annotations: [
              {
                id: 'ann_seed',
                type: 'clarity',
                comment: 'Stored annotation should wait for selection.',
                anchor: { text: 'Initial copy' }
              }
            ]
          })
        })
      )
    )

    render(<App />)

    expect(await screen.findByText('Version 1')).toBeInTheDocument()
    expect(screen.getByText('Stored annotation should wait for selection.')).toBeInTheDocument()
    expect(screen.getAllByText('Initial copy')).toHaveLength(2)
    expect(screen.getByText('1 annotation')).toBeInTheDocument()
  })

  it('shows an alert when the document cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Document could not be loaded.')
  })

  it('does not render a late document after unmounting before load resolves', async () => {
    const deferred = createDeferred()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(() => deferred.promise))

    const { unmount } = render(<App />)
    unmount()

    await act(async () => {
      deferred.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            payload: {
              version: 1,
              metadata: { title: 'Late Paper', author: 'PaperSmith', style: 'APA 7th' },
              document: { type: 'doc', content: [] },
              annotations: [],
              updatedAt: '2026-06-28T00:00:00.000Z'
            }
          })
      })
      await deferred.promise
      await Promise.resolve()
    })

    expect(screen.queryByText('Late Paper')).not.toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('flushes a pending document save when the editor unmounts', async () => {
    const documentSaves = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/document' && options?.method === 'PUT') {
          const payload = JSON.parse(options.body)
          documentSaves.push(payload)
          return jsonResponse({ payload: { ...payload, version: 2 } })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    const { unmount } = render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change' }))
    unmount()

    expect(documentSaves).toHaveLength(1)
    expect(extractText(documentSaves[0].document)).toBe('Edited copy')
  })

  it('reports autosave failures without replacing the loaded editor with a load error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/document' && options?.method === 'PUT') {
          throw new Error('save failed')
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })

    expect(screen.getByRole('status')).toHaveTextContent('Document changes could not be saved.')
    expect(screen.getByText('Edited copy')).toBeInTheDocument()
    expect(screen.queryByText('Document could not be loaded.')).not.toBeInTheDocument()
  })

  it('debounces and dedupes selection sync', async () => {
    const selectionSaves = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/selection') {
          selectionSaves.push(JSON.parse(options.body))
          return jsonResponse({})
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Mock selection change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mock selection change' }))
    expect(selectionSaves).toHaveLength(0)

    await act(async () => {
      vi.advanceTimersByTime(200)
      await Promise.resolve()
    })
    expect(selectionSaves).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await act(async () => {
      vi.advanceTimersByTime(200)
      await Promise.resolve()
    })
    expect(selectionSaves).toHaveLength(1)
  })

  it('uses the server-saved document payload for later selection versions', async () => {
    const selectionSaves = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/document' && options?.method === 'PUT') {
          const payload = JSON.parse(options.body)
          return jsonResponse({ payload: { ...payload, version: 2 } })
        }
        if (url === '/api/selection') {
          selectionSaves.push(JSON.parse(options.body))
          return jsonResponse({})
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })
    expect(screen.getByText('Version 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await act(async () => {
      vi.advanceTimersByTime(200)
      await Promise.resolve()
    })
    expect(selectionSaves[0]).toMatchObject({ docVersion: 2 })
  })

  it('does not let an older in-flight autosave overwrite newer local edits', async () => {
    const firstSave = createDeferred()
    const documentSaves = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/document' && options?.method === 'PUT') {
          const payload = JSON.parse(options.body)
          documentSaves.push(payload)
          if (documentSaves.length === 1) return firstSave.promise
          return jsonResponse({ payload: { ...payload, version: payload.version + 1 } })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change A' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })
    expect(documentSaves).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change B' }))
    expect(screen.getByText('Edit B')).toBeInTheDocument()

    await act(async () => {
      firstSave.resolve(jsonResponse({ payload: { ...documentSaves[0], version: 2 } }))
      await firstSave.promise
      await Promise.resolve()
    })

    expect(screen.getByText('Edit B')).toBeInTheDocument()
    expect(screen.queryByText('Edit A')).not.toBeInTheDocument()
  })

  it('serializes overlapping autosaves so a stale save cannot persist after a newer save', async () => {
    const firstSave = createDeferred()
    const secondSave = createDeferred()
    const documentSaves = []
    let inFlightSaves = 0
    let maxConcurrentSaves = 0

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/document' && options?.method === 'PUT') {
          const payload = JSON.parse(options.body)
          documentSaves.push(payload)
          inFlightSaves += 1
          maxConcurrentSaves = Math.max(maxConcurrentSaves, inFlightSaves)

          const saveResponse = documentSaves.length === 1 ? firstSave.promise : secondSave.promise
          return saveResponse.finally(() => {
            inFlightSaves -= 1
          })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change A' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })
    expect(documentSaves.map((payload) => extractText(payload.document))).toEqual(['Edit A'])

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change B' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })
    expect(documentSaves.map((payload) => extractText(payload.document))).toEqual(['Edit A'])

    await act(async () => {
      firstSave.resolve(jsonResponse({ payload: { ...documentSaves[0], version: 2 } }))
      await firstSave.promise
      await Promise.resolve()
    })
    expect(documentSaves.map((payload) => extractText(payload.document))).toEqual(['Edit A', 'Edit B'])

    await act(async () => {
      secondSave.resolve(jsonResponse({ payload: { ...documentSaves[1], version: 3 } }))
      await secondSave.promise
      await Promise.resolve()
    })
    expect(maxConcurrentSaves).toBe(1)
    expect(screen.getByText('Edit B')).toBeInTheDocument()
    expect(screen.queryByText('Edit A')).not.toBeInTheDocument()
  })

  it('waits for a pending edit debounce before sending it after an in-flight save settles', async () => {
    const firstSave = createDeferred()
    const secondSave = createDeferred()
    const documentSaves = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/document' && options?.method === 'PUT') {
          const payload = JSON.parse(options.body)
          documentSaves.push(payload)
          return documentSaves.length === 1 ? firstSave.promise : secondSave.promise
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change A' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })
    expect(documentSaves.map((payload) => extractText(payload.document))).toEqual(['Edit A'])

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change B' }))
    await act(async () => {
      vi.advanceTimersByTime(200)
      await Promise.resolve()
    })

    await act(async () => {
      firstSave.resolve(jsonResponse({ payload: { ...documentSaves[0], version: 2 } }))
      await firstSave.promise
      await Promise.resolve()
    })
    expect(documentSaves.map((payload) => extractText(payload.document))).toEqual(['Edit A'])

    await act(async () => {
      vi.advanceTimersByTime(200)
      await Promise.resolve()
    })
    expect(documentSaves.map((payload) => extractText(payload.document))).toEqual(['Edit A', 'Edit B'])

    await act(async () => {
      secondSave.resolve(jsonResponse({ payload: { ...documentSaves[1], version: 3 } }))
      await secondSave.promise
      await Promise.resolve()
    })
    expect(screen.getByText('Edit B')).toBeInTheDocument()
  })

  it('creates an annotation from the current editor selection', async () => {
    const user = userEvent.setup()
    const annotationRequests = []
    const createdAnnotation = {
      id: 'ann_created',
      type: 'clarity',
      comment: 'Define the evidence.',
      anchor: { text: 'Edited' },
      status: 'anchored'
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/annotations' && options?.method === 'POST') {
          annotationRequests.push(JSON.parse(options.body))
          return jsonResponse({
            ok: true,
            annotation: createdAnnotation,
            payload: documentPayload('Initial copy', {
              version: 2,
              annotations: [createdAnnotation]
            })
          })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), '  Define the evidence.  ')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(await screen.findByText('Version 2')).toBeInTheDocument()
    expect(annotationRequests).toEqual([
      {
        type: 'clarity',
        comment: 'Define the evidence.',
        selection: {
          hasSelection: true,
          text: 'Edited',
          range: { from: 1, to: 7 },
          docVersion: 1
        }
      }
    ])
    expect(screen.queryByLabelText('Annotation comment')).not.toBeInTheDocument()
    expect(screen.getByText('Define the evidence.')).toBeInTheDocument()
    expect(screen.getByText('Edited')).toBeInTheDocument()
  })

  it('keeps multiple comments for different selected text in the inspector', async () => {
    const user = userEvent.setup()
    const annotationRequests = []
    const firstAnnotation = {
      id: 'ann_start',
      type: 'clarity',
      comment: '1',
      anchor: { text: 'Edited' },
      status: 'anchored'
    }
    const secondAnnotation = {
      id: 'ann_smith',
      type: 'clarity',
      comment: '2',
      anchor: { text: 'Later' },
      status: 'anchored'
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/annotations' && options?.method === 'POST') {
          annotationRequests.push(JSON.parse(options.body))
          const annotations = annotationRequests.length === 1 ? [firstAnnotation] : [firstAnnotation, secondAnnotation]
          return jsonResponse({
            ok: true,
            annotation: annotations.at(-1),
            payload: documentPayload('Initial copy', {
              version: 1 + annotationRequests.length,
              annotations
            })
          })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), '1')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))
    expect(await screen.findByText('1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock alternate selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), '2')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(await screen.findByText('2 annotations')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Edited')).toBeInTheDocument()
    expect(screen.getByText('Later')).toBeInTheDocument()
    expect(annotationRequests.map((request) => request.selection.text)).toEqual(['Edited', 'Later'])
  })

  it('copies revision feedback as a complete markdown document and resets the copied state after three seconds', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          payload: documentPayload('You should revise this sentence.', {
            annotations: [
              {
                id: 'ann_you',
                type: 'clarity',
                comment: 'Use a more formal subject.',
                anchor: { text: 'You' },
                status: 'anchored'
              }
            ]
          })
        })
      )
    )

    render(<App />)
    expect(await screen.findByText('You should revise this sentence.')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('Overall comment'), {
      target: { value: 'Make unmarked content more academic.' }
    })
    const createObjectURL = vi.fn()
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...globalThis.URL, createObjectURL, revokeObjectURL })
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    fireEvent.click(screen.getByRole('button', { name: 'Copy feedback' }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledTimes(1)
    const markdown = writeText.mock.calls[0][0]
    expect(markdown).toContain('# PaperSmith Revision Feedback')
    expect(markdown).toContain('## Current Draft（完整原文）')
    expect(markdown).toContain('You should revise this sentence.')
    expect(markdown).toContain('## Local Comments（局部批注）')
    expect(markdown).toContain('标注文本：You')
    expect(markdown).toContain('修改要求：请按这个要求改这部分：Use a more formal subject.')
    expect(markdown).toContain('## Overall Comment（整体批注）')
    expect(markdown).toContain('Make unmarked content more academic.')
    expect(markdown).toContain('请输出修改后的完整正文，不要只回复 comments 或修改说明。')
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(anchorClick).not.toHaveBeenCalled()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByRole('button', { name: 'Copy feedback' })).toBeInTheDocument()
  })

  it('falls back to selection copy before downloading when clipboard text write fails', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('clipboard blocked')
    })
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ payload: documentPayload('Fallback draft') })))
    const createObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...globalThis.URL, createObjectURL, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const originalExecCommand = document.execCommand
    const execCommand = vi.fn(() => true)
    document.execCommand = execCommand

    try {
      render(<App />)
      expect(await screen.findByText('Fallback draft')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Copy feedback' }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(writeText).toHaveBeenCalledTimes(1)
      expect(execCommand).toHaveBeenCalledWith('copy')
      expect(
        Array.from(document.querySelectorAll('textarea')).some((textarea) =>
          textarea.value.includes('# PaperSmith Revision Feedback')
        )
      ).toBe(false)
      expect(createObjectURL).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    } finally {
      document.execCommand = originalExecCommand
    }
  })

  it('falls back to selection copy when the Clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ payload: documentPayload('No clipboard draft') })))
    const createObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...globalThis.URL, createObjectURL, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const originalExecCommand = document.execCommand
    const execCommand = vi.fn(() => true)
    document.execCommand = execCommand

    try {
      render(<App />)
      expect(await screen.findByText('No clipboard draft')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Copy feedback' }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(execCommand).toHaveBeenCalledWith('copy')
      expect(createObjectURL).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    } finally {
      document.execCommand = originalExecCommand
    }
  })

  it('requires a fresh editor selection before reopening the composer after annotation save', async () => {
    const user = userEvent.setup()
    const createdAnnotation = {
      id: 'ann_created',
      type: 'clarity',
      comment: 'Define the evidence.',
      anchor: { text: 'Edited' },
      status: 'anchored'
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/annotations' && options?.method === 'POST') {
          return jsonResponse({
            ok: true,
            annotation: createdAnnotation,
            payload: documentPayload('Initial copy', {
              version: 2,
              annotations: [createdAnnotation]
            })
          })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), 'Define the evidence.')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(await screen.findByText('Define the evidence.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Annotation comment')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    expect(screen.queryByLabelText('Annotation comment')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    expect(screen.getByLabelText('Annotation comment')).toBeInTheDocument()
  })

  it('syncs a cleared selection after annotation save', async () => {
    const selectionSaves = []
    const createdAnnotation = {
      id: 'ann_created',
      type: 'clarity',
      comment: 'Define the cleared anchor.',
      anchor: { text: 'Edited' },
      status: 'anchored'
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/annotations' && options?.method === 'POST') {
          return jsonResponse({
            ok: true,
            annotation: createdAnnotation,
            payload: documentPayload('Initial copy', {
              version: 2,
              annotations: [createdAnnotation]
            })
          })
        }
        if (url === '/api/selection') {
          selectionSaves.push(JSON.parse(options.body))
          return jsonResponse({})
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Mock selection change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annotate' }))
    fireEvent.change(screen.getByLabelText('Annotation comment'), { target: { value: 'Define the cleared anchor.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save annotation' }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('Define the cleared anchor.')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(200)
      await Promise.resolve()
    })

    expect(selectionSaves.at(-1)).toEqual({
      hasSelection: false,
      text: '',
      range: null,
      docVersion: 2
    })
  })

  it('reports annotation failures without replacing the loaded editor with a load error', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/annotations' && options?.method === 'POST') {
          throw new Error('annotation failed')
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), 'Define this.')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(await screen.findByText('Annotation could not be saved.')).toBeInTheDocument()
    expect(screen.getByText('Initial copy')).toBeInTheDocument()
    expect(screen.queryByText('Document could not be loaded.')).not.toBeInTheDocument()
  })

  it('preserves the annotation draft after failure and allows retry', async () => {
    const user = userEvent.setup()
    const annotationRequests = []
    const createdAnnotation = {
      id: 'ann_retry',
      type: 'clarity',
      comment: 'Retry draft.',
      anchor: { text: 'Edited' },
      status: 'anchored'
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/annotations' && options?.method === 'POST') {
          annotationRequests.push(JSON.parse(options.body))
          if (annotationRequests.length === 1) throw new Error('annotation failed')
          return jsonResponse({
            ok: true,
            annotation: createdAnnotation,
            payload: documentPayload('Initial copy', {
              version: 2,
              annotations: [createdAnnotation]
            })
          })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), 'Retry draft.')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(await screen.findByText('Annotation could not be saved.')).toBeInTheDocument()
    expect(screen.getByLabelText('Annotation comment')).toHaveValue('Retry draft.')

    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(await screen.findByText('Retry draft.')).toBeInTheDocument()
    expect(annotationRequests).toHaveLength(2)
    expect(screen.queryByLabelText('Annotation comment')).not.toBeInTheDocument()
  })

  it('disables annotation save while submit is pending and prevents duplicate posts', async () => {
    const user = userEvent.setup()
    const annotationSave = createDeferred()
    const annotationRequests = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/annotations' && options?.method === 'POST') {
          annotationRequests.push(JSON.parse(options.body))
          return annotationSave.promise
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), 'Pending draft.')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(screen.getByLabelText('Annotation comment')).toHaveValue('Pending draft.')
    expect(screen.getByRole('button', { name: 'Save annotation' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))
    expect(annotationRequests).toHaveLength(1)

    await act(async () => {
      annotationSave.resolve(
        jsonResponse({
          ok: true,
          annotation: { id: 'ann_pending', type: 'clarity', comment: 'Pending draft.', anchor: { text: 'Edited' } },
          payload: documentPayload('Initial copy', {
            version: 2,
            annotations: [{ id: 'ann_pending', type: 'clarity', comment: 'Pending draft.', anchor: { text: 'Edited' } }]
          })
        })
      )
      await annotationSave.promise
      await Promise.resolve()
    })
  })

  it('treats malformed annotation responses as failures without closing the composer', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/annotations' && options?.method === 'POST') {
          return jsonResponse({ ok: true, annotation: { id: 'ann_bad' } })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), 'Malformed draft.')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(await screen.findByText('Annotation could not be saved.')).toBeInTheDocument()
    expect(screen.getByLabelText('Annotation comment')).toHaveValue('Malformed draft.')
    expect(screen.queryByText('ann_bad')).not.toBeInTheDocument()
  })

  it('keeps an existing document save error visible after annotation success', async () => {
    const user = userEvent.setup()
    const createdAnnotation = {
      id: 'ann_after_save_error',
      type: 'clarity',
      comment: 'Annotation after save error.',
      anchor: { text: 'Edited' },
      status: 'anchored'
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/document' && options?.method === 'PUT') {
          throw new Error('save failed')
        }
        if (url === '/api/annotations' && options?.method === 'POST') {
          return jsonResponse({
            ok: true,
            annotation: createdAnnotation,
            payload: documentPayload('Initial copy', {
              version: 2,
              annotations: [createdAnnotation]
            })
          })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })
    expect(screen.getByRole('status')).toHaveTextContent('Document changes could not be saved.')
    vi.useRealTimers()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), 'Annotation after save error.')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(await screen.findByText('Annotation after save error.')).toBeInTheDocument()
    expect(screen.getByText('Document changes could not be saved.')).toBeInTheDocument()
  })

  it('ignores an older annotation failure after a later selection succeeds', async () => {
    const user = userEvent.setup()
    const olderFailure = createDeferred()
    const laterAnnotation = {
      id: 'ann_later',
      type: 'clarity',
      comment: 'Later success.',
      anchor: { text: 'Later' },
      status: 'anchored'
    }
    const annotationRequests = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/annotations' && options?.method === 'POST') {
          annotationRequests.push(JSON.parse(options.body))
          if (annotationRequests.length === 1) return olderFailure.promise
          return jsonResponse({
            ok: true,
            annotation: laterAnnotation,
            payload: documentPayload('Initial copy', {
              version: 2,
              annotations: [laterAnnotation]
            })
          })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), 'Older failure.')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))
    expect(screen.getByRole('button', { name: 'Save annotation' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Mock alternate selection change' }))
    await user.clear(screen.getByLabelText('Annotation comment'))
    await user.type(screen.getByLabelText('Annotation comment'), 'Later success.')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))
    expect(await screen.findByText('Later success.')).toBeInTheDocument()

    await act(async () => {
      olderFailure.reject(new Error('older failure'))
      await Promise.resolve()
    })

    expect(annotationRequests).toHaveLength(2)
    expect(screen.queryByText('Annotation could not be saved.')).not.toBeInTheDocument()
    expect(screen.getByText('Later success.')).toBeInTheDocument()
  })

  it('keeps a created annotation visible when an older autosave response arrives later', async () => {
    const user = userEvent.setup()
    const firstSave = createDeferred()
    const createdAnnotation = {
      id: 'ann_preserved',
      type: 'clarity',
      comment: 'Preserve this annotation.',
      anchor: { text: 'Edited' },
      status: 'anchored'
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url === '/api/document' && options?.method === 'PUT') {
          return firstSave.promise
        }
        if (url === '/api/annotations' && options?.method === 'POST') {
          return jsonResponse({
            ok: true,
            annotation: createdAnnotation,
            payload: documentPayload('Edited copy', {
              version: 2,
              annotations: [createdAnnotation]
            })
          })
        }
        return jsonResponse({ payload: documentPayload('Initial copy') })
      })
    )

    render(<App />)
    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Mock editor change' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })
    vi.useRealTimers()

    await user.click(screen.getByRole('button', { name: 'Mock selection change' }))
    await user.click(screen.getByRole('button', { name: 'Annotate' }))
    await user.type(screen.getByLabelText('Annotation comment'), 'Preserve this annotation.')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))
    expect(await screen.findByText('Preserve this annotation.')).toBeInTheDocument()
    expect(screen.getByText('Annotations 1')).toBeInTheDocument()

    await act(async () => {
      firstSave.resolve(
        jsonResponse({
          payload: documentPayload('Edited copy', {
            version: 3,
            annotations: []
          })
        })
      )
      await firstSave.promise
      await Promise.resolve()
    })

    expect(screen.getByText('Preserve this annotation.')).toBeInTheDocument()
    expect(screen.getByText('Edited')).toBeInTheDocument()
    expect(screen.getByText('Annotations 1')).toBeInTheDocument()
  })
})

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createFakeEventSource(instances) {
  return class FakeEventSource {
    constructor(url) {
      this.url = url
      this.listeners = new Map()
      this.close = vi.fn()
      instances.push(this)
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener)
    }

    emit(type, payload) {
      this.listeners.get(type)?.({ data: JSON.stringify(payload) })
    }
  }
}

function documentPayload(text, overrides = {}) {
  return {
    version: 1,
    metadata: { title: text, author: 'PaperSmith', style: 'APA 7th' },
    document: paragraphDocument(text),
    annotations: [],
    updatedAt: '2026-06-28T00:00:00.000Z',
    ...overrides
  }
}

function versionedDocumentPayload() {
  return {
    version: 1,
    metadata: { title: 'Drafts', author: 'PaperSmith', style: 'APA 7th' },
    document: paragraphDocument('Draft A text'),
    annotations: [{ id: 'ann_a', comment: 'Comment for A', anchor: { text: 'Draft A' } }],
    overallComment: 'Overall A',
    activeVersionId: 'draft-a',
    versions: [
      {
        id: 'draft-a',
        label: 'Draft A',
        source: 'codex',
        createdAt: '2026-06-28T00:00:00.000Z',
        updatedAt: '2026-06-28T00:00:00.000Z',
        document: paragraphDocument('Draft A text'),
        annotations: [{ id: 'ann_a', comment: 'Comment for A', anchor: { text: 'Draft A' } }],
        overallComment: 'Overall A'
      },
      {
        id: 'draft-b',
        label: 'Draft B',
        source: 'codex',
        createdAt: '2026-06-28T00:01:00.000Z',
        updatedAt: '2026-06-28T00:01:00.000Z',
        document: paragraphDocument('Draft B text'),
        annotations: [{ id: 'ann_b', comment: 'Comment for B', anchor: { text: 'Draft B' } }],
        overallComment: 'Overall B'
      }
    ],
    updatedAt: '2026-06-28T00:00:00.000Z'
  }
}

function paragraphDocument(text) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

function extractText(node) {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.content)) return ''
  return node.content.map(extractText).join('')
}

function jsonResponse(payload) {
  return {
    ok: true,
    text: async () => JSON.stringify(payload)
  }
}
