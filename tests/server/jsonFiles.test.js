import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readJsonFile, writeJsonAtomic } from '../../server/jsonFiles.js'

const tempDirs = []

async function makeTempDir() {
  const tempDir = await mkdtemp(join(tmpdir(), 'papersmith-json-'))
  tempDirs.push(tempDir)
  return tempDir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })))
})

describe('json file helpers', () => {
  it('writes formatted JSON atomically and reads it back', async () => {
    const tempDir = await makeTempDir()
    const filePath = join(tempDir, 'nested', 'document.json')

    await writeJsonAtomic(filePath, { ok: true, count: 2 })
    const raw = await readFile(filePath, 'utf8')
    const parsed = await readJsonFile(filePath)

    expect(raw.endsWith('\n')).toBe(true)
    expect(raw).toContain('\n  "ok": true,')
    expect(parsed).toEqual({ ok: true, count: 2 })
  })

  it('returns fallback for missing JSON when provided', async () => {
    const tempDir = await makeTempDir()
    await mkdir(tempDir, { recursive: true })

    await expect(readJsonFile(join(tempDir, 'missing.json'), { fallback: { empty: true } })).resolves.toEqual({
      empty: true
    })
  })

  it('rejects missing JSON when no fallback is provided', async () => {
    const tempDir = await makeTempDir()

    await expect(readJsonFile(join(tempDir, 'missing.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects invalid JSON even when a fallback is provided', async () => {
    const tempDir = await makeTempDir()
    const filePath = join(tempDir, 'invalid.json')
    await writeFile(filePath, '{ invalid json', 'utf8')

    await expect(readJsonFile(filePath, { fallback: { empty: true } })).rejects.toBeInstanceOf(SyntaxError)
  })

  it('overwrites an existing JSON target atomically', async () => {
    const tempDir = await makeTempDir()
    const filePath = join(tempDir, 'document.json')

    await writeJsonAtomic(filePath, { draft: 1 })
    await writeJsonAtomic(filePath, { draft: 2 })

    await expect(readJsonFile(filePath)).resolves.toEqual({ draft: 2 })
  })

  it('handles concurrent writes to the same file without temp path collisions', async () => {
    const tempDir = await makeTempDir()
    const filePath = join(tempDir, 'nested', 'document.json')
    const payloads = Array.from({ length: 64 }, (_, index) => ({
      index,
      content: `${index}:`.padEnd(32 * 1024, 'x')
    }))

    await expect(Promise.all(payloads.map((payload) => writeJsonAtomic(filePath, payload)))).resolves.toHaveLength(
      payloads.length
    )

    const parsed = await readJsonFile(filePath)
    const files = await readdir(dirname(filePath))

    expect(payloads).toContainEqual(parsed)
    expect(files.filter((fileName) => fileName.endsWith('.tmp'))).toEqual([])
  })
})
