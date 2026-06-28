import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EditorSurface from '../../src/components/EditorSurface.jsx'

afterEach(() => {
  cleanup()
})

describe('EditorSurface', () => {
  it('renders formatting controls and document content', async () => {
    render(
      <EditorSurface
        documentPayload={{
          version: 1,
          metadata: { title: 'Paper Title' },
          document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body copy' }] }] },
          annotations: []
        }}
        onChange={vi.fn()}
        onSelectionChange={vi.fn()}
      />
    )

    expect(screen.getByRole('toolbar', { name: 'Formatting toolbar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false')
    expect(await screen.findByText('Body copy')).toBeInTheDocument()
  })

  it('syncs external document content without emitting a change', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <EditorSurface
        documentPayload={{
          version: 1,
          metadata: { title: 'Paper Title' },
          document: paragraphDocument('Initial copy'),
          annotations: []
        }}
        onChange={onChange}
        onSelectionChange={vi.fn()}
      />
    )

    expect(await screen.findByText('Initial copy')).toBeInTheDocument()
    onChange.mockClear()

    rerender(
      <EditorSurface
        documentPayload={{
          version: 2,
          metadata: { title: 'Paper Title' },
          document: paragraphDocument('Synced copy'),
          annotations: []
        }}
        onChange={onChange}
        onSelectionChange={vi.fn()}
      />
    )

    expect(await screen.findByText('Synced copy')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('updates toolbar pressed state after toggling bold', async () => {
    render(
      <EditorSurface
        documentPayload={{
          version: 1,
          metadata: { title: 'Paper Title' },
          document: paragraphDocument('Body copy'),
          annotations: []
        }}
        onChange={vi.fn()}
        onSelectionChange={vi.fn()}
      />
    )

    const boldButton = screen.getByRole('button', { name: 'Bold' })
    expect(boldButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(boldButton)

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')
  })
})

function paragraphDocument(text) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}
