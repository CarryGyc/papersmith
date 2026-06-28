import { join, resolve } from 'node:path'

export function resolveProjectDir(env = process.env, cwd = process.cwd()) {
  return resolve(cwd, env.PAPERSMITH_PROJECT_DIR || '.')
}

export function resolveStateDir(env = process.env, cwd = process.cwd()) {
  if (env.PAPERSMITH_STATE_DIR) return resolve(cwd, env.PAPERSMITH_STATE_DIR)
  return join(resolveProjectDir(env, cwd), 'papersmith')
}

export function resolveStateFiles(env = process.env, cwd = process.cwd()) {
  const stateDir = resolveStateDir(env, cwd)
  return {
    stateDir,
    documentFile: join(stateDir, 'document.json'),
    selectionFile: join(stateDir, 'selection.json'),
    viewStateFile: join(stateDir, 'view-state.json')
  }
}
