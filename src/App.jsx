import { useEffect, useRef, useState } from 'react'
import AnnotationComposer from './components/AnnotationComposer.jsx'
import BrandWordmark from './components/BrandWordmark.jsx'
import CommandStrip from './components/CommandStrip.jsx'
import EditorSurface from './components/EditorSurface.jsx'
import InspectorPanel from './components/InspectorPanel.jsx'
import ToolRail from './components/ToolRail.jsx'
import { createAnnotation, getDocument, putDocument, putSelection } from './lib/apiClient.js'
import { buildFeedbackMarkdown } from './lib/feedbackMarkdown.js'

export default function App() {
  const [documentState, setDocumentState] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [annotationError, setAnnotationError] = useState(null)
  const [activeTool, setActiveTool] = useState('annotate')
  const [showComposer, setShowComposer] = useState(false)
  const [latestSelection, setLatestSelection] = useState(null)
  const [isAnnotationSubmitting, setIsAnnotationSubmittingState] = useState(false)
  const [selectedAnnotation, setSelectedAnnotation] = useState(null)
  const [copyFeedbackState, setCopyFeedbackState] = useState('idle')
  const [syncState, setSyncState] = useState('syncing')
  const activeRef = useRef(true)
  const annotationRequestIdRef = useRef(0)
  const isAnnotationSubmittingRef = useRef(false)
  const lastSelectionKeyRef = useRef(null)
  const latestSelectionRef = useRef(null)
  const localEditSeqRef = useRef(0)
  const pendingSaveRef = useRef(null)
  const pendingSelectionRef = useRef(null)
  const saveInFlightRef = useRef(false)
  const saveTimerRef = useRef(null)
  const selectionTimerRef = useRef(null)
  const copyFeedbackTimerRef = useRef(null)

  useEffect(() => {
    let active = true
    const eventSource = openDocumentEventStream(() => {
      refreshDocumentFromServer()
    })
    activeRef.current = true

    getDocument()
      .then((payload) => {
        if (!active) return
        setDocumentState(payload)
        setLoadError(null)
        setSyncState('synced')
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error)
        setSyncState('error')
      })

    return () => {
      active = false
      activeRef.current = false
      eventSource?.close()
      flushPendingDocumentSave(false)
      if (selectionTimerRef.current) window.clearTimeout(selectionTimerRef.current)
      clearCopyFeedbackTimer()
    }
  }, [])

  function refreshDocumentFromServer() {
    if (hasPendingDocumentSave()) return

    setSyncState('syncing')
    getDocument()
      .then((payload) => {
        if (!activeRef.current || hasPendingDocumentSave()) return
        applyDocumentPayload(payload)
        setLoadError(null)
        setSyncState('synced')
      })
      .catch(() => {
        if (!activeRef.current) return
        setSyncState('error')
      })
  }

  function persistDocument(payload, updateState, submittedEditSeq) {
    return putDocument(payload)
      .then((savedPayload) => {
        const isLatestSave = submittedEditSeq === localEditSeqRef.current
        if (activeRef.current && isLatestSave) {
          setSyncState('synced')
          setSaveError(null)
          if (updateState) applyDocumentPayload(savedPayload)
        }
        return savedPayload
      })
      .catch((error) => {
        const isLatestSave = submittedEditSeq === localEditSeqRef.current
        if (activeRef.current && isLatestSave) {
          setSyncState('error')
          if (updateState) setSaveError(error)
        }
      })
  }

  function flushPendingDocumentSave(updateState) {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    if (pendingSaveRef.current) {
      pendingSaveRef.current = { ...pendingSaveRef.current, updateState, ready: true }
    }

    startNextDocumentSave()
  }

  function startNextDocumentSave() {
    if (saveInFlightRef.current) return

    const pendingSave = pendingSaveRef.current
    if (!pendingSave?.ready) return
    pendingSaveRef.current = null

    saveInFlightRef.current = true
    if (activeRef.current) setSyncState('syncing')
    persistDocument(pendingSave.payload, pendingSave.updateState, pendingSave.editSeq).finally(() => {
      saveInFlightRef.current = false
      startNextDocumentSave()
    })
  }

  function hasPendingDocumentSave() {
    return Boolean(pendingSaveRef.current) || saveInFlightRef.current
  }

  function queueDocumentSave(nextPayload) {
    const payloadToSave = syncActiveVersionInPayload(nextPayload)
    const editSeq = localEditSeqRef.current + 1
    localEditSeqRef.current = editSeq
    pendingSaveRef.current = { payload: payloadToSave, editSeq, updateState: true, ready: false }
    setSyncState('syncing')
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      flushPendingDocumentSave(true)
    }, 400)
  }

  function queueSelectionSync(selection) {
    const selectionKey = JSON.stringify(selection)
    if (selectionKey === lastSelectionKeyRef.current) return

    pendingSelectionRef.current = selection
    if (selectionTimerRef.current) window.clearTimeout(selectionTimerRef.current)
    selectionTimerRef.current = window.setTimeout(() => {
      selectionTimerRef.current = null
      const payload = pendingSelectionRef.current
      pendingSelectionRef.current = null
      if (!payload) return

      const payloadKey = JSON.stringify(payload)
      if (payloadKey === lastSelectionKeyRef.current) return
      lastSelectionKeyRef.current = payloadKey

      // Selection sync is best-effort UI context; document editing must stay usable if it fails.
      putSelection(payload).catch(() => {})
    }, 200)
  }

  function handleSelectTool(toolId) {
    setActiveTool(toolId)
    setAnnotationError(null)
    setShowComposer(toolId === 'annotate')
  }

  async function handleCopyFeedback() {
    const markdown = buildFeedbackMarkdown(documentState, activeOverallComment(documentState))

    try {
      await copyMarkdownDocument(markdown)
      setCopyFeedbackState('copied')
      scheduleCopyFeedbackReset()
    } catch {
      try {
        downloadMarkdown(markdown)
        setCopyFeedbackState('copied')
        scheduleCopyFeedbackReset()
      } catch {
        setCopyFeedbackState('error')
      }
    }
  }

  function handleOverallCommentChange(value) {
    const nextPayload = setOverallCommentInPayload(documentState, value)
    if (nextPayload) {
      setSaveError(null)
      setDocumentState(nextPayload)
      queueDocumentSave(nextPayload)
    }
    clearCopyFeedbackTimer()
    setCopyFeedbackState('idle')
  }

  function handleVersionSelect(versionId) {
    const nextPayload = selectVersionInPayload(documentState, versionId)
    if (!nextPayload || nextPayload.activeVersionId === documentState?.activeVersionId) return

    setSaveError(null)
    setAnnotationError(null)
    setSelectedAnnotation(null)
    setShowComposer(false)
    updateLatestSelection(null)
    setDocumentState(nextPayload)
    queueDocumentSave(nextPayload)
  }

  function scheduleCopyFeedbackReset() {
    clearCopyFeedbackTimer()
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      copyFeedbackTimerRef.current = null
      setCopyFeedbackState('idle')
    }, 3000)
  }

  function clearCopyFeedbackTimer() {
    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current)
      copyFeedbackTimerRef.current = null
    }
  }

  function handleSelectionChange(selection) {
    const normalizedSelection = normalizeSelection(selection)
    const selectionChanged = selectionStateKey(normalizedSelection) !== selectionStateKey(latestSelectionRef.current)
    updateLatestSelection(normalizedSelection)
    if (selectionChanged && isAnnotationSubmittingRef.current) {
      annotationRequestIdRef.current += 1
      setAnnotationSubmitting(false)
    }
    queueSelectionSync(selection)
  }

  async function handleAnnotationSubmit(annotationPayload) {
    const requestId = annotationRequestIdRef.current + 1
    annotationRequestIdRef.current = requestId
    setAnnotationSubmitting(true)
    setAnnotationError(null)

    try {
      const result = await createAnnotation(annotationPayload)
      if (!isCurrentAnnotationRequest(requestId)) return false
      applyDocumentPayload(result.payload)
      setSelectedAnnotation(result.annotation ?? null)
      updateLatestSelection(null)
      queueSelectionSync(clearedSelectionPayload(result.payload, annotationPayload.selection))
      setShowComposer(false)
      setAnnotationError(null)
      return true
    } catch (error) {
      if (!isCurrentAnnotationRequest(requestId)) return false
      setAnnotationError(error)
      return false
    } finally {
      if (isCurrentAnnotationRequest(requestId)) {
        setAnnotationSubmitting(false)
      }
    }
  }

  function applyDocumentPayload(nextPayload) {
    setDocumentState((currentPayload) => mergeDocumentPayloadAnnotations(nextPayload, currentPayload))
  }

  function updateLatestSelection(selection) {
    latestSelectionRef.current = selection
    setLatestSelection(selection)
  }

  function setAnnotationSubmitting(value) {
    isAnnotationSubmittingRef.current = value
    setIsAnnotationSubmittingState(value)
  }

  function isCurrentAnnotationRequest(requestId) {
    return activeRef.current && requestId === annotationRequestIdRef.current
  }

  return (
    <main aria-label="PaperSmith editor workspace" className="papersmith-app">
      <div className="brand-zone">
        <BrandWordmark />
      </div>
      <CommandStrip
        syncState={syncState}
        onCopyFeedback={handleCopyFeedback}
        copyFeedbackState={copyFeedbackState}
        versions={documentState?.versions ?? []}
        activeVersionId={documentState?.activeVersionId}
        onSelectVersion={handleVersionSelect}
      />
      <ToolRail activeTool={activeTool} onSelectTool={handleSelectTool} />
      <section className="workspace-center" aria-label="Document">
        {saveError ? (
          <div className="save-status-row" aria-live="polite">
            <p role="status">Document changes could not be saved.</p>
          </div>
        ) : null}
        {annotationError ? (
          <div className="annotation-status-row" aria-live="polite">
            <p role="status">Annotation could not be saved.</p>
          </div>
        ) : null}
        {loadError ? (
          <div className="workspace-message workspace-error">
            <p role="alert">Document could not be loaded.</p>
          </div>
        ) : documentState ? (
          <EditorSurface
            documentPayload={documentState}
            onChange={(nextPayload) => {
              setSaveError(null)
              const payloadWithVersion = syncActiveVersionInPayload(nextPayload)
              setDocumentState(payloadWithVersion)
              queueDocumentSave(payloadWithVersion)
            }}
            onSelectionChange={handleSelectionChange}
          />
        ) : (
          <div className="workspace-message workspace-loading">
            <h1>Loading PaperSmith...</h1>
          </div>
        )}
        {showComposer ? (
          <AnnotationComposer
            selection={latestSelection}
            isSubmitting={isAnnotationSubmitting}
            onCancel={() => {
              setShowComposer(false)
              setAnnotationError(null)
            }}
            onSubmit={handleAnnotationSubmit}
          />
        ) : null}
      </section>
      <InspectorPanel
        annotations={documentState?.annotations ?? []}
        selectedAnnotation={selectedAnnotation}
        overallComment={activeOverallComment(documentState)}
        onOverallCommentChange={handleOverallCommentChange}
      />
    </main>
  )
}

function downloadMarkdown(markdown) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'papersmith-feedback.md'
  anchor.click()
  URL.revokeObjectURL(url)
}

async function copyMarkdownDocument(markdown) {
  const clipboard = typeof navigator === 'undefined' ? null : navigator.clipboard
  if (clipboard && typeof ClipboardItem === 'function' && typeof clipboard.write === 'function') {
    try {
      await clipboard.write([
        new ClipboardItem({
          'text/markdown': new Blob([markdown], { type: 'text/markdown' }),
          'text/plain': new Blob([markdown], { type: 'text/plain' })
        })
      ])
      return
    } catch {
      // Some browsers reject text/markdown clipboard items. Plain text keeps the .md document intact.
    }
  }

  if (clipboard && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(markdown)
      return
    } catch {
      // Fall back to the legacy copy path below for embedded browsers.
    }
  }

  if (copyMarkdownDocumentWithSelection(markdown)) {
    return
  }

  throw new Error('Clipboard cannot write text.')
}

function copyMarkdownDocumentWithSelection(markdown) {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false

  const textarea = document.createElement('textarea')
  textarea.value = markdown
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-1000px'
  textarea.style.left = '-1000px'
  textarea.style.opacity = '0'

  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    return document.execCommand('copy') === true
  } finally {
    document.body.removeChild(textarea)
  }
}

function openDocumentEventStream(onDocumentChanged) {
  if (typeof EventSource !== 'function') return null

  const eventSource = new EventSource('/api/document-events')
  eventSource.addEventListener('document-changed', onDocumentChanged)
  return eventSource
}

function normalizeSelection(selection) {
  if (!selection || typeof selection !== 'object') return null
  const hasSelection =
    typeof selection.hasSelection === 'boolean' ? selection.hasSelection : Boolean(selection.range && selection.text)

  return {
    ...selection,
    hasSelection
  }
}

function clearedSelectionPayload(documentPayload, fallbackSelection) {
  return {
    hasSelection: false,
    text: '',
    range: null,
    docVersion: normalizeDocVersion(documentPayload?.version ?? fallbackSelection?.docVersion)
  }
}

function normalizeDocVersion(value) {
  return Number.isInteger(value) && value > 0 ? value : 1
}

function selectionStateKey(selection) {
  return JSON.stringify(selection ?? null)
}

function mergeDocumentPayloadAnnotations(nextPayload, currentPayload) {
  if (!nextPayload || typeof nextPayload !== 'object') return nextPayload
  if (
    nextPayload.activeVersionId &&
    currentPayload?.activeVersionId &&
    nextPayload.activeVersionId !== currentPayload.activeVersionId
  ) {
    return nextPayload
  }

  const currentAnnotations = Array.isArray(currentPayload?.annotations) ? currentPayload.annotations : []
  if (currentAnnotations.length === 0) return nextPayload

  const nextAnnotations = Array.isArray(nextPayload.annotations) ? nextPayload.annotations : []
  const mergedAnnotations = [...nextAnnotations]
  const seenKeys = new Set(nextAnnotations.map(annotationKey))

  for (const annotation of currentAnnotations) {
    const key = annotationKey(annotation)
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      mergedAnnotations.push(annotation)
    }
  }

  return syncActiveVersionInPayload({
    ...nextPayload,
    annotations: mergedAnnotations
  })
}

function annotationKey(annotation) {
  if (annotation?.id !== undefined && annotation?.id !== null) return `id:${annotation.id}`
  return `value:${JSON.stringify(annotation ?? null)}`
}

function selectVersionInPayload(payload, versionId) {
  if (!payload || typeof payload !== 'object') return null
  const versions = Array.isArray(payload.versions) ? payload.versions : []
  const selectedVersion = versions.find((version) => version.id === versionId)
  if (!selectedVersion) return null

  return {
    ...payload,
    document: selectedVersion.document,
    annotations: Array.isArray(selectedVersion.annotations) ? selectedVersion.annotations : [],
    overallComment: typeof selectedVersion.overallComment === 'string' ? selectedVersion.overallComment : '',
    activeVersionId: selectedVersion.id
  }
}

function syncActiveVersionInPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const versions = Array.isArray(payload.versions) ? payload.versions : []
  if (!payload.activeVersionId || versions.length === 0) return payload

  return {
    ...payload,
    versions: versions.map((version) => {
      if (version.id !== payload.activeVersionId) return version
      return {
        ...version,
        document: payload.document,
        annotations: Array.isArray(payload.annotations) ? payload.annotations : [],
        overallComment: activeOverallComment(payload)
      }
    })
  }
}

function setOverallCommentInPayload(payload, overallComment) {
  if (!payload || typeof payload !== 'object') return null
  const versions = Array.isArray(payload.versions) ? payload.versions : []
  const normalizedOverallComment = typeof overallComment === 'string' ? overallComment : ''

  return {
    ...payload,
    overallComment: normalizedOverallComment,
    versions: versions.map((version) => {
      if (version.id !== payload.activeVersionId) return version
      return {
        ...version,
        overallComment: normalizedOverallComment
      }
    })
  }
}

function activeOverallComment(payload) {
  return typeof payload?.overallComment === 'string' ? payload.overallComment : ''
}
