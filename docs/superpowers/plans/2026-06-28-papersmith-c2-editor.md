# PaperSmith C2 Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable PaperSmith editor: a C2-inspired local browser editor that syncs Codex text into a rich text document, supports user formatting edits, selection-based annotations, and project-local persistence.

**Architecture:** Use the Cowart pattern: Vite/React serves the browser editor, Vite middleware exposes project-local JSON APIs and SSE events, and MCP tools call those APIs or project files from Codex. TipTap/ProseMirror owns document editing and selection behavior; server modules own validation, atomic persistence, and API payloads.

**Tech Stack:** Node ESM, Vite, React, TipTap, Vitest, Testing Library, Playwright or browser verification, local JSON state, SSE, MCP stdio server.

---

## File Structure

Create these files:

- `package.json`: scripts and dependencies.
- `index.html`: Vite entry shell.
- `vite.config.js`: React plugin plus PaperSmith storage API middleware.
- `.gitignore`: generated state, dependencies, build output.
- `src/main.jsx`: React bootstrap.
- `src/App.jsx`: editor workspace composition and data sync orchestration.
- `src/components/BrandWordmark.jsx`: code-native calligraphic `PaperSmith` wordmark.
- `src/components/ToolRail.jsx`: left rail buttons and selected tool state.
- `src/components/CommandStrip.jsx`: command field, sync pill, version/save state.
- `src/components/EditorSurface.jsx`: TipTap editor setup and formatting toolbar.
- `src/components/AnnotationComposer.jsx`: floating selected-text annotation composer.
- `src/components/InspectorPanel.jsx`: right-side annotation/text inspector.
- `src/lib/apiClient.js`: browser fetch helpers for document, selection, annotations, and events.
- `src/lib/editorAnchors.js`: ProseMirror selection/range normalization helpers.
- `src/styles.css`: C2 visual system and responsive layout.
- `server/paths.js`: project/state path resolution.
- `server/jsonFiles.js`: atomic JSON read/write.
- `server/documentModel.js`: starter document and document validation.
- `server/annotationModel.js`: annotation validation and creation.
- `server/selectionModel.js`: selection validation and summaries.
- `server/papersmithApiPlugin.js`: Vite middleware for HTTP APIs and SSE.
- `mcp/server.mjs`: MCP stdio server exposing PaperSmith tools.
- `.mcp.json`: plugin MCP server registration.
- `.codex-plugin/plugin.json`: PaperSmith plugin metadata.
- `skills/papersmith-open-editor/SKILL.md`: open the local editor.
- `skills/papersmith-insert-text/SKILL.md`: insert Codex text into editor.
- `tests/server/*.test.js`: server unit tests.
- `tests/src/*.test.jsx`: React/component tests.
- `tests/e2e/papersmith.spec.js`: browser workflow test.

Do not put generated image UI into app code. Use `papersmith-concept-c2-premium.png` only as a visual reference.

## Task 1: Project Scaffold And Test Harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `tests/setup.js`

- [ ] **Step 1: Write the failing smoke test**

Create `tests/src/app-smoke.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/App.jsx'

describe('App shell', () => {
  it('renders the PaperSmith workspace shell', () => {
    render(<App />)

    expect(screen.getByLabelText('PaperSmith editor workspace')).toBeInTheDocument()
    expect(screen.getByText('PaperSmith')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run:

```powershell
npm test -- tests/src/app-smoke.test.jsx --run
```

Expected: the command fails before implementation because `package.json` or the test runner is not configured.

- [ ] **Step 3: Add the minimal scaffold**

Create `package.json`:

```json
{
  "name": "papersmith",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^26.0.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PaperSmith</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.vite/
papersmith/
.superpowers/
coverage/
```

Create `tests/setup.js`:

```js
import '@testing-library/jest-dom/vitest'
```

Create `src/main.jsx`:

```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

Create the first `src/App.jsx`:

```jsx
export default function App() {
  return (
    <main aria-label="PaperSmith editor workspace" className="papersmith-app">
      <header className="papersmith-top">
        <span>PaperSmith</span>
      </header>
    </main>
  )
}
```

Create initial `src/styles.css`:

```css
* {
  box-sizing: border-box;
}

html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  overflow: hidden;
  background: #0f1114;
  color: #f7f1e4;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.papersmith-app {
  min-width: 0;
  min-height: 100%;
}

.papersmith-top {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 20px;
}
```

- [ ] **Step 4: Install dependencies**

Run:

```powershell
npm install
```

Expected: exits `0` and creates `package-lock.json`.

- [ ] **Step 5: Add Vitest config**

Create `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PAPERSMITH_PORT ?? 43227)
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js']
  }
})
```

- [ ] **Step 6: Run the smoke test and verify it passes**

Run:

```powershell
npm test -- tests/src/app-smoke.test.jsx --run
```

Expected: PASS for `renders the PaperSmith workspace shell`.

- [ ] **Step 7: Commit or record NO_GIT**

Run:

```powershell
if (Test-Path .git) {
  git add package.json package-lock.json index.html vite.config.js .gitignore src tests
  git commit -m "chore: scaffold papersmith app"
} else {
  "NO_GIT: scaffold created without commit" | Add-Content Codex工作记录.md
}
```

Expected in current workspace: appends `NO_GIT: scaffold created without commit`.

## Task 2: Server Document Model And Atomic Persistence

**Files:**
- Create: `server/paths.js`
- Create: `server/jsonFiles.js`
- Create: `server/documentModel.js`
- Test: `tests/server/documentModel.test.js`
- Test: `tests/server/jsonFiles.test.js`

- [ ] **Step 1: Write failing document model tests**

Create `tests/server/documentModel.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { createStarterDocument, normalizeDocumentPayload } from '../../server/documentModel.js'

describe('document model', () => {
  it('creates a starter academic document', () => {
    const payload = createStarterDocument()

    expect(payload.version).toBe(1)
    expect(payload.document.type).toBe('doc')
    expect(payload.document.content[0].type).toBe('heading')
    expect(payload.metadata.title).toBe('Untitled Paper')
  })

  it('normalizes a valid document payload', () => {
    const payload = normalizeDocumentPayload({
      version: 1,
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
      metadata: { title: 'Draft' },
      annotations: [],
      updatedAt: '2026-06-28T00:00:00.000Z'
    })

    expect(payload.metadata.title).toBe('Draft')
    expect(payload.annotations).toEqual([])
  })

  it('rejects invalid document payloads', () => {
    expect(() => normalizeDocumentPayload({ document: null })).toThrow('Expected PaperSmith document payload')
  })
})
```

- [ ] **Step 2: Verify document tests fail**

Run:

```powershell
npm test -- tests/server/documentModel.test.js --run
```

Expected: FAIL because `server/documentModel.js` does not exist.

- [ ] **Step 3: Implement document model**

Create `server/documentModel.js`:

```js
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

function normalizeMetadata(value) {
  const metadata = value && typeof value === 'object' ? value : {}
  return {
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
```

- [ ] **Step 4: Run document model tests**

Run:

```powershell
npm test -- tests/server/documentModel.test.js --run
```

Expected: PASS.

- [ ] **Step 5: Write failing persistence tests**

Create `tests/server/jsonFiles.test.js`:

```js
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readJsonFile, writeJsonAtomic } from '../../server/jsonFiles.js'

const tempDir = join(process.cwd(), '.tmp-tests')

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('json file helpers', () => {
  it('writes formatted JSON atomically and reads it back', async () => {
    const filePath = join(tempDir, 'nested', 'document.json')

    await writeJsonAtomic(filePath, { ok: true, count: 2 })
    const raw = await readFile(filePath, 'utf8')
    const parsed = await readJsonFile(filePath)

    expect(raw.endsWith('\n')).toBe(true)
    expect(parsed).toEqual({ ok: true, count: 2 })
  })

  it('returns fallback for missing JSON when provided', async () => {
    await mkdir(tempDir, { recursive: true })

    await expect(readJsonFile(join(tempDir, 'missing.json'), { fallback: { empty: true } })).resolves.toEqual({
      empty: true
    })
  })
})
```

- [ ] **Step 6: Verify persistence tests fail**

Run:

```powershell
npm test -- tests/server/jsonFiles.test.js --run
```

Expected: FAIL because `server/jsonFiles.js` does not exist.

- [ ] **Step 7: Implement persistence helpers and paths**

Create `server/jsonFiles.js`:

```js
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function readJsonFile(filePath, options = {}) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT' && Object.hasOwn(options, 'fallback')) return options.fallback
    throw error
  }
}

export async function writeJsonAtomic(filePath, payload) {
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.tmp`
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  await rename(tempPath, filePath)
}
```

Create `server/paths.js`:

```js
import { join, resolve } from 'node:path'

export function resolveProjectDir(env = process.env, cwd = process.cwd()) {
  return resolve(env.PAPERSMITH_PROJECT_DIR || cwd)
}

export function resolveStateDir(env = process.env, cwd = process.cwd()) {
  return resolve(env.PAPERSMITH_STATE_DIR || join(resolveProjectDir(env, cwd), 'papersmith'))
}

export function resolveStateFiles(env = process.env, cwd = process.cwd()) {
  const stateDir = resolveStateDir(env, cwd)
  return {
    stateDir,
    documentFile: join(stateDir, 'document.json'),
    selectionFile: join(stateDir, 'selection.json'),
    viewStateFile: join(stateDir, 'view-state.json')
  }
}
```

- [ ] **Step 8: Run server tests**

Run:

```powershell
npm test -- tests/server/documentModel.test.js tests/server/jsonFiles.test.js --run
```

Expected: PASS.

- [ ] **Step 9: Commit or record NO_GIT**

Run:

```powershell
if (Test-Path .git) {
  git add server tests/server
  git commit -m "feat: add papersmith document persistence"
} else {
  "NO_GIT: document persistence implemented without commit" | Add-Content Codex工作记录.md
}
```

## Task 3: Annotation And Selection Models

**Files:**
- Create: `server/selectionModel.js`
- Create: `server/annotationModel.js`
- Test: `tests/server/selectionModel.test.js`
- Test: `tests/server/annotationModel.test.js`
- Create: `src/lib/editorAnchors.js`
- Test: `tests/src/editorAnchors.test.js`

- [ ] **Step 1: Write failing selection tests**

Create `tests/server/selectionModel.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { normalizeSelectionState } from '../../server/selectionModel.js'

describe('selection model', () => {
  it('normalizes a selected text range', () => {
    const selection = normalizeSelectionState({
      text: 'retrieval practice improves retention',
      from: 120,
      to: 156,
      docVersion: 3
    })

    expect(selection.hasSelection).toBe(true)
    expect(selection.text).toBe('retrieval practice improves retention')
    expect(selection.range).toEqual({ from: 120, to: 156 })
  })

  it('returns an empty selection for collapsed or missing ranges', () => {
    const selection = normalizeSelectionState({ text: '', from: 10, to: 10 })

    expect(selection.hasSelection).toBe(false)
    expect(selection.text).toBe('')
  })
})
```

- [ ] **Step 2: Write failing annotation tests**

Create `tests/server/annotationModel.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { createAnnotation } from '../../server/annotationModel.js'

describe('annotation model', () => {
  it('creates an annotation anchored to selected text', () => {
    const annotation = createAnnotation(
      {
        type: 'clarity',
        comment: 'Define the retention window.',
        selection: {
          text: 'long-term retention',
          range: { from: 42, to: 61 },
          docVersion: 1
        }
      },
      new Date('2026-06-28T00:00:00.000Z')
    )

    expect(annotation.id).toMatch(/^ann_/)
    expect(annotation.type).toBe('clarity')
    expect(annotation.anchor.text).toBe('long-term retention')
    expect(annotation.status).toBe('anchored')
  })

  it('rejects annotations without selected text', () => {
    expect(() => createAnnotation({ comment: 'No anchor', selection: { text: '', range: null } })).toThrow(
      'Cannot create annotation without selected text.'
    )
  })
})
```

- [ ] **Step 3: Verify model tests fail**

Run:

```powershell
npm test -- tests/server/selectionModel.test.js tests/server/annotationModel.test.js --run
```

Expected: FAIL because the model modules do not exist.

- [ ] **Step 4: Implement selection model**

Create `server/selectionModel.js`:

```js
export function normalizeSelectionState(value = {}, now = new Date()) {
  const text = typeof value.text === 'string' ? value.text.trim() : ''
  const from = finiteNumber(value.from)
  const to = finiteNumber(value.to)
  const hasRange = from !== null && to !== null && to > from
  const hasSelection = Boolean(text && hasRange)

  return {
    version: 1,
    hasSelection,
    text: hasSelection ? text : '',
    range: hasSelection ? { from, to } : null,
    docVersion: Number.isInteger(value.docVersion) ? value.docVersion : 1,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now.toISOString()
  }
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
```

- [ ] **Step 5: Implement annotation model**

Create `server/annotationModel.js`:

```js
import { randomUUID } from 'node:crypto'

const KNOWN_TYPES = new Set(['clarity', 'citation', 'structure', 'style', 'question'])

export function createAnnotation(value = {}, now = new Date()) {
  const selection = value.selection && typeof value.selection === 'object' ? value.selection : {}
  const text = typeof selection.text === 'string' ? selection.text.trim() : ''
  const range = normalizeRange(selection.range)

  if (!text || !range) {
    throw new Error('Cannot create annotation without selected text.')
  }

  return {
    id: `ann_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    type: normalizeType(value.type),
    comment: normalizeComment(value.comment),
    status: 'anchored',
    anchor: {
      text,
      range,
      docVersion: Number.isInteger(selection.docVersion) ? selection.docVersion : 1
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    author: 'You'
  }
}

function normalizeType(type) {
  return KNOWN_TYPES.has(type) ? type : 'clarity'
}

function normalizeComment(comment) {
  const value = typeof comment === 'string' ? comment.trim() : ''
  if (!value) throw new Error('Annotation comment is required.')
  return value
}

function normalizeRange(range) {
  if (!range || typeof range !== 'object') return null
  if (!Number.isFinite(range.from) || !Number.isFinite(range.to) || range.to <= range.from) return null
  return { from: range.from, to: range.to }
}
```

- [ ] **Step 6: Write failing browser anchor helper tests**

Create `tests/src/editorAnchors.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { selectionToAnchorPayload } from '../../src/lib/editorAnchors.js'

describe('editor anchor helpers', () => {
  it('converts a TipTap selection into an API payload', () => {
    const editor = {
      state: { selection: { from: 5, to: 12 } },
      getText: ({ from, to }) => `text:${from}-${to}`
    }

    expect(selectionToAnchorPayload(editor, 4)).toEqual({
      text: 'text:5-12',
      from: 5,
      to: 12,
      docVersion: 4
    })
  })

  it('returns an empty payload for collapsed selections', () => {
    const editor = {
      state: { selection: { from: 8, to: 8 } },
      getText: () => ''
    }

    expect(selectionToAnchorPayload(editor, 1)).toEqual({ text: '', from: 8, to: 8, docVersion: 1 })
  })
})
```

- [ ] **Step 7: Implement browser anchor helper**

Create `src/lib/editorAnchors.js`:

```js
export function selectionToAnchorPayload(editor, docVersion) {
  const from = editor?.state?.selection?.from ?? 0
  const to = editor?.state?.selection?.to ?? 0
  const text = to > from && typeof editor?.getText === 'function' ? editor.getText({ from, to }) : ''

  return {
    text,
    from,
    to,
    docVersion
  }
}
```

- [ ] **Step 8: Run model and helper tests**

Run:

```powershell
npm test -- tests/server/selectionModel.test.js tests/server/annotationModel.test.js tests/src/editorAnchors.test.js --run
```

Expected: PASS.

- [ ] **Step 9: Commit or record NO_GIT**

Run:

```powershell
if (Test-Path .git) {
  git add server src/lib tests
  git commit -m "feat: model papersmith selections and annotations"
} else {
  "NO_GIT: selection and annotation models implemented without commit" | Add-Content Codex工作记录.md
}
```

## Task 4: Local HTTP API And SSE

**Files:**
- Create: `server/papersmithApiPlugin.js`
- Modify: `vite.config.js`
- Test: `tests/server/papersmithApiPlugin.test.js`

- [ ] **Step 1: Write failing API route unit tests**

Create `tests/server/papersmithApiPlugin.test.js`:

```js
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiHandlers } from '../../server/papersmithApiPlugin.js'

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
})
```

- [ ] **Step 2: Verify API tests fail**

Run:

```powershell
npm test -- tests/server/papersmithApiPlugin.test.js --run
```

Expected: FAIL because `createApiHandlers` does not exist.

- [ ] **Step 3: Implement API handlers and middleware**

Create `server/papersmithApiPlugin.js` with:

```js
import { join } from 'node:path'
import { createAnnotation } from './annotationModel.js'
import { createStarterDocument, normalizeDocumentPayload } from './documentModel.js'
import { readJsonFile, writeJsonAtomic } from './jsonFiles.js'
import { normalizeSelectionState } from './selectionModel.js'

export function createApiHandlers({ stateDir }) {
  const documentFile = join(stateDir, 'document.json')
  const selectionFile = join(stateDir, 'selection.json')
  const eventClients = new Set()

  async function getDocument() {
    const payload = await readJsonFile(documentFile, { fallback: createStarterDocument() })
    return { payload: normalizeDocumentPayload(payload), path: documentFile }
  }

  async function putDocument(payload) {
    const normalized = normalizeDocumentPayload(payload)
    normalized.updatedAt = new Date().toISOString()
    await writeJsonAtomic(documentFile, normalized)
    broadcast({ type: 'document-changed', updatedAt: normalized.updatedAt })
    return { ok: true, path: documentFile, payload: normalized }
  }

  async function getSelection() {
    const selection = await readJsonFile(selectionFile, { fallback: normalizeSelectionState() })
    return { selection: normalizeSelectionState(selection), path: selectionFile }
  }

  async function putSelection(payload) {
    const selection = normalizeSelectionState(payload)
    await writeJsonAtomic(selectionFile, selection)
    return { ok: true, path: selectionFile, selection }
  }

  async function postAnnotation(payload) {
    const current = await getDocument()
    const annotation = createAnnotation(payload)
    const next = {
      ...current.payload,
      annotations: [...current.payload.annotations, annotation],
      updatedAt: new Date().toISOString()
    }
    await writeJsonAtomic(documentFile, next)
    broadcast({ type: 'document-changed', updatedAt: next.updatedAt })
    return { ok: true, annotation, payload: next }
  }

  function addEventClient(res) {
    eventClients.add(res)
    return () => eventClients.delete(res)
  }

  function broadcast(event) {
    for (const client of eventClients) {
      try {
        client.write(`event: ${event.type}\n`)
        client.write(`data: ${JSON.stringify(event)}\n\n`)
      } catch {
        eventClients.delete(client)
      }
    }
  }

  return { getDocument, putDocument, getSelection, putSelection, postAnnotation, addEventClient }
}

export function papersmithApiPlugin(options = {}) {
  const stateDir = options.stateDir || process.env.PAPERSMITH_STATE_DIR || join(process.cwd(), 'papersmith')
  const handlers = createApiHandlers({ stateDir })

  return {
    name: 'papersmith-api',
    configureServer(server) {
      server.middlewares.use('/api/document-events', (req, res) => {
        if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
        res.statusCode = 200
        res.setHeader('content-type', 'text/event-stream')
        res.setHeader('cache-control', 'no-cache, no-transform')
        res.write(': connected\n\n')
        const remove = handlers.addEventClient(res)
        req.on('close', remove)
      })

      server.middlewares.use('/api/document', async (req, res) => {
        try {
          if (req.method === 'GET') return sendJson(res, 200, await handlers.getDocument())
          if (req.method === 'PUT') return sendJson(res, 200, await handlers.putDocument(await readBodyJson(req)))
          return methodNotAllowed(res, 'GET, PUT')
        } catch (error) {
          return sendJson(res, 500, { error: error.message })
        }
      })

      server.middlewares.use('/api/selection', async (req, res) => {
        try {
          if (req.method === 'GET') return sendJson(res, 200, await handlers.getSelection())
          if (req.method === 'PUT') return sendJson(res, 200, await handlers.putSelection(await readBodyJson(req)))
          return methodNotAllowed(res, 'GET, PUT')
        } catch (error) {
          return sendJson(res, 500, { error: error.message })
        }
      })

      server.middlewares.use('/api/annotations', async (req, res) => {
        try {
          if (req.method === 'POST') return sendJson(res, 200, await handlers.postAnnotation(await readBodyJson(req)))
          return methodNotAllowed(res, 'POST')
        } catch (error) {
          return sendJson(res, 400, { error: error.message })
        }
      })
    }
  }
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

function methodNotAllowed(res, allow) {
  res.statusCode = 405
  res.setHeader('allow', allow)
  res.end()
}

function readBodyJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 5 * 1024 * 1024) reject(new Error('Request body is too large.'))
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}
```

- [ ] **Step 4: Register API plugin in Vite**

Modify `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { papersmithApiPlugin } from './server/papersmithApiPlugin.js'

export default defineConfig({
  plugins: [react(), papersmithApiPlugin()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PAPERSMITH_PORT ?? 43227)
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js']
  }
})
```

- [ ] **Step 5: Run API tests**

Run:

```powershell
npm test -- tests/server/papersmithApiPlugin.test.js --run
```

Expected: PASS.

- [ ] **Step 6: Commit or record NO_GIT**

Run:

```powershell
if (Test-Path .git) {
  git add server/papersmithApiPlugin.js vite.config.js tests/server/papersmithApiPlugin.test.js
  git commit -m "feat: expose papersmith document api"
} else {
  "NO_GIT: local HTTP API implemented without commit" | Add-Content Codex工作记录.md
}
```

## Task 5: Browser API Client And App Data Loading

**Files:**
- Create: `src/lib/apiClient.js`
- Modify: `src/App.jsx`
- Test: `tests/src/apiClient.test.js`
- Test: `tests/src/app-loading.test.jsx`

- [ ] **Step 1: Write failing API client tests**

Create `tests/src/apiClient.test.js`:

```js
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDocument, putDocument } from '../../src/lib/apiClient.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api client', () => {
  it('loads the document payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ payload: { document: { type: 'doc', content: [] } } })
      }))
    )

    await expect(getDocument()).resolves.toEqual({ document: { type: 'doc', content: [] } })
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

    await expect(putDocument({ document: { type: 'doc', content: [] } })).rejects.toThrow('500: broken')
  })
})
```

- [ ] **Step 2: Implement API client**

Create `src/lib/apiClient.js`:

```js
export async function getDocument() {
  const payload = await fetchJson('/api/document')
  return payload.payload
}

export async function putDocument(documentPayload) {
  const payload = await fetchJson('/api/document', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(documentPayload)
  })
  return payload.payload
}

export async function putSelection(selectionPayload) {
  return fetchJson('/api/selection', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(selectionPayload)
  })
}

export async function createAnnotation(annotationPayload) {
  return fetchJson('/api/annotations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(annotationPayload)
  })
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`)
  }
  return response.json()
}
```

- [ ] **Step 3: Run API client tests**

Run:

```powershell
npm test -- tests/src/apiClient.test.js --run
```

Expected: PASS.

- [ ] **Step 4: Write failing app loading test**

Create `tests/src/app-loading.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../../src/App.jsx'

describe('App document loading', () => {
  it('loads and displays document title', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
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
})
```

- [ ] **Step 5: Modify App to load document state**

Modify `src/App.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { getDocument } from './lib/apiClient.js'

export default function App() {
  const [documentState, setDocumentState] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let active = true

    getDocument()
      .then((payload) => {
        if (active) setDocumentState(payload)
      })
      .catch((error) => {
        if (active) setLoadError(error)
      })

    return () => {
      active = false
    }
  }, [])

  if (loadError) {
    return (
      <main aria-label="PaperSmith editor workspace" className="papersmith-app">
        <p role="alert">Document could not be loaded.</p>
      </main>
    )
  }

  return (
    <main aria-label="PaperSmith editor workspace" className="papersmith-app">
      <header className="papersmith-top">
        <span>PaperSmith</span>
      </header>
      <section aria-label="Document">
        <h1>{documentState?.metadata?.title ?? 'Loading PaperSmith...'}</h1>
      </section>
    </main>
  )
}
```

- [ ] **Step 6: Run browser-side unit tests**

Run:

```powershell
npm test -- tests/src/apiClient.test.js tests/src/app-loading.test.jsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit or record NO_GIT**

Run:

```powershell
if (Test-Path .git) {
  git add src tests/src
  git commit -m "feat: load papersmith document in app"
} else {
  "NO_GIT: browser API loading implemented without commit" | Add-Content Codex工作记录.md
}
```

## Task 6: TipTap Editor And Formatting Controls

**Files:**
- Create: `src/components/EditorSurface.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Test: `tests/src/editor-surface.test.jsx`

- [ ] **Step 0: Install TipTap editor packages**

Run:

```powershell
npm install @tiptap/extension-underline @tiptap/react @tiptap/starter-kit
```

Expected: exits `0`, updates `package.json`, and updates `package-lock.json`.

- [ ] **Step 1: Write failing editor rendering test**

Create `tests/src/editor-surface.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EditorSurface from '../../src/components/EditorSurface.jsx'

describe('EditorSurface', () => {
  it('renders formatting controls and document content', async () => {
    render(
      <EditorSurface
        documentPayload={{
          version: 1,
          metadata: { title: 'Paper Title' },
          document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body copy' }] }] },
          annotations: []
        }}
        onChange={vi.fn()}
        onSelectionChange={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(await screen.findByText('Body copy')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Verify the editor test fails**

Run:

```powershell
npm test -- tests/src/editor-surface.test.jsx --run
```

Expected: FAIL because `EditorSurface.jsx` does not exist.

- [ ] **Step 3: Implement TipTap editor surface**

Create `src/components/EditorSurface.jsx`:

```jsx
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useEffect } from 'react'
import { selectionToAnchorPayload } from '../lib/editorAnchors.js'

export default function EditorSurface({ documentPayload, onChange, onSelectionChange }) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: documentPayload.document,
    editorProps: {
      attributes: {
        class: 'paper-editor',
        'aria-label': 'Paper document editor'
      }
    },
    onUpdate({ editor }) {
      onChange({
        ...documentPayload,
        document: editor.getJSON()
      })
    },
    onSelectionUpdate({ editor }) {
      onSelectionChange(selectionToAnchorPayload(editor, documentPayload.version))
    }
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getJSON()
    if (JSON.stringify(current) !== JSON.stringify(documentPayload.document)) {
      editor.commands.setContent(documentPayload.document)
    }
  }, [documentPayload.document, editor])

  if (!editor) return <section className="editor-surface">Loading editor...</section>

  return (
    <section className="editor-surface" aria-label="Paper editor">
      <div className="format-bar" aria-label="Formatting toolbar">
        <button aria-label="Bold" type="button" onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </button>
        <button aria-label="Italic" type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button aria-label="Underline" type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          U
        </button>
        <button aria-label="Heading 1" type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          H1
        </button>
        <button aria-label="Heading 2" type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </button>
      </div>
      <div className="paper-page">
        <EditorContent editor={editor} />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Wire editor into App with debounced save**

Modify `src/App.jsx` to import `EditorSurface`, `putDocument`, and `putSelection`; replace the document section with:

```jsx
{documentState ? (
  <EditorSurface
    documentPayload={documentState}
    onChange={(nextPayload) => {
      setDocumentState(nextPayload)
      window.clearTimeout(window.__papersmithSaveTimer)
      window.__papersmithSaveTimer = window.setTimeout(() => {
        putDocument(nextPayload).catch((error) => setLoadError(error))
      }, 400)
    }}
    onSelectionChange={(selection) => {
      putSelection(selection).catch(() => {})
    }}
  />
) : (
  <section aria-label="Document">
    <h1>Loading PaperSmith...</h1>
  </section>
)}
```

The top import should become:

```jsx
import { useEffect, useState } from 'react'
import EditorSurface from './components/EditorSurface.jsx'
import { getDocument, putDocument, putSelection } from './lib/apiClient.js'
```

- [ ] **Step 5: Add editor styling**

Append to `src/styles.css`:

```css
.editor-surface {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
}

.format-bar {
  display: flex;
  height: 44px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-bottom: 1px solid rgb(255 255 255 / 7%);
}

.format-bar button {
  min-width: 32px;
  height: 28px;
  color: #ded6c7;
  background: rgb(255 255 255 / 4%);
  border: 1px solid rgb(255 255 255 / 7%);
  border-radius: 6px;
}

.paper-page {
  width: min(860px, calc(100vw - 560px));
  min-height: calc(100vh - 120px);
  margin: 0 auto;
  padding: 72px 88px;
  overflow: auto;
  color: #201d18;
  background: #fbf8f1;
  box-shadow: 0 24px 70px rgb(0 0 0 / 28%);
}

.paper-editor {
  outline: none;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 16px;
  line-height: 1.68;
}

.paper-editor h1 {
  font-size: 36px;
  line-height: 1.18;
}
```

- [ ] **Step 6: Run editor tests**

Run:

```powershell
npm test -- tests/src/editor-surface.test.jsx tests/src/app-loading.test.jsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit or record NO_GIT**

Run:

```powershell
if (Test-Path .git) {
  git add src tests/src
  git commit -m "feat: add tiptap paper editor"
} else {
  "NO_GIT: TipTap editor implemented without commit" | Add-Content Codex工作记录.md
}
```

## Task 7: C2 Shell Components And Premium Styling

**Files:**
- Create: `src/components/BrandWordmark.jsx`
- Create: `src/components/ToolRail.jsx`
- Create: `src/components/CommandStrip.jsx`
- Create: `src/components/InspectorPanel.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Test: `tests/src/c2-shell.test.jsx`

- [ ] **Step 1: Write failing shell test**

Create `tests/src/c2-shell.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BrandWordmark from '../../src/components/BrandWordmark.jsx'
import ToolRail from '../../src/components/ToolRail.jsx'
import CommandStrip from '../../src/components/CommandStrip.jsx'
import InspectorPanel from '../../src/components/InspectorPanel.jsx'

describe('C2 shell components', () => {
  it('renders the artistic PaperSmith brand wordmark', () => {
    render(<BrandWordmark />)
    expect(screen.getByText('PaperSmith')).toHaveClass('brand-wordmark')
  })

  it('renders tool rail controls', () => {
    render(<ToolRail activeTool="annotate" onSelectTool={() => {}} />)
    expect(screen.getByRole('button', { name: 'Annotate' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders command and sync state', () => {
    render(<CommandStrip syncState="synced" />)
    expect(screen.getByLabelText('Command search')).toBeInTheDocument()
    expect(screen.getByText('Synced')).toBeInTheDocument()
  })

  it('renders annotation inspector state', () => {
    render(<InspectorPanel selectedAnnotation={{ type: 'clarity', comment: 'Define this term.', anchor: { text: 'long-term retention' } }} />)
    expect(screen.getByText('Define this term.')).toBeInTheDocument()
    expect(screen.getByText('long-term retention')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Verify shell test fails**

Run:

```powershell
npm test -- tests/src/c2-shell.test.jsx --run
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement brand wordmark**

Create `src/components/BrandWordmark.jsx`:

```jsx
export default function BrandWordmark() {
  return (
    <div className="brand-lockup" aria-label="PaperSmith">
      <span className="brand-wordmark">PaperSmith</span>
    </div>
  )
}
```

- [ ] **Step 4: Implement tool rail**

Create `src/components/ToolRail.jsx`:

```jsx
const tools = [
  { id: 'insert', label: 'Insert', glyph: '+' },
  { id: 'annotate', label: 'Annotate', glyph: '✦' },
  { id: 'format', label: 'Format', glyph: 'Aa' },
  { id: 'cite', label: 'Cite', glyph: '§' },
  { id: 'outline', label: 'Outline', glyph: '☰' },
  { id: 'export', label: 'Export', glyph: '⇧' }
]

export default function ToolRail({ activeTool, onSelectTool }) {
  return (
    <nav aria-label="PaperSmith tools" className="tool-rail">
      <div className="tool-rail-main">
        {tools.map((tool) => (
          <button
            key={tool.id}
            aria-label={tool.label}
            aria-pressed={activeTool === tool.id}
            className="tool-button"
            type="button"
            onClick={() => onSelectTool(tool.id)}
            title={tool.label}
          >
            <span>{tool.glyph}</span>
          </button>
        ))}
      </div>
      <button aria-label="Settings" className="tool-button tool-button-muted" type="button" title="Settings">
        ⚙
      </button>
    </nav>
  )
}
```

- [ ] **Step 5: Implement command strip**

Create `src/components/CommandStrip.jsx`:

```jsx
const labels = {
  idle: 'Idle',
  syncing: 'Codex Syncing',
  synced: 'Synced',
  error: 'Sync Error'
}

export default function CommandStrip({ syncState = 'idle' }) {
  return (
    <header className="command-strip">
      <label className="command-search">
        <span aria-hidden="true">⌕</span>
        <input aria-label="Command search" placeholder="Search or run command..." />
      </label>
      <span className={`sync-pill sync-pill-${syncState}`}>{labels[syncState] ?? labels.idle}</span>
      <span className="version-pill">v1 · Saved locally</span>
    </header>
  )
}
```

- [ ] **Step 6: Implement inspector panel**

Create `src/components/InspectorPanel.jsx`:

```jsx
export default function InspectorPanel({ selectedAnnotation }) {
  return (
    <aside className="inspector-panel" aria-label="PaperSmith inspector">
      <div className="inspector-tabs">
        <button className="inspector-tab-active" type="button">
          Annotation
        </button>
        <button type="button">Text Info</button>
      </div>

      {selectedAnnotation ? (
        <div className="inspector-content">
          <section>
            <h2>Annotation Type</h2>
            <p className="accent-row">{selectedAnnotation.type}</p>
          </section>
          <section>
            <h2>Comment</h2>
            <p>{selectedAnnotation.comment}</p>
          </section>
          <section>
            <h2>Anchor</h2>
            <blockquote>{selectedAnnotation.anchor.text}</blockquote>
          </section>
        </div>
      ) : (
        <div className="inspector-content">
          <section>
            <h2>Annotation</h2>
            <p>Select text and choose Annotate to create a note anchored to the paper.</p>
          </section>
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 7: Compose C2 shell in App**

Modify `src/App.jsx` so the loaded state renders this structure:

```jsx
import { useEffect, useState } from 'react'
import BrandWordmark from './components/BrandWordmark.jsx'
import CommandStrip from './components/CommandStrip.jsx'
import EditorSurface from './components/EditorSurface.jsx'
import InspectorPanel from './components/InspectorPanel.jsx'
import ToolRail from './components/ToolRail.jsx'
import { getDocument, putDocument, putSelection } from './lib/apiClient.js'

export default function App() {
  const [documentState, setDocumentState] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [activeTool, setActiveTool] = useState('annotate')
  const [syncState, setSyncState] = useState('idle')
  const selectedAnnotation = documentState?.annotations?.[0] ?? null

  useEffect(() => {
    let active = true
    getDocument()
      .then((payload) => {
        if (active) {
          setDocumentState(payload)
          setSyncState('synced')
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(error)
          setSyncState('error')
        }
      })
    return () => {
      active = false
    }
  }, [])

  function saveDocument(nextPayload) {
    setDocumentState(nextPayload)
    setSyncState('syncing')
    window.clearTimeout(window.__papersmithSaveTimer)
    window.__papersmithSaveTimer = window.setTimeout(() => {
      putDocument(nextPayload)
        .then(() => setSyncState('synced'))
        .catch((error) => {
          setLoadError(error)
          setSyncState('error')
        })
    }, 400)
  }

  return (
    <main aria-label="PaperSmith editor workspace" className="papersmith-app">
      <div className="brand-zone">
        <BrandWordmark />
      </div>
      <CommandStrip syncState={syncState} />
      <ToolRail activeTool={activeTool} onSelectTool={setActiveTool} />
      <section className="workspace-center">
        {loadError ? (
          <p role="alert">Document could not be loaded.</p>
        ) : documentState ? (
          <EditorSurface documentPayload={documentState} onChange={saveDocument} onSelectionChange={(selection) => putSelection(selection).catch(() => {})} />
        ) : (
          <h1>Loading PaperSmith...</h1>
        )}
      </section>
      <InspectorPanel selectedAnnotation={selectedAnnotation} />
    </main>
  )
}
```

- [ ] **Step 8: Replace CSS with C2 layout tokens**

Modify `src/styles.css` to include these C2 shell rules in addition to the editor rules:

```css
:root {
  --shell: #101215;
  --shell-2: #16191d;
  --shell-3: #1d2126;
  --paper: #fbf8f1;
  --paper-ink: #211d18;
  --gold: #d6ad52;
  --muted: #8d9299;
  --line: rgb(255 255 255 / 8%);
}

.papersmith-app {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) 336px;
  grid-template-rows: 64px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: radial-gradient(circle at top left, rgb(214 173 82 / 8%), transparent 30%), var(--shell);
}

.brand-zone {
  grid-column: 1 / 2;
  grid-row: 1 / 2;
  display: flex;
  align-items: center;
  padding-left: 20px;
  border-bottom: 1px solid var(--line);
}

.brand-wordmark {
  color: var(--gold);
  font-family: "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive;
  font-size: 25px;
  font-weight: 400;
  line-height: 1;
  text-shadow: 0 0 18px rgb(214 173 82 / 18%);
}

.command-strip {
  grid-column: 2 / 4;
  grid-row: 1 / 2;
  display: grid;
  grid-template-columns: minmax(280px, 620px) auto auto;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 0 24px;
  border-bottom: 1px solid var(--line);
}

.command-search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  height: 40px;
  padding: 0 14px;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  background: rgb(255 255 255 / 4%);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.command-search input {
  min-width: 0;
  color: #e8e1d6;
  background: transparent;
  border: 0;
  outline: 0;
}

.sync-pill,
.version-pill {
  display: inline-flex;
  height: 34px;
  padding: 0 14px;
  align-items: center;
  color: #dbe7dc;
  background: rgb(62 118 79 / 30%);
  border: 1px solid rgb(111 190 130 / 22%);
  border-radius: 8px;
  font-size: 13px;
}

.version-pill {
  color: var(--muted);
  background: transparent;
}

.tool-rail {
  grid-column: 1 / 2;
  grid-row: 2 / 3;
  display: flex;
  padding: 16px 0;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  border-right: 1px solid var(--line);
}

.tool-rail-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-button {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  color: #b9bec5;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
}

.tool-button[aria-pressed="true"] {
  color: var(--gold);
  background: rgb(214 173 82 / 12%);
  border-color: rgb(214 173 82 / 34%);
}

.workspace-center {
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.inspector-panel {
  grid-column: 3 / 4;
  grid-row: 2 / 3;
  min-width: 0;
  color: #e8e1d6;
  background: linear-gradient(180deg, #171a1f, #121417);
  border-left: 1px solid var(--line);
}

.inspector-tabs {
  display: flex;
  height: 64px;
  padding: 14px 20px;
  gap: 12px;
  border-bottom: 1px solid var(--line);
}

.inspector-tabs button {
  color: var(--muted);
  background: transparent;
  border: 0;
}

.inspector-tabs .inspector-tab-active {
  padding: 0 14px;
  color: #f4ead8;
  background: rgb(255 255 255 / 6%);
  border-radius: 8px;
}

.inspector-content {
  display: grid;
  padding: 24px;
  gap: 24px;
}

.inspector-content h2 {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

- [ ] **Step 9: Run shell tests**

Run:

```powershell
npm test -- tests/src/c2-shell.test.jsx tests/src/app-loading.test.jsx --run
```

Expected: PASS.

- [ ] **Step 10: Commit or record NO_GIT**

Run:

```powershell
if (Test-Path .git) {
  git add src tests/src
  git commit -m "feat: add premium c2 editor shell"
} else {
  "NO_GIT: C2 shell implemented without commit" | Add-Content Codex工作记录.md
}
```

## Task 8: Annotation Creation Workflow

**Files:**
- Create: `src/components/AnnotationComposer.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/EditorSurface.jsx`
- Modify: `src/styles.css`
- Test: `tests/src/annotation-composer.test.jsx`

- [ ] **Step 0: Install user-event test helper**

Run:

```powershell
npm install -D @testing-library/user-event
```

Expected: exits `0`, updates `package.json`, and updates `package-lock.json`.

- [ ] **Step 1: Write failing composer test**

Create `tests/src/annotation-composer.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AnnotationComposer from '../../src/components/AnnotationComposer.jsx'

describe('AnnotationComposer', () => {
  it('submits a comment for the selected text', async () => {
    const onSubmit = vi.fn()

    render(
      <AnnotationComposer
        selection={{ hasSelection: true, text: 'long-term retention', range: { from: 5, to: 24 }, docVersion: 1 }}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    )

    await userEvent.type(screen.getByLabelText('Annotation comment'), 'Define the time window.')
    await userEvent.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(onSubmit).toHaveBeenCalledWith({
      type: 'clarity',
      comment: 'Define the time window.',
      selection: { hasSelection: true, text: 'long-term retention', range: { from: 5, to: 24 }, docVersion: 1 }
    })
  })
})
```

- [ ] **Step 2: Verify composer test fails**

Run:

```powershell
npm test -- tests/src/annotation-composer.test.jsx --run
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement composer component**

Create `src/components/AnnotationComposer.jsx`:

```jsx
import { useState } from 'react'

export default function AnnotationComposer({ selection, onSubmit, onCancel }) {
  const [comment, setComment] = useState('')

  if (!selection?.hasSelection) return null

  return (
    <form
      className="annotation-composer"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ type: 'clarity', comment: comment.trim(), selection })
        setComment('')
      }}
    >
      <p className="anchor-preview">{selection.text}</p>
      <label>
        <span>Comment</span>
        <textarea aria-label="Annotation comment" value={comment} onChange={(event) => setComment(event.target.value)} />
      </label>
      <div className="composer-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={!comment.trim()}>
          Save annotation
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Wire composer into App**

Modify `src/App.jsx`:

```jsx
import AnnotationComposer from './components/AnnotationComposer.jsx'
import { createAnnotation, getDocument, putDocument, putSelection } from './lib/apiClient.js'
```

Add state:

```jsx
const [selection, setSelection] = useState(null)
const [showComposer, setShowComposer] = useState(false)
```

Update `ToolRail`:

```jsx
<ToolRail
  activeTool={activeTool}
  onSelectTool={(tool) => {
    setActiveTool(tool)
    if (tool === 'annotate') setShowComposer(true)
  }}
/>
```

Update `EditorSurface` selection handler:

```jsx
onSelectionChange={(nextSelection) => {
  setSelection(nextSelection)
  putSelection(nextSelection).catch(() => {})
}}
```

Render composer inside `.workspace-center` after `EditorSurface`:

```jsx
<AnnotationComposer
  selection={selection}
  onCancel={() => setShowComposer(false)}
  onSubmit={(payload) => {
    createAnnotation(payload)
      .then((result) => {
        setDocumentState(result.payload)
        setShowComposer(false)
      })
      .catch((error) => {
        setLoadError(error)
        setSyncState('error')
      })
  }}
/>
```

Only render it when `showComposer` is true.

- [ ] **Step 5: Add composer styling**

Append to `src/styles.css`:

```css
.annotation-composer {
  position: fixed;
  right: 374px;
  bottom: 108px;
  width: 300px;
  padding: 16px;
  color: #f4ead8;
  background: #171a1f;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 8px;
  box-shadow: 0 22px 54px rgb(0 0 0 / 36%);
}

.anchor-preview {
  margin: 0 0 12px;
  padding-left: 10px;
  color: #d8c08a;
  border-left: 3px solid var(--gold);
}

.annotation-composer label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
}

.annotation-composer textarea {
  min-height: 88px;
  resize: vertical;
  color: #f4ead8;
  background: rgb(255 255 255 / 5%);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
```

- [ ] **Step 6: Run annotation tests**

Run:

```powershell
npm test -- tests/src/annotation-composer.test.jsx tests/src/c2-shell.test.jsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit or record NO_GIT**

Run:

```powershell
if (Test-Path .git) {
  git add src tests/src
  git commit -m "feat: add text annotation workflow"
} else {
  "NO_GIT: annotation composer implemented without commit" | Add-Content Codex工作记录.md
}
```

## Task 9: Codex Text Insertion API And MCP Tools

**Files:**
- Modify: `server/papersmithApiPlugin.js`
- Create: `mcp/server.mjs`
- Create: `.mcp.json`
- Create: `.codex-plugin/plugin.json`
- Create: `skills/papersmith-open-editor/SKILL.md`
- Create: `skills/papersmith-insert-text/SKILL.md`
- Test: `tests/server/insertText.test.js`

- [ ] **Step 1: Write failing insertion test**

Create `tests/server/insertText.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { appendTextToDocument } from '../../server/documentModel.js'

describe('Codex text insertion', () => {
  it('appends text as a paragraph to a ProseMirror document', () => {
    const payload = {
      version: 1,
      metadata: { title: 'Draft' },
      document: { type: 'doc', content: [] },
      annotations: []
    }

    const next = appendTextToDocument(payload, 'Codex drafted paragraph.')

    expect(next.document.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Codex drafted paragraph.' }] }
    ])
  })
})
```

- [ ] **Step 2: Verify insertion test fails**

Run:

```powershell
npm test -- tests/server/insertText.test.js --run
```

Expected: FAIL because `appendTextToDocument` is not exported.

- [ ] **Step 3: Implement append helper**

Modify `server/documentModel.js` to export:

```js
export function appendTextToDocument(payload, text, now = new Date()) {
  const normalized = normalizeDocumentPayload(payload, now)
  const cleanText = typeof text === 'string' ? text.trim() : ''
  if (!cleanText) throw new Error('Text is required.')

  return {
    ...normalized,
    document: {
      ...normalized.document,
      content: [
        ...(normalized.document.content ?? []),
        { type: 'paragraph', content: [{ type: 'text', text: cleanText }] }
      ]
    },
    updatedAt: now.toISOString()
  }
}
```

- [ ] **Step 4: Add `POST /api/insert-text` handler**

Modify `server/papersmithApiPlugin.js`:

```js
import { appendTextToDocument, createStarterDocument, normalizeDocumentPayload } from './documentModel.js'
```

Inside `createApiHandlers`, add:

```js
async function insertText(payload) {
  const current = await getDocument()
  const next = appendTextToDocument(current.payload, payload.text)
  await writeJsonAtomic(documentFile, next)
  broadcast({ type: 'document-changed', updatedAt: next.updatedAt })
  return { ok: true, payload: next }
}
```

Return `insertText` from `createApiHandlers`.

Inside `configureServer`, add:

```js
server.middlewares.use('/api/insert-text', async (req, res) => {
  try {
    if (req.method === 'POST') return sendJson(res, 200, await handlers.insertText(await readBodyJson(req)))
    return methodNotAllowed(res, 'POST')
  } catch (error) {
    return sendJson(res, 400, { error: error.message })
  }
})
```

- [ ] **Step 5: Run insertion tests**

Run:

```powershell
npm test -- tests/server/insertText.test.js tests/server/papersmithApiPlugin.test.js --run
```

Expected: PASS.

- [ ] **Step 6: Create MCP server**

Create `mcp/server.mjs`:

```js
import readline from 'node:readline'

const SERVER_NAME = 'PaperSmith MCP'
const SERVER_VERSION = '0.1.0'

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function sendError(id, message) {
  send({ jsonrpc: '2.0', id, error: { code: -32602, message } })
}

function papersmithUrl(args = {}) {
  return String(args.papersmithUrl || process.env.PAPERSMITH_URL || 'http://127.0.0.1:43227').replace(/\/+$/, '')
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const text = await response.text()
  if (!response.ok) throw new Error(`${response.status}: ${text}`)
  return text ? JSON.parse(text) : {}
}

function tools() {
  return [
    {
      name: 'insert_papersmith_text',
      title: 'Insert PaperSmith Text',
      description: 'Append Codex text to the running PaperSmith editor document.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          papersmithUrl: { type: 'string' }
        },
        required: ['text'],
        additionalProperties: false
      }
    },
    {
      name: 'get_papersmith_selection',
      title: 'Get PaperSmith Selection',
      description: 'Read the latest selected text state from PaperSmith.',
      inputSchema: {
        type: 'object',
        properties: {
          papersmithUrl: { type: 'string' }
        },
        additionalProperties: false
      }
    }
  ]
}

async function handleTool(id, params) {
  const args = params.arguments ?? {}
  if (params.name === 'insert_papersmith_text') {
    const result = await fetchJson(`${papersmithUrl(args)}/api/insert-text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: args.text })
    })
    sendResult(id, { content: [{ type: 'text', text: 'Inserted text into PaperSmith.' }], structuredContent: result })
    return
  }

  if (params.name === 'get_papersmith_selection') {
    const result = await fetchJson(`${papersmithUrl(args)}/api/selection`)
    sendResult(id, { content: [{ type: 'text', text: result.selection?.text || 'No text selected.' }], structuredContent: result })
    return
  }

  sendError(id, `Unknown tool: ${params.name}`)
}

async function handle(message) {
  if (message.method === 'initialize') {
    sendResult(message.id, {
      protocolVersion: message.params?.protocolVersion ?? '2025-11-25',
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
    })
    return
  }
  if (message.method === 'tools/list') return sendResult(message.id, { tools: tools() })
  if (message.method === 'tools/call') return handleTool(message.id, message.params)
  if (message.method === 'ping') return sendResult(message.id, {})
  if (message.id !== undefined) sendError(message.id, `Method not found: ${message.method}`)
}

readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', (line) => {
  if (!line.trim()) return
  let message
  try {
    message = JSON.parse(line)
  } catch {
    return
  }
  handle(message).catch((error) => sendError(message.id, error.message))
})
```

- [ ] **Step 7: Add plugin metadata and skills**

Create `.mcp.json`:

```json
{
  "mcpServers": {
    "papersmith_mcp": {
      "command": "node",
      "args": ["./mcp/server.mjs"],
      "cwd": "."
    }
  }
}
```

Create `.codex-plugin/plugin.json`:

```json
{
  "name": "papersmith",
  "version": "0.1.0",
  "description": "A local Codex companion for academic writing, rich text editing, and selection-based annotations.",
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "interface": {
    "displayName": "PaperSmith",
    "shortDescription": "Draft, edit, and annotate academic writing in a local browser editor.",
    "category": "Productivity",
    "brandColor": "#D6AD52",
    "capabilities": ["Rich text editor", "Codex text sync", "Selection annotations", "Project-local persistence"]
  }
}
```

Create `skills/papersmith-open-editor/SKILL.md`:

```md
---
name: papersmith-open-editor
description: Open the PaperSmith local browser editor for the active project.
---

# PaperSmith Open Editor

Start the local PaperSmith service from the plugin root with:

```powershell
$env:PAPERSMITH_PROJECT_DIR = (Get-Location).Path
npm run dev -- --host 127.0.0.1 --port 43227
```

Open `http://127.0.0.1:43227/` in the Codex in-app browser when browser control is available.
```

Create `skills/papersmith-insert-text/SKILL.md`:

```md
---
name: papersmith-insert-text
description: Insert Codex-generated writing into the running PaperSmith editor.
---

# PaperSmith Insert Text

Use the MCP tool `insert_papersmith_text` with the generated text. The editor must be running at `http://127.0.0.1:43227/` unless a different `papersmithUrl` is provided.
```

- [ ] **Step 8: Commit or record NO_GIT**

Run:

```powershell
if (Test-Path .git) {
  git add server mcp .mcp.json .codex-plugin skills tests/server
  git commit -m "feat: add papersmith codex insertion tools"
} else {
  "NO_GIT: MCP insertion tooling implemented without commit" | Add-Content Codex工作记录.md
}
```

## Task 10: End-To-End Verification And Visual QA

**Files:**
- Create: `tests/e2e/papersmith.spec.js`
- Modify: `package.json`
- Modify: `Codex工作记录.md`

- [ ] **Step 1: Add e2e test script**

Modify `package.json` scripts:

```json
{
  "dev": "vite",
  "build": "vite build",
  "test": "vitest",
  "test:run": "vitest run",
  "test:e2e": "playwright test"
}
```

If Playwright is not installed, add it:

```powershell
npm install -D @playwright/test
```

- [ ] **Step 2: Write e2e workflow test**

Create `tests/e2e/papersmith.spec.js`:

```js
import { expect, test } from '@playwright/test'

test('PaperSmith loads editor and accepts inserted text', async ({ page }) => {
  await page.goto('http://127.0.0.1:43227/')

  await expect(page.getByLabel('PaperSmith editor workspace')).toBeVisible()
  await expect(page.getByText('PaperSmith')).toBeVisible()
  await expect(page.getByLabel('Paper document editor')).toBeVisible()

  const response = await page.request.post('http://127.0.0.1:43227/api/insert-text', {
    data: { text: 'Codex inserted this verification paragraph.' }
  })
  expect(response.ok()).toBe(true)

  await page.reload()
  await expect(page.getByText('Codex inserted this verification paragraph.')).toBeVisible()
})
```

- [ ] **Step 3: Run unit tests**

Run:

```powershell
npm test -- --run
```

Expected: all Vitest tests PASS.

- [ ] **Step 4: Run production build**

Run:

```powershell
npm run build
```

Expected: exits `0` and writes `dist/`.

- [ ] **Step 5: Start local dev server**

Run in a persistent terminal:

```powershell
$env:PAPERSMITH_PROJECT_DIR = "E:\gyc_re\papersmith"
npm run dev -- --host 127.0.0.1 --port 43227
```

Expected: Vite reports a local URL at `http://127.0.0.1:43227/`.

- [ ] **Step 6: Run e2e test**

Run in another terminal:

```powershell
npm run test:e2e
```

Expected: PASS for `PaperSmith loads editor and accepts inserted text`.

- [ ] **Step 7: Visual QA against C2**

Open both:

- App: `http://127.0.0.1:43227/`
- Target image: `E:/gyc_re/papersmith/.superpowers/brainstorm/codex-47596-1782616841/content/papersmith-concept-c2-premium.png`

Check:

- `PaperSmith` wordmark is calligraphic, gold, legible, and top-left.
- Left rail is narrow and dark.
- Editor page is ivory and central.
- Right inspector is dark and contextual.
- Gold annotation visual language appears when an annotation exists.
- Text does not overlap at 1280px, 1440px, and 390px widths.

- [ ] **Step 8: Update project work log**

Run this after unit tests, build, e2e, and visual QA pass:

```powershell
$Stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
$Entry = @"
## $Stamp - PaperSmith First Runnable Editor

- Goal: Implement the first runnable PaperSmith C2 editor.
- Context: Built from the approved C2 design spec and implementation plan.
- Changes: Added Vite/React/TipTap editor, local persistence APIs, annotation workflow, Codex insertion endpoint, MCP tools, and plugin metadata.
- Verification: Unit tests passed with `npm test -- --run`; production build passed with `npm run build`; e2e passed with `npm run test:e2e`; browser visual QA matched the approved C2 target at desktop width.
- Next: Install as a Codex plugin or iterate on visual fidelity and annotation anchoring.
"@
Add-Content -Path Codex工作记录.md -Value $Entry
```

- [ ] **Step 9: Commit or record NO_GIT**

Run:

```powershell
if (Test-Path .git) {
  git add package.json package-lock.json tests/e2e Codex工作记录.md
  git commit -m "test: verify papersmith editor workflow"
} else {
  "NO_GIT: final verification completed without commit" | Add-Content Codex工作记录.md
}
```

## Self-Review

Spec coverage:

- C2 visual direction: covered by Tasks 7 and 10.
- Codex output sync into browser editor: covered by Tasks 4, 5, 9, and 10.
- User editing and basic formatting: covered by Task 6.
- Selection-based annotation: covered by Tasks 3, 4, 8, and 10.
- Project-local persistence: covered by Tasks 2 and 4.
- MCP/plugin shape: covered by Task 9.
- Error states and sync state: covered by Tasks 4, 5, and 7.

Marker scan:

- The plan contains no unresolved task-marker strings.
- Reserved controls are explicitly disabled or non-primary in the first build.
- Every implementation task includes test commands and expected outcomes.

Type consistency:

- Document payload shape is consistently `{ version, metadata, document, annotations, updatedAt }`.
- Selection payload shape is consistently `{ version, hasSelection, text, range, docVersion, updatedAt }`.
- Annotation shape is consistently `{ id, type, comment, status, anchor, createdAt, updatedAt, author }`.
- API names are consistently `/api/document`, `/api/document-events`, `/api/selection`, `/api/annotations`, and `/api/insert-text`.

Execution note:

- Current workspace is not a git repository. Commit steps should record `NO_GIT` unless a repository is initialized before implementation.
