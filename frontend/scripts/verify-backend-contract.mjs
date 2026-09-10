import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])

function normalizePath(value) {
  return value.replace(/\{[^/}]+\}/g, '{param}').replace(/\/$/, '') || '/'
}

export function compareBackendContract(openApi, requirements) {
  const available = new Set()
  for (const [routePath, operations] of Object.entries(openApi?.paths ?? {})) {
    for (const method of Object.keys(operations ?? {})) {
      if (HTTP_METHODS.has(method.toLowerCase())) {
        available.add(`${method.toUpperCase()} ${normalizePath(routePath)}`)
      }
    }
  }

  const result = { missing: [], present: [] }
  for (const requirement of requirements) {
    const display = `${requirement.method.toUpperCase()} ${requirement.path}`
    const normalized = `${requirement.method.toUpperCase()} ${normalizePath(requirement.path)}`
    result[available.has(normalized) ? 'present' : 'missing'].push(display)
  }
  return result
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
  const manifestPath = path.resolve(scriptDirectory, '../contracts/backend-required-endpoints.json')
  const requirements = JSON.parse(await readFile(manifestPath, 'utf8'))
  const url = process.env.BACKEND_OPENAPI_URL ?? 'http://127.0.0.1:4000/api/docs-json'
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Swagger request failed with HTTP ${response.status}`)
  }
  const result = compareBackendContract(await response.json(), requirements)
  if (result.missing.length > 0) {
    process.stderr.write(`Backend contract is missing ${result.missing.length} required endpoint(s):\n${result.missing.join('\n')}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write(`Backend contract exposes all ${result.present.length} required frontend endpoints.\n`)
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null
if (entryPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`Backend contract verification failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
