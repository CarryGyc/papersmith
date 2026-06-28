import { EventEmitter } from 'node:events'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as documentModel from '../../server/documentModel.js'
import { createApiHandlers, papersmithApiPlugin } from '../../server/papersmithApiPlugin.js'

let tempDir

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'papersmith-insert-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('insertTextAsVersion', () => {
  it('creates trimmed text as a new active Codex draft and preserves previous version state', () => {
    const now = new Date('2026-06-28T10:30:00.000Z')
    const payload = documentModel.createStarterDocument(new Date('2026-06-28T00:00:00.000Z'))
    payload.metadata.journal = 'Journal of PaperSmith'
    payload.annotations = [{ id: 'note-1', comment: 'Keep this annotation.' }]

    const next = documentModel.insertTextAsVersion(payload, '  Codex drafted paragraph.  ', now)

    expect(next.metadata).toEqual({
      title: 'Codex 1',
      author: 'PaperSmith',
      style: 'APA 7th',
      journal: 'Journal of PaperSmith'
    })
    expect(next.activeVersionId).toBe('codex-1782642600000-1')
    expect(next.annotations).toEqual([])
    expect(next.updatedAt).toBe('2026-06-28T10:30:00.000Z')
    expect(next.versions).toHaveLength(2)
    expect(next.versions[0]).toMatchObject({
      id: 'welcome',
      annotations: [{ id: 'note-1', comment: 'Keep this annotation.' }]
    })
    expect(next.versions[1]).toMatchObject({
      id: 'codex-1782642600000-1',
      label: 'Codex 1',
      source: 'codex',
      annotations: []
    })
    expect(next.document.content).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Codex drafted paragraph.' }]
      }
    ])
  })

  it('rejects blank inserted text', () => {
    const payload = documentModel.createStarterDocument()

    expect(() => documentModel.insertTextAsVersion(payload, ' \n\t ')).toThrow('Text is required.')
  })
})

describe('insert text API handlers', () => {
  it('syncs text as a new draft version, persists it, and broadcasts a document change', async () => {
    const handlers = createApiHandlers({ stateDir: tempDir })
    const chunks = []
    handlers.addEventClient({ write: (chunk) => chunks.push(chunk) })

    const result = await handlers.insertText({ text: 'Codex drafted paragraph.' })
    const reloaded = await handlers.getDocument()

    expect(result.ok).toBe(true)
    expect(result.payload.activeVersionId).toBe(result.payload.versions.at(-1).id)
    expect(result.payload.versions.map((version) => version.label)).toEqual(['Welcome', 'Codex 1'])
    expect(result.payload.document.content[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Codex drafted paragraph.' }]
    })
    expect(reloaded.payload.activeVersionId).toBe(result.payload.activeVersionId)
    expect(reloaded.payload.document.content[0]).toEqual(result.payload.document.content[0])
    expect(chunks.join('')).toContain('event: document-changed\n')
  })

  it('serializes concurrent inserts so every Codex draft version is preserved', async () => {
    const handlers = createApiHandlers({ stateDir: tempDir })
    const texts = Array.from({ length: 12 }, (_, index) => `Concurrent paragraph ${index + 1}.`)

    await Promise.all(texts.map((text) => handlers.insertText({ text })))
    const result = await handlers.getDocument()
    const versionTexts = result.payload.versions
      .filter((version) => version.source === 'codex')
      .map((version) => version.document.content[0]?.content?.[0]?.text)

    expect(versionTexts).toEqual(expect.arrayContaining(texts))
    expect(new Set(versionTexts).size).toBe(versionTexts.length)
  })

  it('continues processing document mutations after a rejected insert', async () => {
    const handlers = createApiHandlers({ stateDir: tempDir })

    await expect(handlers.insertText({ text: '   ' })).rejects.toThrow('Text is required.')
    const result = await handlers.insertText({ text: 'Recovered after rejection.' })

    expect(result.payload.document.content[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Recovered after rejection.' }]
    })
  })
})

describe('insert text HTTP route', () => {
  it('accepts POST /api/insert-text and returns the updated document payload', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })

    const { res } = await callApi(middleware, {
      method: 'POST',
      url: '/api/insert-text',
      chunks: [jsonChunk({ text: 'Codex drafted paragraph.' })]
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(res.json().payload.versions.map((version) => version.label)).toEqual(['Welcome', 'Codex 1'])
    expect(res.json().payload.document.content[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Codex drafted paragraph.' }]
    })
  })

  it('returns 400 JSON when POST /api/insert-text receives blank text', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })

    const { res } = await callApi(middleware, {
      method: 'POST',
      url: '/api/insert-text',
      chunks: [jsonChunk({ text: '   ' })]
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Text is required.' })
  })

  it('returns 400 JSON when POST /api/insert-text receives an empty body', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })

    const { res } = await callApi(middleware, {
      method: 'POST',
      url: '/api/insert-text'
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Text is required.' })
  })

  it('returns 400 JSON when POST /api/insert-text receives non-string text', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })

    const { res } = await callApi(middleware, {
      method: 'POST',
      url: '/api/insert-text',
      chunks: [jsonChunk({ text: 42 })]
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Text is required.' })
  })

  it('returns 405 for non-POST /api/insert-text requests', async () => {
    const middleware = createApiMiddleware({ stateDir: tempDir })

    const { res } = await callApi(middleware, { method: 'GET', url: '/api/insert-text' })

    expect(res.statusCode).toBe(405)
    expect(res.getHeader('allow')).toBe('POST')
    expect(res.json()).toEqual({ error: 'Method not allowed.' })
  })
})

describe('PaperSmith MCP stdio server', () => {
  it('handles initialize, ping, tools/list, tools/call success, and unknown methods', async () => {
    const requests = []
    const fakeApi = await startFakePapersmithApi(requests)
    const mcp = await startMcpServer({ args: ['--papersmithUrl', fakeApi.url] })

    try {
      const initialize = await mcp.rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
      const ping = await mcp.rpc({ jsonrpc: '2.0', id: 2, method: 'ping', params: {} })
      const tools = await mcp.rpc({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} })
      const insert = await mcp.rpc({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'insert_papersmith_text',
          arguments: { text: 'Codex drafted paragraph.' }
        }
      })
      const selection = await mcp.rpc({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'get_papersmith_selection', arguments: {} }
      })
      const unknown = await mcp.rpc({ jsonrpc: '2.0', id: 6, method: 'unknown/method', params: {} })

      expect(initialize.result.serverInfo.name).toBe('papersmith')
      expect(ping.result).toEqual({})
      expect(tools.result.tools.map((tool) => tool.name)).toEqual([
        'insert_papersmith_text',
        'get_papersmith_selection'
      ])
      expect(insert.result.isError).toBe(false)
      expect(insert.result.content[0].text).toContain('Synced text into PaperSmith as a new draft version.')
      expect(readJsonToolContent(insert.result)).toEqual({ ok: true, payload: { updatedAt: 'fake-now' } })
      expect(insert.result.structuredContent).toEqual({ ok: true, payload: { updatedAt: 'fake-now' } })
      expect(selection.result.isError).toBe(false)
      expect(selection.result.content[0].text).toContain('selected passage')
      expect(readJsonToolContent(selection.result)).toEqual({
        selection: { hasSelection: true, text: 'selected passage' }
      })
      expect(selection.result.structuredContent).toEqual({
        selection: { hasSelection: true, text: 'selected passage' }
      })
      expect(unknown.error).toMatchObject({ code: -32601 })
      expect(requests).toEqual([
        { method: 'POST', path: '/api/insert-text', body: { text: 'Codex drafted paragraph.' } },
        { method: 'GET', path: '/api/selection', body: null }
      ])
    } finally {
      await mcp.close()
      await fakeApi.close()
    }
  })

  it('uses PAPERSMITH_URL from the environment', async () => {
    const requests = []
    const fakeApi = await startFakePapersmithApi(requests)
    const mcp = await startMcpServer({ env: { PAPERSMITH_URL: fakeApi.url } })

    try {
      const selection = await mcp.rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_papersmith_selection', arguments: {} }
      })

      expect(selection.result.structuredContent.selection.text).toBe('selected passage')
      expect(requests).toEqual([{ method: 'GET', path: '/api/selection', body: null }])
    } finally {
      await mcp.close()
      await fakeApi.close()
    }
  })

  it('prefers the --papersmith-url argument over PAPERSMITH_URL', async () => {
    const requests = []
    const fakeApi = await startFakePapersmithApi(requests)
    const mcp = await startMcpServer({
      args: ['--papersmith-url', fakeApi.url],
      env: { PAPERSMITH_URL: 'http://127.0.0.1:1' }
    })

    try {
      const selection = await mcp.rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_papersmith_selection', arguments: {} }
      })

      expect(selection.result.structuredContent.selection.text).toBe('selected passage')
      expect(requests).toEqual([{ method: 'GET', path: '/api/selection', body: null }])
    } finally {
      await mcp.close()
      await fakeApi.close()
    }
  })

  it('resolves URL configuration from args, env, and the default', async () => {
    const { resolvePapersmithUrl } = await import('../../mcp/server.mjs')

    expect(resolvePapersmithUrl([], {})).toBe('http://127.0.0.1:43227')
    expect(resolvePapersmithUrl([], { PAPERSMITH_URL: 'http://127.0.0.1:4444/' })).toBe('http://127.0.0.1:4444')
    expect(
      resolvePapersmithUrl(['--papersmith-url', 'http://127.0.0.1:5555/'], {
        PAPERSMITH_URL: 'http://127.0.0.1:4444'
      })
    ).toBe('http://127.0.0.1:5555')
  })

  it('returns PaperSmith API 400 responses as tool error results', async () => {
    const requests = []
    const fakeApi = await startFakePapersmithApi(requests, {
      insertStatus: 400,
      insertBody: { error: 'Text is required.' }
    })
    const mcp = await startMcpServer({ args: ['--papersmith-url', fakeApi.url] })

    try {
      const insert = await mcp.rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'insert_papersmith_text', arguments: { text: '' } }
      })

      expect(insert).not.toHaveProperty('error')
      expect(insert.result.isError).toBe(true)
      expect(insert.result.content[0].text).toContain('Text is required.')
      expect(readJsonToolContent(insert.result)).toMatchObject({
        message: 'Text is required.',
        status: 400,
        url: `${fakeApi.url}/api/insert-text`,
        toolName: 'insert_papersmith_text'
      })
      expect(insert.result.structuredContent).toMatchObject({
        message: 'Text is required.',
        status: 400,
        url: `${fakeApi.url}/api/insert-text`,
        toolName: 'insert_papersmith_text'
      })
    } finally {
      await mcp.close()
      await fakeApi.close()
    }
  })

  it('returns server-unreachable failures as tool error results', async () => {
    const mcp = await startMcpServer({ args: ['--papersmith-url', 'http://127.0.0.1:1'] })

    try {
      const selection = await mcp.rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_papersmith_selection', arguments: {} }
      })

      expect(selection).not.toHaveProperty('error')
      expect(selection.result.isError).toBe(true)
      expect(selection.result.content[0].text).toContain('Could not reach PaperSmith')
      expect(selection.result.structuredContent).toMatchObject({
        url: 'http://127.0.0.1:1/api/selection',
        toolName: 'get_papersmith_selection'
      })
      expect(selection.result.structuredContent.message).toContain('Could not reach PaperSmith')
    } finally {
      await mcp.close()
    }
  })

  it('returns invalid PaperSmith JSON as a tool error result', async () => {
    const requests = []
    const fakeApi = await startFakePapersmithApi(requests, {
      selectionRawBody: 'not json'
    })
    const mcp = await startMcpServer({ args: ['--papersmith-url', fakeApi.url] })

    try {
      const selection = await mcp.rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_papersmith_selection', arguments: {} }
      })

      expect(selection).not.toHaveProperty('error')
      expect(selection.result.isError).toBe(true)
      expect(selection.result.structuredContent).toMatchObject({
        message: 'PaperSmith returned invalid JSON.',
        status: 200,
        url: `${fakeApi.url}/api/selection`,
        toolName: 'get_papersmith_selection'
      })
    } finally {
      await mcp.close()
      await fakeApi.close()
    }
  })
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
  }

  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value)
  }

  getHeader(name) {
    return this.headers.get(name.toLowerCase())
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

async function startFakePapersmithApi(requests, options = {}) {
  const server = createServer(async (req, res) => {
    const body = await readRequestBody(req)
    const path = new URL(req.url || '/', 'http://127.0.0.1').pathname
    requests.push({ method: req.method, path, body: body ? JSON.parse(body) : null })

    if (req.method === 'POST' && path === '/api/insert-text') {
      res.writeHead(options.insertStatus ?? 200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(options.insertBody ?? { ok: true, payload: { updatedAt: 'fake-now' } }))
      return
    }

    if (req.method === 'GET' && path === '/api/selection') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      if (options.selectionRawBody !== undefined) {
        res.end(options.selectionRawBody)
        return
      }
      res.end(JSON.stringify({ selection: { hasSelection: true, text: 'selected passage' } }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function startMcpServer({ args = [], env = {} } = {}) {
  const childEnv = { ...process.env, ...env }
  for (const [key, value] of Object.entries(childEnv)) {
    if (value === undefined) delete childEnv[key]
  }
  const child = spawn(process.execPath, ['mcp/server.mjs', ...args], {
    cwd: process.cwd(),
    env: childEnv,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  return {
    rpc: createLineRpc(child),
    close: () => closeChild(child)
  }
}

function createLineRpc(child) {
  const pending = []
  let stdout = ''
  let stderr = ''
  let exited = false

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8')
    let newlineIndex
    while ((newlineIndex = stdout.indexOf('\n')) >= 0) {
      const line = stdout.slice(0, newlineIndex).trim()
      stdout = stdout.slice(newlineIndex + 1)
      if (!line) continue
      const next = pending.shift()
      if (next) {
        clearTimeout(next.timer)
        try {
          next.resolve(JSON.parse(line))
        } catch (error) {
          next.reject(error)
        }
      }
    }
  })

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8')
  })

  child.on('error', (error) => {
    rejectPending(error)
  })

  child.on('exit', (code) => {
    exited = true
    if (pending.length) {
      rejectPending(new Error(`MCP server exited with code ${code}: ${stderr}`))
    }
  })

  return (message) =>
    new Promise((resolve, reject) => {
      if (exited) {
        reject(new Error(`MCP server already exited: ${stderr}`))
        return
      }
      const pendingEntry = { resolve, reject, timer: null }
      pendingEntry.timer = setTimeout(() => {
        const index = pending.findIndex((entry) => entry.resolve === resolve)
        if (index >= 0) {
          pending.splice(index, 1)
          reject(new Error(`Timed out waiting for MCP response: ${stderr}`))
        }
      }, 5000)
      pending.push(pendingEntry)
      child.stdin.write(`${JSON.stringify(message)}\n`, (error) => {
        if (!error) return
        const index = pending.indexOf(pendingEntry)
        if (index >= 0) pending.splice(index, 1)
        clearTimeout(pendingEntry.timer)
        reject(error)
      })
    })

  function rejectPending(error) {
    while (pending.length) {
      const next = pending.shift()
      clearTimeout(next.timer)
      next.reject(error)
    }
  }
}

async function closeChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return

  const exited = new Promise((resolve) => child.once('exit', resolve))

  child.stdin.end()
  const gracefulExit = await Promise.race([exited.then(() => true), delay(250).then(() => false)])
  if (gracefulExit) return

  child.kill()
  const killed = await Promise.race([exited.then(() => true), delay(2000).then(() => false)])
  if (!killed) {
    throw new Error('Timed out waiting for MCP child process to exit.')
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readJsonToolContent(result) {
  const jsonBlock = result.content.find((part) => part.type === 'text' && part.text.trim().startsWith('{'))
  expect(jsonBlock).toBeTruthy()
  return JSON.parse(jsonBlock.text)
}
