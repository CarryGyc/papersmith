import { useEffect, useRef, useState } from 'react'

export default function AnnotationComposer({ selection, isSubmitting = false, onSubmit, onCancel }) {
  const [comment, setComment] = useState('')
  const [localSubmitting, setLocalSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const trimmedComment = comment.trim()
  const submitPending = isSubmitting || localSubmitting
  const selectionKey = JSON.stringify(selection ?? null)

  useEffect(() => {
    submittingRef.current = false
    setLocalSubmitting(false)
  }, [selectionKey])

  if (!selection?.hasSelection) return null

  async function handleSubmit(event) {
    event.preventDefault()
    if (!trimmedComment || submitPending || submittingRef.current) return

    submittingRef.current = true
    setLocalSubmitting(true)
    try {
      const shouldClear = await onSubmit?.({
        type: 'clarity',
        comment: trimmedComment,
        selection
      })
      if (shouldClear) setComment('')
    } finally {
      submittingRef.current = false
      setLocalSubmitting(false)
    }
  }

  return (
    <form className="annotation-composer" aria-label="Create annotation" onSubmit={handleSubmit}>
      <blockquote className="annotation-composer-anchor">{selection.text}</blockquote>
      <textarea
        aria-label="Annotation comment"
        className="annotation-composer-input"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      <div className="annotation-composer-actions">
        <button className="annotation-composer-cancel" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="annotation-composer-save" type="submit" disabled={!trimmedComment || submitPending}>
          Save annotation
        </button>
      </div>
    </form>
  )
}
