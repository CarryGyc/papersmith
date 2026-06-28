#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const PLUGIN_NAME = 'papersmith'
const MARKETPLACE_ENTRY_PATH = `./plugins/${PLUGIN_NAME}`
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (isMainModule()) {
  main()
}

function main() {
  const homeDir = path.resolve(process.env.PAPERSMITH_INSTALL_HOME || os.homedir())
  const codexHome = path.resolve(process.env.CODEX_HOME || path.join(homeDir, '.codex'))
  const targetRoot = path.resolve(process.env.PAPERSMITH_PLUGIN_DIR || path.join(homeDir, 'plugins', PLUGIN_NAME))
  const marketplacePath = path.resolve(
    process.env.PAPERSMITH_MARKETPLACE_PATH || path.join(homeDir, '.agents', 'plugins', 'marketplace.json')
  )
  const configPath = path.resolve(process.env.PAPERSMITH_CODEX_CONFIG || path.join(codexHome, 'config.toml'))

  copyPlugin(sourceRoot, targetRoot)
  if (process.env.PAPERSMITH_SKIP_NPM_INSTALL !== '1') {
    installDependencies(targetRoot)
  }
  const marketplaceName = updateMarketplace(marketplacePath)
  if (process.env.PAPERSMITH_SKIP_CODEX_CONFIG !== '1') {
    enablePlugin(configPath, marketplaceName)
  }

  console.log('')
  console.log('PaperSmith installed.')
  console.log(`Plugin: ${targetRoot}`)
  console.log(`Marketplace: ${marketplacePath}`)
  console.log(`Codex config: ${configPath}`)
  console.log('')
  console.log('Restart Codex, then start a new thread and ask Codex to open PaperSmith.')
  console.log(`To run the editor manually: cd "${targetRoot}" && npm run dev`)
}

function copyPlugin(source, target) {
  if (samePath(source, target)) {
    console.log(`Using existing plugin directory: ${target}`)
    return
  }

  if (fs.existsSync(target)) {
    assertSafeExistingTarget(target)
    fs.rmSync(target, { recursive: true, force: true })
  }

  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.cpSync(source, target, {
    recursive: true,
    filter: (candidate) => shouldCopy(candidate, source)
  })
}

function shouldCopy(candidate, root) {
  const relative = path.relative(root, candidate)
  if (!relative) return true

  const firstPart = relative.split(path.sep)[0]
  return !new Set([
    '.git',
    '.agents',
    '.codex',
    '.superpowers',
    'coverage',
    'dist',
    'node_modules',
    'papersmith',
    'playwright-report',
    'test-results',
    '.vite'
  ]).has(firstPart)
}

function assertSafeExistingTarget(target) {
  const manifestPath = path.join(target, '.codex-plugin', 'plugin.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Refusing to replace ${target}: no .codex-plugin/plugin.json marker found.`)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.name !== PLUGIN_NAME) {
    throw new Error(`Refusing to replace ${target}: plugin name is ${JSON.stringify(manifest.name)}.`)
  }
}

function installDependencies(target) {
  const npmInvocation = resolveNpmInvocation()
  const result = spawnSync(npmInvocation.command, [...npmInvocation.args, 'install', '--include=dev'], {
    cwd: target,
    stdio: 'inherit',
    shell: false
  })

  if (result.error) {
    throw new Error(`npm install failed in the installed PaperSmith plugin directory: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error('npm install failed in the installed PaperSmith plugin directory.')
  }
}

export function resolveNpmInvocation({
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
  fileExists = fs.existsSync
} = {}) {
  if (isJavaScriptFile(env.npm_execpath)) {
    return { command: execPath, args: [env.npm_execpath] }
  }

  const npmCliPath = path.join(path.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (fileExists(npmCliPath)) {
    return { command: execPath, args: [npmCliPath] }
  }

  if (platform === 'win32') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'npm.cmd'] }
  }

  return { command: 'npm', args: [] }
}

function isJavaScriptFile(filePath) {
  return typeof filePath === 'string' && ['.js', '.cjs', '.mjs'].includes(path.extname(filePath).toLowerCase())
}

function updateMarketplace(marketplacePath) {
  const marketplace = readJsonOrDefault(marketplacePath, {
    name: 'personal',
    interface: { displayName: 'Personal' },
    plugins: []
  })

  if (!marketplace.name || typeof marketplace.name !== 'string') {
    marketplace.name = 'personal'
  }
  if (!marketplace.interface || typeof marketplace.interface !== 'object' || Array.isArray(marketplace.interface)) {
    marketplace.interface = { displayName: 'Personal' }
  }
  if (!marketplace.interface.displayName) {
    marketplace.interface.displayName = titleCase(marketplace.name)
  }
  if (!Array.isArray(marketplace.plugins)) {
    marketplace.plugins = []
  }

  const entry = {
    name: PLUGIN_NAME,
    source: {
      source: 'local',
      path: MARKETPLACE_ENTRY_PATH
    },
    policy: {
      installation: 'AVAILABLE',
      authentication: 'ON_INSTALL'
    },
    category: 'Productivity'
  }

  const existingIndex = marketplace.plugins.findIndex((plugin) => plugin?.name === PLUGIN_NAME)
  if (existingIndex === -1) {
    marketplace.plugins.push(entry)
  } else {
    marketplace.plugins[existingIndex] = {
      ...marketplace.plugins[existingIndex],
      ...entry
    }
  }

  writeJson(marketplacePath, marketplace)
  return marketplace.name
}

function enablePlugin(configPath, marketplaceName) {
  const section = `[plugins."${PLUGIN_NAME}@${marketplaceName}"]`
  const nextBlock = `${section}\nenabled = true\n`

  let text = ''
  if (fs.existsSync(configPath)) {
    text = fs.readFileSync(configPath, 'utf8')
  }

  if (!text.trim()) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, `${nextBlock}`, 'utf8')
    return
  }

  if (!text.includes(section)) {
    const separator = text.endsWith('\n') ? '\n' : '\n\n'
    fs.writeFileSync(configPath, `${text}${separator}${nextBlock}`, 'utf8')
    return
  }

  const lines = text.split(/\r?\n/)
  let insideSection = false
  let wroteEnabled = false
  const nextLines = []

  for (const line of lines) {
    if (line.trim().startsWith('[')) {
      if (insideSection && !wroteEnabled) {
        nextLines.push('enabled = true')
        wroteEnabled = true
      }
      insideSection = line.trim() === section
    }

    if (insideSection && line.trim().startsWith('enabled')) {
      nextLines.push('enabled = true')
      wroteEnabled = true
    } else {
      nextLines.push(line)
    }
  }

  if (insideSection && !wroteEnabled) {
    nextLines.push('enabled = true')
  }

  fs.writeFileSync(configPath, nextLines.join('\n'), 'utf8')
}

function readJsonOrDefault(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function samePath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
}

function titleCase(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1] || '').href
}
