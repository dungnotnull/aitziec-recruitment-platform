import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const createdDirectories: string[] = []

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function fixture(content: string) {
  const directory = await mkdtemp(path.join(tmpdir(), 'itziec-sensitive-scan-'))
  createdDirectories.push(directory)
  await writeFile(path.join(directory, 'artifact.js'), content, 'utf8')
  return directory
}

describe('check-sensitive-data script', () => {
  it('passes artifacts that contain only safe UI content', async () => {
    const directory = await fixture('console.info("frontend release loaded")')
    const result = await execFileAsync(process.execPath, ['scripts/check-sensitive-data.mjs', directory])
    expect(result.stdout).toContain('Sensitive-data scan passed')
  })

  it('fails an artifact containing a token-shaped value', async () => {
    const directory = await fixture('const leaked = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature123"')
    await expect(execFileAsync(process.execPath, ['scripts/check-sensitive-data.mjs', directory]))
      .rejects.toMatchObject({ code: 1 })
  })

  it('fails an artifact containing a signed object URL', async () => {
    const directory = await fixture('https://storage.example/cv.pdf?X-Amz-Signature=abcdef123456')
    await expect(execFileAsync(process.execPath, ['scripts/check-sensitive-data.mjs', directory]))
      .rejects.toMatchObject({ code: 1 })
  })
})
