import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveProjectDir, resolveStateDir, resolveStateFiles } from '../../server/paths.js'

describe('state path helpers', () => {
  it('resolves relative project directories from the supplied cwd', () => {
    const cwd = join(process.cwd(), 'virtual-cwd')

    expect(resolveProjectDir({ PAPERSMITH_PROJECT_DIR: 'paper-project' }, cwd)).toBe(join(cwd, 'paper-project'))
  })

  it('resolves relative state directories from the supplied cwd', () => {
    const cwd = join(process.cwd(), 'virtual-cwd')

    expect(resolveStateDir({ PAPERSMITH_STATE_DIR: 'paper-state' }, cwd)).toBe(join(cwd, 'paper-state'))
  })

  it('resolves default state directories under the resolved project directory', () => {
    const cwd = join(process.cwd(), 'virtual-cwd')

    expect(resolveStateDir({ PAPERSMITH_PROJECT_DIR: 'paper-project' }, cwd)).toBe(
      join(cwd, 'paper-project', 'papersmith')
    )
  })

  it('resolves state file paths from the resolved state directory', () => {
    const cwd = join(process.cwd(), 'virtual-cwd')
    const stateDir = join(cwd, 'paper-state')

    expect(resolveStateFiles({ PAPERSMITH_STATE_DIR: 'paper-state' }, cwd)).toEqual({
      stateDir,
      documentFile: join(stateDir, 'document.json'),
      selectionFile: join(stateDir, 'selection.json'),
      viewStateFile: join(stateDir, 'view-state.json')
    })
  })
})
