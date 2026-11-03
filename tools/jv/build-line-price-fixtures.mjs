import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [rawPath, outputDirectory] = process.argv.slice(2)
if (!rawPath || !outputDirectory) throw new Error('Usage: node build-line-price-fixtures.mjs <Excel COM JSON> <docs/jv/fixtures>')
const raw = JSON.parse(await readFile(rawPath, 'utf8'))
const profileFor = (name) => name.includes('комплектация') ? 'COMPLETATION' : name.includes('розница') ? 'RETAIL' : undefined
const firstByWorkbook = new Map()
for (const result of raw.cases) if (!firstByWorkbook.has(result.workbook)) firstByWorkbook.set(result.workbook, result)
const snapshots = []
for (const [workbook, result] of firstByWorkbook) {
  const profile = profileFor(workbook)
  if (!profile) throw new Error(`Unknown workbook profile: ${workbook}`)
  const entries = []
  for (let lineRow = 5; lineRow <= 44; lineRow++) {
    const skuCell = result.values.L1[`L${lineRow}`]
    const match = /B(\d+)$/.exec(skuCell.formula ?? '')
    if (!match) continue
    const catalogRow = Number(match[1])
    const price = result.values.PriceLine[`E${catalogRow}`]
    const unit = result.values.PriceLine[`D${catalogRow}`]
    if (price?.value == null || unit?.value == null) throw new Error(`Missing source price for L1!L${lineRow} (${skuCell.value})`)
    entries.push({ sku: String(skuCell.value), unit: String(unit.value), value: String(price.value), sourceCell: `'Прайс-Line'!E${catalogRow}`, ...(price.formula?.startsWith('=') ? { sourceFormula: price.formula } : {}) })
  }
  for (let lineRow = 45; lineRow <= 50; lineRow++) {
    const skuCell = result.values.L1[`L${lineRow}`]
    const match = /B(\d+)$/.exec(skuCell.formula ?? '')
    if (!match) throw new Error(`Missing supplemental catalog mapping for L1!L${lineRow}`)
    const catalogRow = Number(match[1])
    const price = result.values.PriceLine[`E${catalogRow}`]
    const unit = result.values.PriceLine[`D${catalogRow}`]
    if (price?.value == null || unit?.value == null) throw new Error(`Missing source price for L1!${lineRow} (${skuCell.value})`)
    entries.push({ sku: String(skuCell.value), unit: String(unit.value), value: String(price.value), sourceCell: `'Прайс-Line'!E${catalogRow}`, ...(price.formula?.startsWith('=') ? { sourceFormula: price.formula } : {}) })
  }
  const unitPriceHeading = String(result.values.L1.P4?.value ?? '')
  const lineAmountHeading = String(result.values.L1.Q4?.value ?? '')
  if (!unitPriceHeading.toLowerCase().includes('руб') || !lineAmountHeading.toLowerCase().includes('руб')) throw new Error(`L1 P/Q currency headings are not confirmed for ${workbook}`)
  snapshots.push({ schemaVersion: '1.0', profile, version: `JV-${profile}-2026-10-08-${result.workbookSha256.slice(0, 12)}`, workbook, workbookSha256: result.workbookSha256, capturedFrom: 'EXCEL_COM_VALUE2', capturedWithExcel: result.excelVersion, currency: 'RUB', priceValueColumnHeading: result.values.PriceLine.E3?.value ?? null, unitPriceHeading, lineAmountHeading, entries, settings: Object.fromEntries(['D2','L4','L5','L6','L7','L8','P21'].filter((key) => result.values.Settings[key]?.value != null).map((key) => [key, String(result.values.Settings[key].value)])), additionalSources: { assemblyInstallPrices: Object.fromEntries(['C5','C8','C9','C10','C11','C12','C19','C25','C28'].map((cell) => [cell, result.values.AssemblyInstall?.[cell]?.value == null ? null : String(result.values.AssemblyInstall[cell].value)])) } })
}
await writeFile(path.join(outputDirectory, 'line-price-snapshots.json'), `${JSON.stringify({ schemaVersion: '1.0', sources: snapshots }, null, 2)}\n`, 'utf8')
const golden = raw.cases.map((result) => {
  const profile = profileFor(result.workbook)
  const values = {}
  for (let row = 5; row <= 51; row++) values[`L1!${row}`] = Object.fromEntries(['L', 'M', 'N', 'O', 'P', 'Q', 'S', 'V'].map((column) => [column, result.values.L1[`${column}${row}`]]))
  const constructionTotalCells = ['Q52','Q53','Q54','Q55','Q56','Q57','Q58','S52','S53','V15','V18']
  const constructionTotals = Object.fromEntries(constructionTotalCells.map((cell) => [cell, result.values.L1[cell]]))
  const sourceInputs = Object.fromEntries(['D3','D4','D5','D6','D7','D8','D9','D15','D16','D17','D18','D19','D20','D23','D24','D25','D33','C21','C23','C24','C25','D21','D22','D53','D54','H21','I21','X5'].map((cell) => [cell, result.values.L1[cell]]))
  const sashCells = ['I42','I43','I44','I45','I46','I47','I48','I49','C36','D36','C37','D37','C38','D38','C39','D39','C40','D40','C41','D41','C46','D46','C47','D47','C48','D48','C49','D49','C50','D50','C51','D51','F33','F34','F35','F36','F37','F38','F39','O6','O7']
  const sashGeometry = Object.fromEntries(sashCells.map((cell) => [cell, result.values.L1[cell]]))
  return { workbook: result.workbook, workbookSha256: result.workbookSha256, profile, excelVersion: result.excelVersion, macrosForceDisabled: result.macrosForceDisabled, scenarioId: result.scenarioId, scenarioInputs: result.scenarioInputs, sourceInputs, settingsInputs: result.values.Settings, additionalSources: { glue: result.values.Glue, assemblyInstall: result.values.AssemblyInstall }, sashGeometry, values, constructionTotals }
})
await writeFile(path.join(outputDirectory, 'line-price-excel-golden.json'), `${JSON.stringify({ schemaVersion: '1.0', capturedFrom: 'EXCEL_COM_VALUE2_ON_TEMPORARY_COPIES', formulaCacheIsNotUsed: true, cases: golden }, null, 2)}\n`, 'utf8')
console.log(`Wrote ${snapshots.length} profile snapshots and ${golden.length} Excel price golden cases`)
