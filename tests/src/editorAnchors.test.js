import { describe, expect, it, vi } from 'vitest'
import { selectionToAnchorPayload } from '../../src/lib/editorAnchors.js'

describe('editor anchor helpers', () => {
  it('converts a ProseMirror selection into a canonical API payload', () => {
    const textBetween = vi.fn(() => 'text:5-12')
    const getText = vi.fn(() => {
      throw new Error('getText should not be called')
    })
    const editor = {
      state: {
        selection: { from: 5, to: 12 },
        doc: { textBetween }
      },
      getText
    }

    expect(selectionToAnchorPayload(editor, 4)).toEqual({
      text: 'text:5-12',
      range: { from: 5, to: 12 },
      docVersion: 4
    })
    expect(textBetween).toHaveBeenCalledWith(5, 12, '\n', '\n')
    expect(getText).not.toHaveBeenCalled()
  })

  it('returns an empty payload for collapsed selections', () => {
    const editor = {
      state: {
        selection: { from: 8, to: 8 },
        doc: { textBetween: vi.fn(() => '') }
      },
      getText: () => ''
    }

    expect(selectionToAnchorPayload(editor, 1)).toEqual({ text: '', range: null, docVersion: 1 })
  })

  it('defaults invalid or missing document versions to 1', () => {
    for (const docVersion of [undefined, 0, -2, 1.5]) {
      const editor = {
        state: {
          selection: { from: 5, to: 12 },
          doc: { textBetween: vi.fn(() => 'text:5-12') }
        }
      }

      expect(selectionToAnchorPayload(editor, docVersion)).toEqual({
        text: 'text:5-12',
        range: { from: 5, to: 12 },
        docVersion: 1
      })
    }
  })

  it('returns an empty payload for fractional or negative ranges', () => {
    for (const selection of [
      { from: -1, to: 8 },
      { from: 1.5, to: 8 },
      { from: 1, to: 8.5 }
    ]) {
      const textBetween = vi.fn(() => 'ignored')
      const editor = {
        state: {
          selection,
          doc: { textBetween }
        }
      }

      expect(selectionToAnchorPayload(editor, 2)).toEqual({ text: '', range: null, docVersion: 2 })
      expect(textBetween).not.toHaveBeenCalled()
    }
  })
})
