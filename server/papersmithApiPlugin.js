import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createAnnotation } from './annotationModel.js'
import { createStarterDocument, insertTextAsVersion, normalizeDocumentPayload } from './documentModel.js'
import { readJsonFile, writeJsonAtomic } from './jsonFiles.js'
import { normalizeSelectionState } from './selectionModel.js'

const BODY_LIMIT_BYTES = 5 * 1024 * 1024

export function createApiHandlers(options) {
  const { stateDir } = options
  const documentFile = join(stateDir, 'document.json')
  const selectionFile = join(stateDir, 'selection.json')
  const exportDir = join(stateDir, 'exports')
  const copyFileToClipboard = options.copyFileToClipboard ?? copyFileToSystemClipboard
  const eventClients = new Set()
  let documentMutationQueue = Promise.resolve()

  async function getDocument() {
    const raw = await readJsonFile(documentFile, { fallback: createStarterDocument() })
    const payload = normalizeDocumentPayload(raw)
    return { payload, path: documentFile }
  }

  async function putDocument(payload) {
    const incoming = normalizeDocumentPayload(payload)

    return mutateDocument(async () => {
      const updatedAt = new Date().toISOString()
      const current = await readStoredDocument()
      const shouldMergeAnnotations = shouldMergeCurrentAnnotations(current, incoming)
      const next = {
        ...incoming,
        annotations: shouldMergeAnnotations ? mergeAnnotations(current?.annotations ?? [], incoming.annotations) : incoming.annotations,
        updatedAt
      }
      const normalizedNext = normalizeDocumentPayload(next)

      await writeJsonAtomic(documentFile, normalizedNext)
      broadcast({ type: 'document-changed', updatedAt })

      return { ok: true, path: documentFile, payload: normalizedNext }
    })
  }

  async function getSelection() {
    const raw = await readJsonFile(selectionFile, { fallback: normalizeSelectionState() })
    const selection = normalizeSelectionState(raw)
    return { selection, path: selectionFile }
  }

  async function putSelection(payload) {
    const canonicalPayload = {
      text: payload?.text,
      range: payload?.range,
      docVersion: payload?.docVersion
    }
    const selection = normalizeSelectionState(canonicalPayload)

    await writeJsonAtomic(selectionFile, selection)

    return { ok: true, path: selectionFile, selection }
  }

  async function postAnnotation(payload) {
    const annotation = createAnnotation(payload)

    return mutateDocument(async () => {
      const current = await getDocument()
      const updatedAt = new Date().toISOString()
      const next = normalizeDocumentPayload({
        ...current.payload,
        annotations: [...current.payload.annotations, annotation],
        updatedAt
      })

      await writeJsonAtomic(documentFile, next)
      broadcast({ type: 'document-changed', updatedAt })

      return { ok: true, annotation, payload: next }
    })
  }

  async function insertText(payload) {
    return mutateDocument(async () => {
      const current = await getDocument()
      const now = new Date()
      const next = insertTextAsVersion(current.payload, payload?.text, now)

      await writeJsonAtomic(documentFile, next)
      broadcast({ type: 'document-changed', updatedAt: next.updatedAt })

      return { ok: true, payload: next }
    })
  }

  async function exportFeedbackFile(payload) {
    const markdown = typeof payload?.markdown === 'string' ? payload.markdown : ''
    if (!markdown.trim()) {
      const error = new Error('Feedback markdown is required.')
      error.statusCode = 400
      throw error
    }

    await mkdir(exportDir, { recursive: true })
    const fileName = 'papersmith-feedback.md'
    const filePath = join(exportDir, fileName)
    await writeFile(filePath, markdown, 'utf8')
    const copiedToClipboard = await copyFileToClipboard(filePath)

    return { ok: true, path: filePath, fileName, copiedToClipboard }
  }

  function addEventClient(res) {
    eventClients.add(res)
    return () => eventClients.delete(res)
  }

  function broadcast(event) {
    const message = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`

    for (const client of eventClients) {
      try {
        client.write(message)
      } catch {
        eventClients.delete(client)
      }
    }
  }

  async function readStoredDocument() {
    const raw = await readJsonFile(documentFile, { fallback: null })
    return raw ? normalizeDocumentPayload(raw) : null
  }

  function mutateDocument(operation) {
    const nextMutation = documentMutationQueue.then(operation, operation)
    documentMutationQueue = nextMutation.catch(() => {})
    return nextMutation
  }

  return {
    getDocument,
    putDocument,
    getSelection,
    putSelection,
    postAnnotation,
    insertText,
    exportFeedbackFile,
    addEventClient,
    broadcast
  }
}

export function papersmithApiPlugin(options = {}) {
  const stateDir = options.stateDir || process.env.PAPERSMITH_STATE_DIR || join(process.cwd(), 'papersmith')
  const handlers = createApiHandlers({ stateDir, copyFileToClipboard: options.copyFileToClipboard })

  return {
    name: 'papersmith-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req)

        if (!pathname.startsWith('/api/')) {
          next()
          return
        }

        try {
          if (pathname === '/api/document-events') {
            await handleDocumentEvents(req, res, handlers)
            return
          }

          if (pathname === '/api/document') {
            await handleDocument(req, res, handlers)
            return
          }

          if (pathname === '/api/selection') {
            await handleSelection(req, res, handlers)
            return
          }

          if (pathname === '/api/annotations') {
            await handleAnnotations(req, res, handlers)
            return
          }

          if (pathname === '/api/insert-text') {
            await handleInsertText(req, res, handlers)
            return
          }

          if (pathname === '/api/feedback-file') {
            await handleFeedbackFile(req, res, handlers)
            return
          }

          sendJson(res, 404, { error: 'API route not found.' })
        } catch (error) {
          const status = error.statusCode || 500
          sendJson(res, status, { error: error.message || 'PaperSmith API error.' })
        }
      })
    }
  }
}

async function handleDocumentEvents(req, res, handlers) {
  if (req.method !== 'GET') {
    sendMethodNotAllowed(res, ['GET'])
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  res.write(': connected\n\n')

  const cleanup = handlers.addEventClient(res)
  req.on('close', cleanup)
  req.on('error', cleanup)
  res.on?.('close', cleanup)
  res.on?.('error', cleanup)
}

async function handleDocument(req, res, handlers) {
  if (req.method === 'GET') {
    sendJson(res, 200, await handlers.getDocument())
    return
  }

  if (req.method === 'PUT') {
    const payload = await readBodyJson(req)

    try {
      sendJson(res, 200, await handlers.putDocument(payload))
    } catch (error) {
      if (!isDocumentValidationError(error)) throw error
      sendJson(res, 400, { error: error.message })
    }
    return
  }

  sendMethodNotAllowed(res, ['GET', 'PUT'])
}

async function handleSelection(req, res, handlers) {
  if (req.method === 'GET') {
    sendJson(res, 200, await handlers.getSelection())
    return
  }

  if (req.method === 'PUT') {
    sendJson(res, 200, await handlers.putSelection(await readBodyJson(req)))
    return
  }

  sendMethodNotAllowed(res, ['GET', 'PUT'])
}

async function handleAnnotations(req, res, handlers) {
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res, ['POST'])
    return
  }

  const payload = await readBodyJson(req)

  try {
    sendJson(res, 200, await handlers.postAnnotation(payload))
  } catch (error) {
    if (!isAnnotationValidationError(error)) throw error
    sendJson(res, 400, { error: error.message || 'Invalid annotation.' })
  }
}

async function handleInsertText(req, res, handlers) {
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res, ['POST'])
    return
  }

  const payload = await readBodyJson(req)

  try {
    sendJson(res, 200, await handlers.insertText(payload))
  } catch (error) {
    if (!isInsertTextValidationError(error)) throw error
    sendJson(res, 400, { error: error.message })
  }
}

async function handleFeedbackFile(req, res, handlers) {
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res, ['POST'])
    return
  }

  sendJson(res, 200, await handlers.exportFeedbackFile(await readBodyJson(req)))
}

async function copyFileToSystemClipboard(filePath) {
  if (process.platform !== 'win32') {
    const error = new Error('Copying a feedback file to the clipboard is only supported on Windows.')
    error.statusCode = 501
    throw error
  }

  const args = [
    '-Sta',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Set-Clipboard -LiteralPath ${quotePowerShellString(filePath)}`
  ]
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await runPowerShell(args)
      return true
    } catch (error) {
      lastError = error
      await delay(100 * (attempt + 1))
    }
  }

  throw lastError
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function quotePowerShellString(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function runPowerShell(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    })
    const stderr = []

    child.stderr.on('data', (chunk) => {
      stderr.push(Buffer.from(chunk))
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`File clipboard copy failed: ${Buffer.concat(stderr).toString('utf8') || `exit ${code}`}`))
    })
  })
}

async function readBodyJson(req) {
  const chunks = []
  let totalBytes = 0

  for await (const chunk of req) {
    const buffer = toBuffer(chunk)
    totalBytes += buffer.byteLength
    if (totalBytes > BODY_LIMIT_BYTES) {
      const error = new Error('Request body exceeds 5MB limit.')
      error.statusCode = 413
      throw error
    }
    chunks.push(buffer)
  }

  const body = Buffer.concat(chunks, totalBytes).toString('utf8')

  if (!body.trim()) return {}

  try {
    return JSON.parse(body)
  } catch {
    const error = new Error('Request body must be valid JSON.')
    error.statusCode = 400
    throw error
  }
}

function getPathname(req) {
  return new URL(req.url || '/', 'http://localhost').pathname
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(`${JSON.stringify(payload)}\n`)
}

function sendMethodNotAllowed(res, methods) {
  res.setHeader('Allow', methods.join(', '))
  sendJson(res, 405, { error: 'Method not allowed.' })
}

function toBuffer(chunk) {
  if (Buffer.isBuffer(chunk)) return chunk
  if (typeof chunk === 'string') return Buffer.from(chunk, 'utf8')
  return Buffer.from(chunk)
}

function mergeAnnotations(existingAnnotations, incomingAnnotations) {
  const merged = []
  const seenIds = new Set()

  for (const annotation of incomingAnnotations) addAnnotation(annotation)
  for (const annotation of existingAnnotations) addAnnotation(annotation)

  return merged

  function addAnnotation(annotation) {
    const id = typeof annotation?.id === 'string' ? annotation.id : null
    if (id) {
      if (seenIds.has(id)) return
      seenIds.add(id)
    }
    merged.push(annotation)
  }
}

function shouldMergeCurrentAnnotations(current, incoming) {
  if (!current) return false
  const currentVersionId = typeof current.activeVersionId === 'string' ? current.activeVersionId : null
  const incomingVersionId = typeof incoming.activeVersionId === 'string' ? incoming.activeVersionId : null
  return !currentVersionId || !incomingVersionId || currentVersionId === incomingVersionId
}

function isDocumentValidationError(error) {
  return error instanceof Error && error.message.includes('Expected PaperSmith document payload')
}

function isAnnotationValidationError(error) {
  return (
    error instanceof Error &&
    ['Annotation comment is required.', 'Cannot create annotation without selected text.'].includes(error.message)
  )
}

function isInsertTextValidationError(error) {
  return error instanceof Error && error.message === 'Text is required.'
}
