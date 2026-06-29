import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BrandWordmark from '../../src/components/BrandWordmark.jsx'
import ToolRail from '../../src/components/ToolRail.jsx'
import CommandStrip from '../../src/components/CommandStrip.jsx'
import InspectorPanel from '../../src/components/InspectorPanel.jsx'

afterEach(() => {
  cleanup()
})

describe('C2 shell components', () => {
  it('renders the artistic PaperSmith brand wordmark', () => {
    render(<BrandWordmark />)
    expect(screen.getByText('PaperSmith')).toHaveClass('brand-wordmark')
  })

  it('renders tool rail controls', () => {
    render(<ToolRail activeTool="annotate" onSelectTool={() => {}} />)
    expect(screen.getByRole('button', { name: 'Comments' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Insert' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Format' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cite' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Outline' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('updates tool rail pressed state when a tool is selected', () => {
    function ToolRailHarness() {
      const [activeTool, setActiveTool] = useState('annotate')
      return <ToolRail activeTool={activeTool} onSelectTool={setActiveTool} />
    }

    render(<ToolRailHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Comments' }))

    expect(screen.getByRole('button', { name: 'Comments' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders command and sync state', () => {
    render(<CommandStrip syncState="synced" />)
    expect(screen.getByLabelText('Command search')).toBeInTheDocument()
    expect(screen.getByText('Synced')).toBeInTheDocument()
  })

  it('renders sync state and copy feedback without local autosave or draft buttons in the status row', () => {
    const handleCopyFeedback = vi.fn()
    const { container } = render(<CommandStrip syncState="synced" onCopyFeedback={handleCopyFeedback} />)

    const commandPills = container.querySelector('.command-pills')
    expect(Array.from(commandPills.children).map((child) => child.textContent)).toEqual([
      'Synced',
      'Copy feedback'
    ])
    expect(screen.queryByText('Local autosave')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copy feedback' }))
    expect(handleCopyFeedback).toHaveBeenCalledTimes(1)
  })

  it('renders draft versions in a separate dropdown row', () => {
    const handleVersionSelect = vi.fn()
    const { container } = render(
      <CommandStrip
        syncState="synced"
        onCopyFeedback={() => {}}
        versions={[
          { id: 'draft-a', label: 'Draft A' },
          { id: 'draft-b', label: 'Draft B' }
        ]}
        activeVersionId="draft-b"
        onSelectVersion={handleVersionSelect}
      />
    )

    const commandPills = container.querySelector('.command-pills')
    expect(Array.from(commandPills.children).map((child) => child.textContent)).toEqual([
      'Synced',
      'Copy feedback'
    ])
    expect(container.querySelector('.draft-version-row')).toBeInTheDocument()
    expect(screen.getByLabelText('Draft version')).toHaveValue('draft-b')
    expect(screen.getByRole('option', { name: 'Draft A' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Draft B' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Draft version'), { target: { value: 'draft-a' } })
    expect(handleVersionSelect).toHaveBeenCalledWith('draft-a')
  })

  it('renders annotation inspector state', () => {
    render(<InspectorPanel annotations={[{ id: 'ann_1', type: 'clarity', comment: 'Define this term.', anchor: { text: 'long-term retention' } }]} />)
    expect(screen.getAllByText('Comments').length).toBeGreaterThan(0)
    expect(screen.getByText('1 comments')).toBeInTheDocument()
    expect(screen.getByText('Define this term.')).toBeInTheDocument()
    expect(screen.getByText('long-term retention')).toBeInTheDocument()
  })

  it('renders an optional overall comment field in the inspector', () => {
    const handleOverallCommentChange = vi.fn()
    render(<InspectorPanel overallComment="Revise unmarked text only." onOverallCommentChange={handleOverallCommentChange} />)

    expect(screen.getByLabelText('Overall comment')).toHaveValue('Revise unmarked text only.')
    fireEvent.change(screen.getByLabelText('Overall comment'), { target: { value: 'Make unmarked text more academic.' } })
    expect(handleOverallCommentChange).toHaveBeenCalledWith('Make unmarked text more academic.')
  })

  it('shows newest annotations first', () => {
    render(
      <InspectorPanel
        annotations={[
          { id: 'ann_1', type: 'clarity', comment: 'Older comment.', anchor: { text: 'Start' } },
          { id: 'ann_2', type: 'clarity', comment: 'Newer comment.', anchor: { text: 'Smith' } }
        ]}
      />
    )

    const cards = screen.getAllByRole('article')
    expect(cards[0]).toHaveTextContent('Newer comment.')
    expect(cards[1]).toHaveTextContent('Older comment.')
  })

  it('renders only the annotation inspector without the planned Text Info view', () => {
    render(<InspectorPanel />)

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.getByText('Comments')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Text Info' })).not.toBeInTheDocument()
  })

  it('keeps brand and narrow layout CSS from regressing to clipped desktop widths', () => {
    const styles = readFileSync('src/styles.css', 'utf8')

    expect(styles).toContain('--brand-width')
    expect(styles).not.toMatch(/\.brand-zone\s*{[^}]*grid-column:\s*1\s*\/\s*2/)
    expect(styles).toMatch(/@media \(max-width: 600px\)[\s\S]*\.papersmith-app\s*{[\s\S]*min-width:\s*0/)
    expect(styles).toMatch(/@media \(max-width: 600px\)[\s\S]*\.paper-page\s*{[\s\S]*min-width:\s*0/)
  })

  it('positions the annotation composer within the responsive workspace', () => {
    const styles = readFileSync('src/styles.css', 'utf8')

    expect(styles).toMatch(/\.annotation-composer\s*{[\s\S]*position:\s*absolute/)
    expect(styles).toMatch(/\.annotation-composer\s*{[\s\S]*max-width:/)
    expect(styles).not.toMatch(/right:\s*374px/)
  })
})
