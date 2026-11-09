import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const manifestPath = resolve('docs/jv/fixtures/unified-order-all-seven-inputs.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const targetDir = resolve('apps/backend/src/domain/jv/catalogs')
mkdirSync(targetDir, { recursive: true })

for (const profile of ['COMPLETATION', 'RETAIL']) {
  const scenario = manifest.scenarios.find((entry) => entry.profile === profile)
  if (!scenario) throw new Error(`PR_13E manifest has no ${profile} source scenario`)
  const families = {}
  for (const position of scenario.engineInput.positions) {
    const calculation = structuredClone(position.calculation)
    const sources = {}
    if (calculation.priceSnapshot) { sources.priceSnapshot = calculation.priceSnapshot; delete calculation.priceSnapshot }
    if (calculation.glassSnapshot) { sources.glassSnapshot = calculation.glassSnapshot; delete calculation.glassSnapshot }
    if (calculation.paintSnapshot) { sources.paintSnapshot = calculation.paintSnapshot; delete calculation.paintSnapshot }
    if (calculation.snapshot) { sources.snapshot = calculation.snapshot; delete calculation.snapshot }
    if (calculation.commercial?.snapshot) { sources.snapshot = calculation.commercial.snapshot; delete calculation.commercial.snapshot }
    if (!Object.keys(sources).length) throw new Error(`No source snapshots found for ${profile}/${position.family}`)
    families[position.family] = { requestShape: calculation, sources }
  }
  const output = {
    schemaVersion: '1.0',
    providerId: `JV-PR13E-${profile}-EXCEL16`,
    profile,
    workbook: scenario.workbook,
    workbookSha256: scenario.sourceSha256,
    capturedWithExcel: '16.0',
    sourceManifest: 'docs/jv/fixtures/unified-order-all-seven-inputs.json',
    sourceScenarioId: scenario.scenarioId,
    engineRuleVersion: 'JV-UNIFIED-ORDER-PR13E-1',
    mainDiscount: scenario.engineInput.mainDiscount,
    families,
  }
  const outputPath = resolve(targetDir, `${profile.toLowerCase()}-pr13e.json`)
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`${outputPath} (${Buffer.byteLength(JSON.stringify(output))} bytes)`)
}
