import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiHandlers, papersmithApiPlugin } from '../../server/papersmithApiPlugin.js'

let tempDir

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'papersmith-api-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('PaperSmith API handlers', () => {
  it('loads a starter document when no state file exists', async () => {
    const handlers = createApiHandlers({ stateDir: tempDir })
    const result = await handlers.getDocument()

    expect(result.payload.document.type).toBe('doc')
    expect(result.payload.metadata.title).toBe('Untitled Paper')
  })

  it('saves and reloads document state', async () => {
    const handlers = createApiHandlers({ stateDir: tempDir })
    const payload = {
      version: 1,
      metadata: { title: 'Saved Draft' },
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved' }] }] },
      annotations: []
    }

    await handlers.putDocument(payload)
    const result = await handlers.getDocument()

    expect(result.payload.metadata.title).toBe('Saved Draft')
  })

  it('preserves existing annotations when a stale document save omits them', async () => {
    const handlers = createApiHandlers({ stateDir: tempDir })
    const stalePayload = {
      version: 1,
      metadata: { title: 'Original Draft' },
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original' }] }] },
      annotations: []
    }

    await handlers.putDocument(stalePayload)
    await handlers.postAnnotation({
      type: 'clarity',
      comment: 'Clarify this.',
      selection: {
        text: 'Original',
        range: { from: 0, to: 8 },
        docVersion: 1
      }
    })
    await handlers.putDocument({
      ...stalePayload,
      metadata: { title: 'Stale Save' },
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Edited' }] }] }
    })

    const result = await handlers.getDocument()

    expect(result.payload.metadata.title).toBe('Stale Save')
    expect(result.payload.document.content[0].content[0].text).toBe('Edited')
    expect(result.payload.annotations).toHaveLength(1)
    expect(result.payload.annotations[0].anchor.text).toBe('Original')
  })

  it('persists canonical selections as normalized selection state', async () => {
    const handlers = createApiHandlers({ stateDir: tempDir })

    await handlers.putSelection({
      text: 'selected evidence',
      range: { from: 12, to: 29 },
      docVersion: 3,
      ignored: 'not part of the canonical selection payload'
    })
    const result = await handlers.getSelection()

    expect(result.selection).toMatchObject({
      version: 1,
      hasSelection: true,
      text: 'selected evidence',
      range: { from: 12, to: 29 },
      docVersion: 3
    })
    expect(result.selection).not.toHaveProperty('ignored')
  })

  it('appends annotations and broadcasts document events', async () => {
    const handlers = createApiHandlers({ stateDir: tempDir })
    const chunks = []
    handlers.addEventClient({ write: (chunk) => chunks.push(chunk) })

    const result = await handlers.postAnnotation({
      type: 'clarity',
      comment: 'Define this term.',
      selection: {
        text: 'key term',
        range: { from: 4, to: 12 },
        docVersion: 1
      }
    })

    expect(result.annotation.anchor.text).toBe('key term')
    expect(result.payload.annotations).toHaveLength(1)
    expect(result.payload.annotations[0]).toBe(result.annotation)
    expect(chunks.join('')).toContain('event: document-changed\n')
  })

  it('sends SSE event lines on document save', async () => {
    const handlers = createApiHandlers({ stateDir: tempDir })
    const chunks = []
    handlers.addEventClient({ write: (chunk) => chunks.push(chunk) })

    await handlers.putDocument({
      version: 1,
      metadata: { title: 'Broadcast Draft' },
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Broadcast' }] }] },
      annotations: []
    })

    const output = chunks.join('')
    expect(output).toContain('event: document-changed\n')
    expect(output).toContain('"type":"document-changed"')
    expect(output).toContain('\n\n')
  })

  it('exposes broadcast and writes SSE lines to event clients', () => {
    const handlers = createApiHandlers({ stateDir: tempDir })
    const chunks = []
    handlers.addEventClient({ write: (chunk) => chunks.push(chunk) })

    expect(typeof handlers.broadcast).toBe('function')

    handlers.broadcast({ type: 'manual-event', updatedAt: '2026-06-28T00:00:00.000Z' })

    expect(chunks.join('')).toBe(
      'event: manual-event\n' +
        'data: {"type":"manual-event","updatedAt":"2026-06-28T00:00:00.000Z"}\n\n'
    )
  })
})

describe('PaperSmith API middleware', () => {
  it('returns a starter document as JSON', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })
    const { res } = await callApi(middleware, { method: 'GET', url: '/api/document' })

    expect(res.statusCode).toBe(200)
    expect(res.getHeader('content-type')).toContain('application/json')
    expect(res.json().payload.metadata.title).toBe('Untitled Paper')
  })

  it('returns JSON 404 for unknown API routes', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })
    const { res, nextCalled } = await callApi(middleware, { method: 'GET', url: '/api/unknown' })

    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(404)
    expect(res.getHeader('content-type')).toContain('application/json')
    expect(res.json()).toEqual({ error: 'API route not found.' })
  })

  it('returns 405 and Allow for wrong document methods', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })
    const { res } = await callApi(middleware, { method: 'POST', url: '/api/document' })

    expect(res.statusCode).toBe(405)
    expect(res.getHeader('allow')).toBe('GET, PUT')
  })

  it('returns 400 for malformed JSON', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })
    const { res } = await callApi(middleware, {
      method: 'PUT',
      url: '/api/document',
      chunks: [Buffer.from('{', 'utf8')]
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid document shapes', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })
    const { res } = await callApi(middleware, {
      method: 'PUT',
      url: '/api/document',
      chunks: [jsonChunk({ document: null })]
    })

    expect(res.statusCode).toBe(400)
  })

  it('preserves split UTF-8 characters in JSON request bodies', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })
    const payload = {
      version: 1,
      metadata: { title: 'Split 雪 Draft' },
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '你好' }] }] },
      annotations: []
    }
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    const splitAt = body.indexOf(Buffer.from('雪', 'utf8')) + 1
    const { res } = await callApi(middleware, {
      method: 'PUT',
      url: '/api/document',
      chunks: [body.subarray(0, splitAt), body.subarray(splitAt)]
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().payload.metadata.title).toBe('Split 雪 Draft')
  })

  it('returns 413 when request bodies exceed 5MB', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })
    const { res } = await callApi(middleware, {
      method: 'PUT',
      url: '/api/document',
      chunks: [Buffer.alloc(5 * 1024 * 1024 + 1, 'x')]
    })

    expect(res.statusCode).toBe(413)
  })

  it('starts document event streams with SSE headers and a connected comment', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })
    const { req, res } = await callApi(middleware, { method: 'GET', url: '/api/document-events' })

    expect(res.statusCode).toBe(200)
    expect(res.getHeader('content-type')).toBe('text/event-stream')
    expect(res.flushed).toBe(true)
    expect(res.text()).toBe(': connected\n\n')

    req.emit('close')
  })

  for (const cleanupEvent of [
    { label: 'request close', target: 'req', event: 'close' },
    { label: 'request error', target: 'req', event: 'error' },
    { label: 'response close', target: 'res', event: 'close' },
    { label: 'response error', target: 'res', event: 'error' }
  ]) {
    it(`removes document event clients on ${cleanupEvent.label}`, async () => {
      const middleware = createApiMiddleware({ stateDir: tempDir })
      const { req, res } = await callApi(middleware, { method: 'GET', url: '/api/document-events' })

      expect(res.text()).toBe(': connected\n\n')

      const emitter = cleanupEvent.target === 'req' ? req : res
      if (cleanupEvent.event === 'error') {
        emitter.emit(cleanupEvent.event, new Error('broken'))
      } else {
        emitter.emit(cleanupEvent.event)
      }

      await callApi(middleware, {
        method: 'PUT',
        url: '/api/document',
        chunks: [
          jsonChunk({
            version: 1,
            metadata: { title: `After ${cleanupEvent.label}` },
            document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved' }] }] },
            annotations: []
          })
        ]
      })

      expect(res.text()).toBe(': connected\n\n')
    })
  }
})

function createApiMiddleware(options) {
  let middleware
  papersmithApiPlugin(options).configureServer({
    middlewares: {
      use(handler) {
        middleware = handler
      }
    }
  })
  return middleware
}

async function callApi(middleware, { method, url, chunks = [] }) {
  const req = Readable.from(chunks)
  req.method = method
  req.url = url

  const res = new MockResponse()
  let nextCalled = false

  await middleware(req, res, () => {
    nextCalled = true
  })

  return { req, res, nextCalled }
}

function jsonChunk(value) {
  return Buffer.from(JSON.stringify(value), 'utf8')
}

class MockResponse extends EventEmitter {
  constructor() {
    super()
    this.statusCode = 200
    this.headers = new Map()
    this.chunks = []
    this.ended = false
    this.flushed = false
  }

  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value)
  }

  getHeader(name) {
    return this.headers.get(name.toLowerCase())
  }

  flushHeaders() {
    this.flushed = true
  }

  write(chunk) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8'))
    return true
  }

  end(chunk) {
    if (chunk) this.write(chunk)
    this.ended = true
    this.emit('finish')
  }

  text() {
    return Buffer.concat(this.chunks).toString('utf8')
  }

  json() {
    return JSON.parse(this.text())
  }
}
