import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveExcelSources, expectedBooks } from './resolve-excel-sources.mjs'

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'jv-resolver-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  for (const spec of Object.values(expectedBooks)) writeFileSync(join(dir, spec.name), `test source ${spec.name}`)
  return dir
}

test('discovers both workbooks in the repository parent', (t) => {
  const parent = fixture(t), repo = join(parent, 'repo')
  mkdirSync(repo)
  const found = resolveExcelSources({ repoRoot: repo, env: {} })
  assert.equal(found.completion.path, join(parent, expectedBooks.completion.name))
  assert.equal(found.retail.hashMatchesExpected, false)
})

test('explicit paths take precedence and are hash checked', (t) => {
  const dir = fixture(t)
  const found = resolveExcelSources({ repoRoot: join(dir, 'repo'), env: { JV_EXCEL_COMPLETION: join(dir, expectedBooks.completion.name), JV_EXCEL_RETAIL: join(dir, expectedBooks.retail.name) } })
  assert.equal(found.completion.path, join(dir, expectedBooks.completion.name))
})

test('missing workbook reports configuration and search locations', () => {
  assert.throws(() => resolveExcelSources({ repoRoot: join(tmpdir(), 'jv-definitely-missing'), env: {} }), /not found.*JV_EXCEL_COMPLETION/s)
})

test('wrong SHA is returned explicitly, not silently accepted', (t) => {
  const dir = fixture(t), bad = join(dir, 'copy.xlsm')
  copyFileSync(join(dir, expectedBooks.completion.name), bad)
  const found = resolveExcelSources({ repoRoot: join(dir, 'repo'), env: { JV_EXCEL_COMPLETION: bad, JV_EXCEL_RETAIL: join(dir, expectedBooks.retail.name) } })
  assert.equal(found.completion.hashMatchesExpected, false)
})

test('duplicate copies are rejected as ambiguous', (t) => {
  const dir = fixture(t), other = join(dir, 'other')
  mkdirSync(other)
  for (const spec of Object.values(expectedBooks)) copyFileSync(join(dir, spec.name), join(other, spec.name))
  assert.throws(() => resolveExcelSources({ repoRoot: dir, env: {}, knownDirs: [other] }), /Ambiguous/)
})
