import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const expectedBooks = {
  completion: { name: 'JV-комплектация 08.10.2026.xlsm', sha256: '62dd6d49f059bef840b67713a0ea6a9f1dec0ec90cf364563cf423dac376d2d8' },
  retail: { name: 'JV-розница 08.10.2026.xlsm', sha256: '025d7e2911176ca0b0cdb445574565cd8e3f44d814905cd4c474999630c7ab41' },
}

export function resolveExcelSources({ repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), env = process.env, knownDirs = [] } = {}) {
  const configuredDir = env.JV_EXCEL_SOURCE_DIR
  const roots = [...new Set([
    ...(configuredDir ? [resolve(configuredDir)] : []), resolve(repoRoot), dirname(resolve(repoRoot)),
    ...knownDirs.map((dir) => resolve(dir)),
  ])]
  const result = {}
  for (const [key, spec] of Object.entries(expectedBooks)) {
    const explicit = env[key === 'completion' ? 'JV_EXCEL_COMPLETION' : 'JV_EXCEL_RETAIL']
    const candidates = explicit && existsSync(resolve(explicit))
      ? [resolve(explicit)]
      : roots.map((root) => join(root, spec.name))
    const found = [...new Set(candidates.filter(existsSync))]
    if (!found.length) throw new Error(`${spec.name} not found. Set JV_EXCEL_${key === 'completion' ? 'COMPLETION' : 'RETAIL'} or JV_EXCEL_SOURCE_DIR; searched: ${candidates.join(', ')}`)
    if (found.length > 1) throw new Error(`Ambiguous ${spec.name}; multiple copies found: ${found.join(', ')}`)
    const path = found[0]
    const sha256 = createHash('sha256').update(readFileSync(path)).digest('hex')
    result[key] = { path, sha256, hashMatchesExpected: sha256 === spec.sha256 }
  }
  return result
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(resolveExcelSources(), null, 2)) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
