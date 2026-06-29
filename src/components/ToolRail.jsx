const tools = [
  { id: 'annotate', label: 'Comments', icon: 'C' }
]

export default function ToolRail({ activeTool = 'annotate', onSelectTool }) {
  return (
    <nav className="tool-rail" aria-label="PaperSmith tools">
      <div className="tool-rail-group">
        {tools.map((tool) => (
          <ToolButton key={tool.id} tool={tool} activeTool={activeTool} onSelectTool={onSelectTool} />
        ))}
      </div>
    </nav>
  )
}

function ToolButton({ tool, activeTool, onSelectTool }) {
  const isActive = activeTool === tool.id

  return (
    <button
      aria-label={tool.label}
      aria-pressed={isActive}
      className="tool-button"
      title={tool.label}
      type="button"
      onClick={() => onSelectTool?.(tool.id)}
    >
      <span className="tool-icon" aria-hidden="true">
        {tool.icon}
      </span>
      <span className="tool-label">{tool.label}</span>
    </button>
  )
}
