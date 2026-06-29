const syncLabels = {
  idle: 'Idle',
  syncing: 'Codex Syncing',
  synced: 'Synced',
  error: 'Sync Error'
}

export default function CommandStrip({
  syncState = 'idle',
  onCopyFeedback,
  copyFeedbackState = 'idle',
  versions = [],
  activeVersionId,
  onSelectVersion
}) {
  const label = syncLabels[syncState] ?? syncLabels.idle
  const copyFeedbackLabel = copyFeedbackState === 'copied' ? 'Copied' : 'Copy feedback'
  const visibleVersions = Array.isArray(versions) ? versions : []

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
        <span className="version-pill">Local autosave</span>
        {visibleVersions.length > 1 ? (
          <div className="version-switcher" aria-label="Draft versions">
            {visibleVersions.map((version) => (
              <button
                aria-pressed={version.id === activeVersionId}
                className={version.id === activeVersionId ? 'version-button version-button-active' : 'version-button'}
                key={version.id}
                onClick={() => onSelectVersion?.(version.id)}
                type="button"
              >
                {version.label ?? version.id}
              </button>
            ))}
          </div>
        ) : null}
        {onCopyFeedback ? (
          <button className="copy-feedback-button" type="button" onClick={onCopyFeedback}>
            {copyFeedbackLabel}
          </button>
        ) : null}
      </div>
    </header>
  )
}
