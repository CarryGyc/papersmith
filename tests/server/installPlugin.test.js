import { describe, expect, it } from 'vitest'
import { resolveNpmInvocation } from '../../scripts/install-plugin.mjs'

describe('PaperSmith installer npm invocation', () => {
  it('runs npm_execpath through node when npm exposes its JS CLI', () => {
    const invocation = resolveNpmInvocation({
      env: { npm_execpath: 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js' },
      execPath: 'C:\\Program Files\\nodejs\\node.exe',
      platform: 'win32',
      fileExists: () => false
    })

    expect(invocation).toEqual({
      command: 'C:\\Program Files\\nodejs\\node.exe',
      args: ['C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js']
    })
  })

  it('uses the npm CLI JS next to node on Windows before falling back to npm.cmd', () => {
    const invocation = resolveNpmInvocation({
      env: {},
      execPath: 'C:\\Program Files\\nodejs\\node.exe',
      platform: 'win32',
      fileExists: (filePath) => filePath === 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js'
    })

    expect(invocation).toEqual({
      command: 'C:\\Program Files\\nodejs\\node.exe',
      args: ['C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js']
    })
  })

  it('falls back to cmd.exe for npm.cmd on Windows when no JS CLI is discoverable', () => {
    const invocation = resolveNpmInvocation({
      env: {},
      execPath: 'C:\\Portable\\node.exe',
      platform: 'win32',
      fileExists: () => false
    })

    expect(invocation).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd']
    })
  })

  it('uses npm directly on non-Windows platforms when no JS CLI is discoverable', () => {
    const invocation = resolveNpmInvocation({
      env: {},
      execPath: '/usr/local/bin/node',
      platform: 'linux',
      fileExists: () => false
    })

    expect(invocation).toEqual({
      command: 'npm',
      args: []
    })
  })
})
