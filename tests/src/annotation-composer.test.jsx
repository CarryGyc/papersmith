import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AnnotationComposer from '../../src/components/AnnotationComposer.jsx'

afterEach(() => {
  cleanup()
})

describe('AnnotationComposer', () => {
  it('renders nothing without an active selection', () => {
    const { container } = render(<AnnotationComposer selection={{ hasSelection: false }} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('disables saving until a comment has non-whitespace text', async () => {
    const user = userEvent.setup()
    render(<AnnotationComposer selection={selectionPayload()} onSubmit={() => {}} onCancel={() => {}} />)

    const saveButton = screen.getByRole('button', { name: 'Save annotation' })
    expect(screen.getByText('selected evidence')).toBeInTheDocument()
    expect(saveButton).toBeDisabled()

    await user.type(screen.getByLabelText('Annotation comment'), '   ')
    expect(saveButton).toBeDisabled()

    await user.type(screen.getByLabelText('Annotation comment'), 'Clarify scope')
    expect(saveButton).toBeEnabled()
  })

  it('submits trimmed clarity annotations and clears the comment after confirmed success', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => true)
    const selection = selectionPayload()
    render(<AnnotationComposer selection={selection} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.type(screen.getByLabelText('Annotation comment'), '  Define the term.  ')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(onSubmit).toHaveBeenCalledWith({
      type: 'clarity',
      comment: 'Define the term.',
      selection
    })
    expect(screen.getByLabelText('Annotation comment')).toHaveValue('')
  })

  it('keeps the draft when submit is not confirmed', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => false)
    render(<AnnotationComposer selection={selectionPayload()} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.type(screen.getByLabelText('Annotation comment'), 'Keep this draft')
    await user.click(screen.getByRole('button', { name: 'Save annotation' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Annotation comment')).toHaveValue('Keep this draft')
  })

  it('disables save while submission is pending', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AnnotationComposer selection={selectionPayload()} isSubmitting onSubmit={onSubmit} onCancel={() => {}} />)

    await user.type(screen.getByLabelText('Annotation comment'), 'Pending draft')
    const saveButton = screen.getByRole('button', { name: 'Save annotation' })

    expect(saveButton).toBeDisabled()
    await user.click(saveButton)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls cancel when the cancel button is pressed', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<AnnotationComposer selection={selectionPayload()} onSubmit={() => {}} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

function selectionPayload() {
  return {
    hasSelection: true,
    text: 'selected evidence',
    range: { from: 10, to: 27 },
    docVersion: 3
  }
}
