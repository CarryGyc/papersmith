import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export async function readJsonFile(filePath, options = {}) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT' && Object.hasOwn(options, 'fallback')) return options.fallback
    throw error
  }
}

export async function writeJsonAtomic(filePath, payload) {
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`

  try {
    await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    await renameWithRetry(tempPath, filePath)
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {})
    throw error
  }
}

async function renameWithRetry(sourcePath, targetPath) {
  const maxRetries = 10

  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(sourcePath, targetPath)
      return
    } catch (error) {
      if (!isTransientRenameError(error) || attempt >= maxRetries) throw error
      await delay((attempt + 1) * 5)
    }
  }
}

function isTransientRenameError(error) {
  return error && ['EACCES', 'EBUSY', 'EPERM'].includes(error.code)
}
