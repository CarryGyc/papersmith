const tools = [
  { id: 'insert', label: 'Insert', icon: '+' },
  { id: 'annotate', label: 'Annotate', icon: 'A' },
  { id: 'format', label: 'Format', icon: 'T' },
  { id: 'cite', label: 'Cite', icon: 'C' },
  { id: 'outline', label: 'Outline', icon: '#' },
  { id: 'export', label: 'Export', icon: 'E' }
]

const settingsTool = { id: 'settings', label: 'Settings', icon: '*' }

export default function ToolRail({ activeTool = 'annotate', onSelectTool }) {
  return (
    <nav className="tool-rail" aria-label="PaperSmith tools">
      <div className="tool-rail-group">
        {tools.map((tool) => (
          <ToolButton key={tool.id} tool={tool} activeTool={activeTool} onSelectTool={onSelectTool} />
        ))}
      </div>
      <div className="tool-rail-bottom">
        <ToolButton tool={settingsTool} activeTool={activeTool} onSelectTool={onSelectTool} />
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
