import { describe, expect, it } from 'vitest'
import { buildFeedbackMarkdown } from '../../src/lib/feedbackMarkdown.js'

describe('feedback markdown', () => {
  it('exports a professional revision brief with original text, overall comment, and anchored local comments', () => {
    const markdown = buildFeedbackMarkdown(
      {
        document: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Draft Title' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'You should revise this sentence.' }] }
          ]
        },
        annotations: [
          {
            id: 'ann_1',
            comment: '需要换成更正式的表达。',
            anchor: { text: 'You' },
            range: { from: 1, to: 4 }
          }
        ]
      },
      '让未标注部分更符合论文写作语气。'
    )

    expect(markdown).toContain('# PaperSmith Revision Feedback')
    expect(markdown).toContain('请严格区分局部批注与整体批注的作用范围。')
    expect(markdown).toContain('Local Comments 只适用于其对应的“标注文本”。')
    expect(markdown).toContain('Overall Comment 只适用于未被 Local Comments 覆盖的其他内容。')
    expect(markdown).toContain('让未标注部分更符合论文写作语气。')
    expect(markdown).toContain('Draft Title')
    expect(markdown).toContain('You should revise this sentence.')
    expect(markdown).toContain('1. 标注文本：You')
    expect(markdown).toContain('Comment：请按这个要求改这部分：需要换成更正式的表达。')
    expect(markdown).not.toContain('Anchor:')
    expect(markdown).not.toContain('from')
  })

  it('states that unmarked text should not be rewritten when the overall comment is empty', () => {
    const markdown = buildFeedbackMarkdown({
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Only local changes.' }] }] },
      annotations: []
    })

    expect(markdown).toContain('如果 Overall Comment 为空，请不要对未标注内容进行整体性改写。')
    expect(markdown).toContain('（无整体修改意见。请不要对未标注内容进行整体性改写。）')
    expect(markdown).toContain('（无局部批注。）')
  })
})
