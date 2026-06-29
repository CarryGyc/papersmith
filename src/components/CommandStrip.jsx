import { useState } from 'react'

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
  onSelectVersion,
  onRenameVersion,
  onDeleteVersion
}) {
  const label = syncLabels[syncState] ?? syncLabels.idle
  const copyFeedbackLabel = copyFeedbackState === 'copied' ? 'Copied' : 'Copy feedback'
  const visibleVersions = Array.isArray(versions) ? versions : []
  const selectedVersionId =
    visibleVersions.find((version) => version.id === activeVersionId)?.id ?? visibleVersions[0]?.id ?? ''
  const selectedVersion = visibleVersions.find((version) => version.id === selectedVersionId)
  const selectedVersionLabel = selectedVersion?.label ?? selectedVersion?.id ?? ''
  const canManageSelectedVersion = selectedVersion?.source === 'codex'
  const canDeleteSelectedVersion = canManageSelectedVersion && visibleVersions.length > 1
  const shouldRenderVersionRow = visibleVersions.length > 1 || canManageSelectedVersion
  const [isRenamingVersion, setIsRenamingVersion] = useState(false)
  const [versionNameDraft, setVersionNameDraft] = useState(selectedVersionLabel)

  function beginVersionRename() {
    setVersionNameDraft(selectedVersionLabel)
    setIsRenamingVersion(true)
  }

  function cancelVersionRename() {
    setVersionNameDraft(selectedVersionLabel)
    setIsRenamingVersion(false)
  }

  function submitVersionRename(event) {
    event.preventDefault()
    const nextLabel = versionNameDraft.trim()
    if (!selectedVersionId || !nextLabel) return

    onRenameVersion?.(selectedVersionId, nextLabel)
    setIsRenamingVersion(false)
  }

  function handleVersionSelectChange(event) {
    setIsRenamingVersion(false)
    onSelectVersion?.(event.target.value)
  }

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
      {shouldRenderVersionRow ? (
        <div className="draft-version-row" aria-label="Draft versions">
          <label className="version-switcher">
            <span className="version-label">Version</span>
            <select
              aria-label="Draft version"
              className="version-select"
              value={selectedVersionId}
              onChange={handleVersionSelectChange}
            >
              {visibleVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label ?? version.id}
                </option>
              ))}
            </select>
          </label>
          {canManageSelectedVersion ? (
            isRenamingVersion ? (
              <form className="version-rename-form" aria-label="Rename draft version form" onSubmit={submitVersionRename}>
                <input
                  aria-label="Draft version name"
                  className="version-name-input"
                  type="text"
                  value={versionNameDraft}
                  onChange={(event) => setVersionNameDraft(event.target.value)}
                />
                {onRenameVersion ? (
                  <button className="version-action-button" type="submit" aria-label="Save draft version name">
                    Save
                  </button>
                ) : null}
                <button
                  className="version-action-button version-action-muted"
                  type="button"
                  aria-label="Cancel draft version rename"
                  onClick={cancelVersionRename}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="version-actions" aria-label="Draft version actions">
                {onRenameVersion ? (
                  <button
                    className="version-action-button"
                    type="button"
                    aria-label="Rename draft version"
                    onClick={beginVersionRename}
                  >
                    Rename
                  </button>
                ) : null}
                {onDeleteVersion && canDeleteSelectedVersion ? (
                  <button
                    className="version-action-button version-action-danger"
                    type="button"
                    aria-label="Delete draft version"
                    onClick={() => onDeleteVersion(selectedVersionId)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </header>
  )
}
