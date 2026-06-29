import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('PaperSmith skill contracts', () => {
  it('forbids opening PaperSmith in the system default browser before using the in-app browser', () => {
    const skill = readSkill('papersmith-open-editor')

    expect(skill).toContain('先验证服务已经可达，再打开 Codex in-app browser')
    expect(skill).toContain('不要调用系统默认浏览器')
    expect(skill).toContain('不要先打开外置浏览器再切回 Codex in-app browser')
    expect(skill).toContain('不要使用 `start`、`Start-Process`、`explorer`、`open` 或 URL 直接启动命令打开网页')
  })

  it('defines the active writing workflow for PaperSmith auto-sync responses', () => {
    const skill = readSkill('papersmith-live-draft-sync')

    expect(skill).toContain('PaperSmith 已经打开或本轮任务明确处在 PaperSmith 写作流程中')
    expect(skill).toContain('给我正文、发给我 introduction、输出或返回论文段落')
    expect(skill).toContain('先在 Codex 聊天框输出正文')
    expect(skill).toContain('然后调用 `insert_papersmith_text`')
    expect(skill).toContain('最后再输出正文之外的说明、修改理由、提醒或下一步')
    expect(skill).toContain('不要把说明、计划、命令、调试日志或元信息同步到 PaperSmith')
  })

  it('routes active PaperSmith writing requests to the live draft sync workflow', () => {
    const skill = readSkill('papersmith')

    expect(skill).toContain('PaperSmith 已经打开后，用户要求写正文、给我正文、发给我 introduction、输出或返回论文段落、改正文、润色正文、生成论文段落或修订稿')
    expect(skill).toContain('给我正文、发给我 introduction、输出或返回论文段落')
    expect(skill).toContain('papersmith-live-draft-sync')
    expect(skill).not.toContain('或已经处在 PaperSmith 写作流程中并要求 Codex 生成正文/修订稿')
  })

  it('marks the session as PaperSmith writing mode after opening the editor', () => {
    const skill = readSkill('papersmith-open-editor')

    expect(skill).toContain('成功打开后，明确告诉用户当前 session 已进入 PaperSmith 写作模式')
    expect(skill).toContain('后续让我生成、给出、发给你、输出或返回论文正文时，默认使用 `papersmith-live-draft-sync`')
  })

  it('does not ignore the PaperSmith root skill directory', () => {
    const gitignore = readFileSync('.gitignore', 'utf8')

    expect(gitignore).toContain('/papersmith/')
    expect(gitignore).not.toMatch(/^papersmith\/$/m)
  })
})

function readSkill(name) {
  return readFileSync(`skills/${name}/SKILL.md`, 'utf8')
}
