import { readFileSync, writeFileSync } from 'node:fs'
import { buildLineAdditionalBom } from '../../packages/shared/src/jv/additional-line.ts'
import { rationalToDecimalExact } from '../../packages/shared/src/jv/rational.ts'
import { calculateLineAdditionalMaterialCost } from '../../packages/shared/src/jv/pricing-line.ts'

const [fixturePath = 'docs/jv/fixtures/line-price-excel-golden.json', outputPath = 'docs/jv/LINE_ADDITIONAL_BOM_PARITY.json', snapshotsPath = 'docs/jv/fixtures/line-price-snapshots.json'] = process.argv.slice(2)
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const snapshots = JSON.parse(readFileSync(snapshotsPath, 'utf8')).sources
const snapshotByProfile = new Map(snapshots.map((snapshot) => [snapshot.profile, snapshot]))
function binary64(hex) {
  if (!hex) return undefined
  const bits = BigInt(`0x${hex}`), sign = bits >> 63n ? -1n : 1n
  const exponent = Number((bits >> 52n) & 0x7ffn), fraction = bits & ((1n << 52n) - 1n)
  if (exponent === 0x7ff) return undefined
  if (exponent === 0 && fraction === 0n) return { numerator: '0', denominator: '1' }
  const mantissa = exponent === 0 ? fraction : (1n << 52n) + fraction
  const power = exponent === 0 ? -1074 : exponent - 1023 - 52
  return power >= 0 ? { numerator: String(sign * (mantissa << BigInt(power))), denominator: '1' } : { numerator: String(sign * mantissa), denominator: String(1n << BigInt(-power)) }
}
function sameRational(a, b) { return BigInt(a.numerator) * BigInt(b.denominator) === BigInt(b.numerator) * BigInt(a.denominator) }
function normalize(value) { return String(value ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.') }
function displayed(value, format) {
  const places = /[.,](0+|#+)/.exec(format ?? '')?.[1].length ?? 0
  const n = BigInt(value.numerator), d = BigInt(value.denominator), scale = 10n ** BigInt(places), abs = n < 0n ? -n : n
  let q = abs * scale / d
  if ((abs * scale % d) * 2n >= d) q++
  let text = q.toString().padStart(places + 1, '0')
  if (places) text = `${text.slice(0, -places)}.${text.slice(-places)}`
  return `${n < 0n ? '-' : ''}${text}`
}
function cell(scenario, row, column) { return scenario.values[`L1!${row}`]?.[column] }
function sourceValue(scenario, cell) { return scenario.sourceInputs?.[cell]?.value }
function settingValue(scenario, cell) { return scenario.settingsInputs?.[cell]?.value }
const cases = []
const priceComparisons = []
for (const scenario of fixture.cases) {
  const input = {
    constructionId: `${scenario.profile}:${scenario.scenarioId}`,
    sourceWorkbook: scenario.workbook,
    baseQuantities: Object.fromEntries([5, 6, 7, 8].map((row) => [`O${row}`, cell(scenario, row, 'O')?.value]).filter(([, value]) => value != null)),
    width: sourceValue(scenario, 'D3'), leaves: sourceValue(scenario, 'D5'), sideCount: sourceValue(scenario, 'D6'), profileCount: sourceValue(scenario, 'D8'), connectorAngle: sourceValue(scenario, 'D9'), frameState: sourceValue(scenario, 'D15'), weatherSealState: sourceValue(scenario, 'D18'),
    settings: Object.fromEntries(['L4','L5','L6','L7','L8','P21'].map((key) => [key, settingValue(scenario, key)])),
  }
  const result = buildLineAdditionalBom(input)
  if (result.unsupported.length) throw new Error(`${scenario.workbook} ${scenario.scenarioId}: unsupported ${result.unsupported.map((x) => x.sku).join(', ')}`)
  const glue = scenario.additionalSources?.glue ?? {}
  const adhesiveFactors = Object.fromEntries(['O5','O18'].map((key) => [key, glue[key]?.value]).filter(([, value]) => value != null))
  const priceResult = calculateLineAdditionalMaterialCost({ bom: result, profile: scenario.profile, snapshot: snapshotByProfile.get(scenario.profile), adhesiveFactors })
  const costBySku = new Map(priceResult.positions.map((position) => [position.sku, position]))
  for (const line of result.lines) {
    const excel = cell(scenario, line.sourceL1Row, 'O')
    const exact = binary64(excel?.binary64)
    const matches = exact && sameRational(line.quantity, exact)
    const displayMatch = excel?.displayedText != null && normalize(displayed(line.quantity, excel.numberFormat)) === normalize(excel.displayedText)
    const classification = matches ? 'EXACT' : displayMatch ? 'DISPLAY_MATCH' : 'MISMATCH'
    cases.push({ workbook: scenario.workbook, profile: scenario.profile, scenarioId: scenario.scenarioId, sku: line.sku, sourceCell: line.sourceCell, sourceFormula: excel?.formula, engineExactRational: line.quantity, engineDecimalIfTerminating: rationalToDecimalExact(line.quantity) ?? null, excelValue2: excel?.value, excelBinary64: excel?.binary64, excelDisplayed: excel?.displayedText, numberFormat: excel?.numberFormat, classification })
    const engineCost = costBySku.get(line.sku)
    const priceExcel = scenario.values[`L1!${line.sourceL1Row}`]?.P
    const amountExcel = scenario.values[`L1!${line.sourceL1Row}`]?.Q
    for (const [kind, engine, cell] of [['unitPrice', engineCost?.unitPrice, priceExcel], ['amount', engineCost?.amount, amountExcel]]) {
      const bits = binary64(cell?.binary64)
      const priceExact = engine && bits && sameRational(engine, bits)
      const priceDisplay = engine && cell?.displayedText != null && normalize(displayed(engine, cell.numberFormat)) === normalize(cell.displayedText)
      priceComparisons.push({ workbook: scenario.workbook, profile: scenario.profile, scenarioId: scenario.scenarioId, sku: line.sku, cell: `${kind === 'unitPrice' ? 'P' : 'Q'}${line.sourceL1Row}`, formula: cell?.formula, engineExactRational: engine, engineDecimalIfTerminating: engine ? rationalToDecimalExact(engine) ?? null : null, excelValue2: cell?.value, excelBinary64: cell?.binary64, excelDisplayed: cell?.displayedText, numberFormat: cell?.numberFormat, classification: priceExact ? 'EXACT' : priceDisplay ? 'DISPLAY_MATCH' : 'MISMATCH' })
    }
  }
}
const summary = Object.fromEntries(['EXACT','DISPLAY_MATCH','MISMATCH','UNVERIFIED'].map((k) => [k, cases.filter((c) => c.classification === k).length]))
const priceSummary = Object.fromEntries(['EXACT','DISPLAY_MATCH','MISMATCH','UNVERIFIED'].map((k) => [k, priceComparisons.filter((c) => c.classification === k).length]))
const report = { schemaVersion: '1.0', method: 'Excel 16.0 CalculateFullRebuild on temporary workbook copies, macros disabled; exact comparison uses IEEE-754 binary64 rational bits; display match is formatting-only and does not imply unrounded numeric equivalence.', fixture: fixturePath, scenarios: fixture.cases.length, quantityComparisons: cases.length, quantitySummary: summary, priceAndAmountComparisons: priceComparisons.length, priceAndAmountSummary: priceSummary, quantities: cases, priceAndAmounts: priceComparisons }
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ outputPath, scenarios: report.scenarios, quantityComparisons: report.quantityComparisons, quantitySummary: summary, priceAndAmountComparisons: report.priceAndAmountComparisons, priceAndAmountSummary: priceSummary }, null, 2))
if (summary.MISMATCH || summary.UNVERIFIED || priceSummary.MISMATCH || priceSummary.UNVERIFIED) process.exitCode = 1
