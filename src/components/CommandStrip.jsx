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
  const selectedVersionId =
    visibleVersions.find((version) => version.id === activeVersionId)?.id ?? visibleVersions[0]?.id ?? ''

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
        {onCopyFeedback ? (
          <button className="copy-feedback-button" type="button" onClick={onCopyFeedback}>
            {copyFeedbackLabel}
          </button>
        ) : null}
      </div>
      {visibleVersions.length > 1 ? (
        <div className="draft-version-row" aria-label="Draft versions">
          <label className="version-switcher">
            <span className="version-label">Version</span>
            <select
              aria-label="Draft version"
              className="version-select"
              value={selectedVersionId}
              onChange={(event) => onSelectVersion?.(event.target.value)}
            >
              {visibleVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label ?? version.id}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </header>
  )
}
