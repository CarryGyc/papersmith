const syncLabels = {
  idle: 'Idle',
  syncing: 'Codex Syncing',
  synced: 'Synced',
  error: 'Sync Error'
}

export default function CommandStrip({ syncState = 'idle', onCopyFeedback, copyFeedbackState = 'idle' }) {
  const label = syncLabels[syncState] ?? syncLabels.idle
  const copyFeedbackLabel = copyFeedbackState === 'copied' ? 'Copied' : 'Copy feedback'

  return (
    <header className="command-strip" aria-label="PaperSmith command strip">
      <label className="command-search-wrap">
        <span className="command-search-icon" aria-hidden="true">
          /
        </span>
        <input aria-label="Command search" className="command-search" placeholder="Command or search" type="search" />
      </label>
      <div className="command-pills" aria-label="Document sync state">
        <span className={`sync-pill sync-pill-${syncState}`}>{label}</span>
        <span className="version-pill">Local Save</span>
        {onCopyFeedback ? (
          <button className="copy-feedback-button" type="button" onClick={onCopyFeedback}>
            {copyFeedbackLabel}
          </button>
        ) : null}
      </div>
    </header>
  )
}
