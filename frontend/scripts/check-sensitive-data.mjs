import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const readableExtensions = new Set(['.css', '.html', '.js', '.json', '.log', '.map', '.mjs', '.txt'])
const forbidden = [
  { name: 'JWT-shaped token', pattern: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { name: 'S3 signed URL', pattern: /X-Amz-(?:Signature|Credential)=[A-Za-z0-9%/_+-]{8,}/gi },
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'literal bearer credential', pattern: /Bearer\s+[A-Za-z0-9._~-]{20,}/g },
  { name: 'literal password', pattern: /(?:password|privateNotes|rawCvText|fullPrompt)\s*[:=]\s*["'][^"']{4,}["']/gi },
]

async function filesUnder(target) {
  const targetStat = await stat(target)
  if (targetStat.isFile()) return [target]
  const entries = await readdir(target, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => filesUnder(path.join(target, entry.name))))
  return nested.flat()
}

const targets = process.argv.slice(2)
const requestedTargets = targets.length ? targets : ['dist']
const findings = []

for (const target of requestedTargets) {
  let files
  try {
    files = await filesUnder(path.resolve(target))
  } catch (error) {
    findings.push(`${target}: unavailable (${error instanceof Error ? error.message : 'unknown error'})`)
    continue
  }
  for (const file of files) {
    if (!readableExtensions.has(path.extname(file).toLowerCase())) continue
    const content = await readFile(file, 'utf8')
    for (const rule of forbidden) {
      rule.pattern.lastIndex = 0
      if (rule.pattern.test(content)) findings.push(`${path.relative(process.cwd(), file)}: ${rule.name}`)
    }
  }
}

if (findings.length) {
  process.stderr.write(`Sensitive-data scan failed:\n${findings.map((finding) => `- ${finding}`).join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`Sensitive-data scan passed for ${requestedTargets.join(', ')}\n`)
}
