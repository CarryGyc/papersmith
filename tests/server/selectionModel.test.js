import { describe, expect, it } from 'vitest'
import { normalizeSelectionState } from '../../server/selectionModel.js'

describe('selection model', () => {
  it('normalizes a selected text range', () => {
    const selection = normalizeSelectionState({
      text: 'retrieval practice improves retention',
      range: { from: 120, to: 156 },
      docVersion: 3
    })

    expect(selection.hasSelection).toBe(true)
    expect(selection.text).toBe('retrieval practice improves retention')
    expect(selection.range).toEqual({ from: 120, to: 156 })
    expect(selection.docVersion).toBe(3)
  })

  it('returns an empty selection for collapsed or missing ranges', () => {
    const selection = normalizeSelectionState({ text: '', range: { from: 10, to: 10 } })

    expect(selection.hasSelection).toBe(false)
    expect(selection.text).toBe('')
    expect(selection.range).toBeNull()
  })

  it('preserves selected text whitespace while using trimmed text only for emptiness', () => {
    const selection = normalizeSelectionState({
      text: '  retrieval practice  ',
      range: { from: 3, to: 23 },
      docVersion: 2
    })

    expect(selection.hasSelection).toBe(true)
    expect(selection.text).toBe('  retrieval practice  ')
  })

  it('defaults invalid or missing document versions to 1', () => {
    for (const docVersion of [undefined, 0, -2, 1.5]) {
      const selection = normalizeSelectionState({
        text: 'retention',
        range: { from: 1, to: 10 },
        docVersion
      })

      expect(selection.docVersion).toBe(1)
    }
  })

  it('rejects fractional and negative ranges', () => {
    for (const range of [
      { from: -1, to: 8 },
      { from: 1.5, to: 8 },
      { from: 1, to: 8.5 }
    ]) {
      const selection = normalizeSelectionState({ text: 'retention', range })

      expect(selection.hasSelection).toBe(false)
      expect(selection.text).toBe('')
      expect(selection.range).toBeNull()
    }
  })

  it('returns an empty selection for non-object input and non-string text', () => {
    const fromNull = normalizeSelectionState(null)
    const fromNonStringText = normalizeSelectionState({ text: 42, range: { from: 1, to: 3 } })

    expect(fromNull.hasSelection).toBe(false)
    expect(fromNull.text).toBe('')
    expect(fromNull.range).toBeNull()
    expect(fromNonStringText.hasSelection).toBe(false)
    expect(fromNonStringText.text).toBe('')
    expect(fromNonStringText.range).toBeNull()
  })
})
