#!/usr/bin/env node
import readline from 'node:readline'
import { pathToFileURL } from 'node:url'

const DEFAULT_PAPERSMITH_URL = 'http://127.0.0.1:43227'

const tools = [
  {
    name: 'insert_papersmith_text',
    description: 'Append drafted text as a paragraph in the local PaperSmith editor.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to append to the current PaperSmith document.'
        }
      },
      required: ['text'],
      additionalProperties: false
    }
  },
  {
    name: 'get_papersmith_selection',
    description: 'Read the current text selection from the local PaperSmith editor.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  }
]

if (isMainModule()) {
  startStdioServer()
}

function startStdioServer() {
  const papersmithUrl = resolvePapersmithUrl(process.argv.slice(2), process.env)
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  })

  rl.on('line', async (line) => {
    if (!line.trim()) return

    let message
    try {
      message = JSON.parse(line)
    } catch {
      writeResponse({ jsonrpc: '2.0', id: null, error: jsonRpcError(-32700, 'Parse error.') })
      return
    }

    if (!Object.prototype.hasOwnProperty.call(message, 'id')) {
      return
    }

    try {
      const result = await handleRequest(message, papersmithUrl)
      writeResponse({ jsonrpc: '2.0', id: message.id, result })
    } catch (error) {
      writeResponse({
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: error?.jsonRpcError ?? jsonRpcError(-32603, 'Internal error.')
      })
    }
  })
}

async function handleRequest(message, papersmithUrl) {
  switch (message.method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'papersmith',
          version: '0.1.0'
        }
      }
    case 'ping':
      return {}
    case 'tools/list':
      return { tools }
    case 'tools/call':
      return callTool(message.params, papersmithUrl)
    default:
      throw rpcError(-32601, 'Method not found.')
  }
}

async function callTool(params, papersmithUrl) {
  const toolName = params?.name
  const args = params?.arguments ?? {}

  if (toolName === 'insert_papersmith_text') {
    return callPaperSmithTool(papersmithUrl, toolName, '/api/insert-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: args.text })
    })
  }

  if (toolName === 'get_papersmith_selection') {
    return callPaperSmithTool(papersmithUrl, toolName, '/api/selection', { method: 'GET' })
  }

  throw rpcError(-32602, 'Unknown tool.')
}

async function callPaperSmithTool(papersmithUrl, toolName, pathname, options) {
  const url = `${papersmithUrl}${pathname}`
  let response

  try {
    response = await fetch(url, options)
  } catch {
    return toolErrorResult({
      message: `Could not reach PaperSmith at ${url}.`,
      status: null,
      url,
      toolName
    })
  }

  const text = await response.text()
  let body

  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    return toolErrorResult({
      message: 'PaperSmith returned invalid JSON.',
      status: response.status,
      url,
      toolName
    })
  }

  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : `PaperSmith request failed with ${response.status}.`
    return toolErrorResult({
      message,
      status: response.status,
      url,
      toolName
    })
  }

  return toolSuccessResult(toolName, body)
}

function toolSuccessResult(toolName, structuredContent) {
  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: successMessage(toolName, structuredContent)
      },
      {
        type: 'text',
        text: JSON.stringify(structuredContent)
      }
    ],
    structuredContent
  }
}

function toolErrorResult({ message, status, url, toolName }) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: message
      },
      {
        type: 'text',
        text: JSON.stringify({ message, status, url, toolName })
      }
    ],
    structuredContent: {
      message,
      status,
      url,
      toolName
    }
  }
}

function successMessage(toolName, structuredContent) {
  if (toolName === 'insert_papersmith_text') {
    return 'Inserted text into PaperSmith.'
  }

  const selectionText = structuredContent?.selection?.text
  if (typeof selectionText === 'string' && selectionText.trim()) {
    return `PaperSmith selection: ${selectionText}`
  }

  return 'Read the current PaperSmith selection.'
}

export function resolvePapersmithUrl(argv, env) {
  const fromArgs = readPapersmithUrlArg(argv)
  const rawUrl = fromArgs || env.PAPERSMITH_URL || DEFAULT_PAPERSMITH_URL
  return rawUrl.replace(/\/+$/, '')
}

function readPapersmithUrlArg(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--papersmithUrl' || arg === '--papersmith-url' || arg === 'papersmithUrl') {
      return argv[index + 1]
    }
    if (arg.startsWith('--papersmithUrl=')) {
      return arg.slice('--papersmithUrl='.length)
    }
    if (arg.startsWith('--papersmith-url=')) {
      return arg.slice('--papersmith-url='.length)
    }
    if (arg.startsWith('papersmithUrl=')) {
      return arg.slice('papersmithUrl='.length)
    }
  }
  return null
}

function rpcError(code, message, data) {
  const error = new Error(message)
  error.jsonRpcError = jsonRpcError(code, message, data)
  return error
}

function jsonRpcError(code, message, data) {
  return data === undefined ? { code, message } : { code, message, data }
}

function writeResponse(response) {
  process.stdout.write(`${JSON.stringify(response)}\n`)
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1] || '').href
}
