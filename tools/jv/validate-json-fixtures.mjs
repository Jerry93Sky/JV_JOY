import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/jv/fixtures')
const files = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
const failures = []
for (const file of files) {
  const fullPath = path.join(root, file.name)
  try {
    JSON.parse(await readFile(fullPath, 'utf8'))
  } catch (error) {
    failures.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Validated ${files.length} JV fixture JSON files.`)
}
