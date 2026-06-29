export default function InspectorPanel({
  annotations = [],
  selectedAnnotation = null,
  overallComment = '',
  onOverallCommentChange
}) {
  const visibleAnnotations = Array.isArray(annotations) ? annotations : []

  return (
    <aside className="inspector-panel" aria-label="PaperSmith inspector">
      <div className="inspector-tabs" aria-label="Inspector views">
        <span className="inspector-tab-label inspector-tab-active">
          Comments
        </span>
      </div>
      <div className="inspector-content">
        <OverallComment value={overallComment} onChange={onOverallCommentChange} />
        {visibleAnnotations.length > 0 ? (
          <AnnotationList annotations={visibleAnnotations} selectedAnnotation={selectedAnnotation} />
        ) : (
          <InspectorEmptyState />
        )}
      </div>
    </aside>
  )
}

function OverallComment({ value, onChange }) {
  return (
    <label className="overall-comment-card">
      <span className="inspector-kicker">Overall comment</span>
      <textarea
        aria-label="Overall comment"
        className="overall-comment-input"
        onChange={(event) => onChange?.(event.target.value)}
        placeholder="Optional guidance for unmarked text"
        value={value}
      />
    </label>
  )
}

function AnnotationList({ annotations, selectedAnnotation }) {
  const orderedAnnotations = [...annotations].reverse()

  return (
    <section className="annotation-list" aria-label="Saved comments">
      <div className="annotation-list-header">
        <p className="inspector-kicker">Comments</p>
        <p className="annotation-count">{formatAnnotationCount(annotations.length)}</p>
      </div>
      {orderedAnnotations.map((annotation) => (
        <AnnotationDetails
          key={annotationKey(annotation)}
          annotation={annotation}
          isSelected={isSameAnnotation(annotation, selectedAnnotation)}
        />
      ))}
    </section>
  )
}

function AnnotationDetails({ annotation, isSelected = false }) {
  return (
    <article className={isSelected ? 'annotation-details annotation-details-selected' : 'annotation-details'}>
      <p className="inspector-kicker">{isSelected ? 'Latest comment' : annotation.type ?? 'comment'}</p>
      <h2>{annotation.type ?? 'comment'}</h2>
      <p className="annotation-comment">{annotation.comment}</p>
      <div className="anchor-card">
        <span>Anchor</span>
        <p>{annotation.anchor?.text ?? 'No anchor text'}</p>
      </div>
    </article>
  )
}

function InspectorEmptyState() {
  return (
    <div className="inspector-empty">
      <p className="inspector-kicker">No comments yet</p>
      <h2>Comments will appear here</h2>
      <p>Select text and save a comment to build a comments list.</p>
    </div>
  )
}

function formatAnnotationCount(count) {
  return `${count} comments`
}

function annotationKey(annotation) {
  return annotation?.id ?? JSON.stringify(annotation ?? null)
}

function isSameAnnotation(annotation, selectedAnnotation) {
  if (!annotation || !selectedAnnotation) return false
  if (annotation.id && selectedAnnotation.id) return annotation.id === selectedAnnotation.id
  return annotation === selectedAnnotation
}
