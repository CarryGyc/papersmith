import { describe, expect, it } from 'vitest'
import { createAnnotation } from '../../server/annotationModel.js'

describe('annotation model', () => {
  it('creates an annotation anchored to selected text', () => {
    const annotation = createAnnotation(
      {
        type: 'clarity',
        comment: 'Define the retention window.',
        selection: {
          text: 'long-term retention',
          range: { from: 42, to: 61 },
          docVersion: 1
        }
      },
      new Date('2026-06-28T00:00:00.000Z')
    )

    expect(annotation.id).toMatch(/^ann_/)
    expect(annotation.type).toBe('clarity')
    expect(annotation.anchor.text).toBe('long-term retention')
    expect(annotation.status).toBe('anchored')
  })

  it('preserves selected text whitespace on the anchor', () => {
    const annotation = createAnnotation({
      comment: 'Keep the exact selected text.',
      selection: {
        text: '  long-term retention  ',
        range: { from: 42, to: 65 },
        docVersion: 2
      }
    })

    expect(annotation.anchor.text).toBe('  long-term retention  ')
  })

  it('rejects annotations without selected text', () => {
    expect(() => createAnnotation({ comment: 'No anchor', selection: { text: '', range: null } })).toThrow(
      'Cannot create annotation without selected text.'
    )
  })

  it('rejects non-string selection text', () => {
    expect(() =>
      createAnnotation({
        comment: 'No text anchor',
        selection: { text: 42, range: { from: 1, to: 3 } }
      })
    ).toThrow('Cannot create annotation without selected text.')
  })

  it('rejects empty or whitespace-only comments', () => {
    for (const comment of [undefined, '', '   ']) {
      expect(() =>
        createAnnotation({
          comment,
          selection: { text: 'long-term retention', range: { from: 42, to: 61 } }
        })
      ).toThrow('Annotation comment is required.')
    }
  })

  it('defaults invalid or missing document versions to 1', () => {
    for (const docVersion of [undefined, 0, -2, 1.5]) {
      const annotation = createAnnotation({
        comment: 'Normalize version',
        selection: {
          text: 'long-term retention',
          range: { from: 42, to: 61 },
          docVersion
        }
      })

      expect(annotation.anchor.docVersion).toBe(1)
    }
  })

  it('rejects fractional and negative anchor ranges', () => {
    for (const range of [
      { from: -1, to: 8 },
      { from: 1.5, to: 8 },
      { from: 1, to: 8.5 }
    ]) {
      expect(() =>
        createAnnotation({
          comment: 'Invalid range',
          selection: { text: 'retention', range }
        })
      ).toThrow('Cannot create annotation without selected text.')
    }
  })

  it('throws a controlled validation error for non-object annotation input', () => {
    expect(() => createAnnotation(null)).toThrow('Cannot create annotation without selected text.')
  })
})
