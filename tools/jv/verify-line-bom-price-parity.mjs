import { readFileSync, writeFileSync } from 'node:fs'
import { rationalFromDecimal } from '../../packages/shared/src/jv/rational.ts'

const [bomFixturePath = 'docs/jv/fixtures/line-cutting-excel-golden.json', priceGoldenPath = 'docs/jv/fixtures/line-price-excel-golden.json', outputPath = 'docs/jv/LINE_MATERIAL_PARITY.json'] = process.argv.slice(2)
const bomFixture = JSON.parse(readFileSync(bomFixturePath, 'utf8'))
const priceGolden = JSON.parse(readFileSync(priceGoldenPath, 'utf8'))
const priceByScenario = new Map(priceGolden.cases.map((scenario) => [`${scenario.workbook}|${scenario.scenarioId}`, scenario]))
function sameRational(a, b) { return BigInt(a.numerator) * BigInt(b.denominator) === BigInt(b.numerator) * BigInt(a.denominator) }
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
function formatted(value, places) {
  const n = BigInt(value.numerator), d = BigInt(value.denominator), scale = 10n ** BigInt(places), abs = n < 0n ? -n : n
  let q = abs * scale / d; if ((abs * scale % d) * 2n >= d) q++
  let text = q.toString().padStart(places + 1, '0')
  if (places) text = `${text.slice(0, -places)}.${text.slice(-places)}`
  return `${n < 0n ? '-' : ''}${text}`
}
function normalize(value) { return String(value ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.') }
function places(format) { return /[.,](0+|#+)/.exec(format ?? '')?.[1].length ?? 0 }
function classify(value, cell) {
  const bits = binary64(cell?.binary64)
  if (bits && sameRational(value, bits)) return 'EXACT'
  if (cell?.displayedText == null || !cell?.numberFormat) return 'UNVERIFIED'
  return normalize(formatted(value, places(cell.numberFormat))) === normalize(cell.displayedText) ? 'DISPLAY_MATCH' : 'MISMATCH'
}
const rowResults = []
for (const book of bomFixture.sourceBooks) for (const scenario of book.cases) {
  const pricing = priceByScenario.get(`${book.name}|${scenario.id}`)
  if (!pricing) throw new Error(`No pricing golden for ${book.name} ${scenario.id}`)
  if (scenario.engine.bomPositions.length !== 40 || scenario.engine.unsupportedCount !== 0) throw new Error(`Expected full 40-row BOM for ${book.name} ${scenario.id}`)
  const costBySku = new Map(scenario.engine.materialCost.positions.map((position) => [position.sku, position]))
  for (const line of scenario.engine.bomPositions) {
    const row = Number(line.sourceCell.match(/O(\d+)/)?.[1])
    const excelRow = pricing.values[`L1!${row}`]
    const engineCost = costBySku.get(line.sku)
    if (!engineCost) throw new Error(`No cost result for supported SKU ${line.sku}`)
    rowResults.push({ workbook: book.name, profile: pricing.profile, scenarioId: scenario.id, sku: line.sku, sourceCell: line.sourceCell, quantity: { engine: line.quantity, excelValue2: excelRow.O.value, binary64: excelRow.O.binary64, display: excelRow.O.displayedText, numberFormat: excelRow.O.numberFormat, classification: classify(rationalFromDecimal(line.quantity), excelRow.O) }, amount: { engineExactRational: engineCost.amount, excelValue2: excelRow.Q.value, binary64: excelRow.Q.binary64, display: excelRow.Q.displayedText, numberFormat: excelRow.Q.numberFormat, classification: classify(engineCost.amount, excelRow.Q) } })
  }
}
const classes = ['EXACT', 'DISPLAY_MATCH', 'MISMATCH', 'UNVERIFIED']
const summary = { bomCases: bomFixture.totalCases, supportedBomRowsPerCase: 40, unsupportedBomRowsPerCase: 0, quantityComparisons: rowResults.length, quantity: Object.fromEntries(classes.map((key) => [key, rowResults.filter((r) => r.quantity.classification === key).length])), costAmountComparisons: rowResults.length, costAmount: Object.fromEntries(classes.map((key) => [key, rowResults.filter((r) => r.amount.classification === key).length])) }
const report = { schemaVersion: '1.0', method: 'Recalculated Excel COM Value2 captured with exact IEEE-754 bits, displayed text and cell format. Quantity rules run in the JV BOM engine; supported line-cost amounts use exact rational BigInt arithmetic. EXACT means exact equality to the Excel binary64 rational. DISPLAY_MATCH means the exact engine result and Excel Value2 render identically under that cell’s recorded NumberFormat; both exact values are retained and the classification does not imply numerical equality.', books: bomFixture.sourceBooks.map((book) => ({ workbook: book.name, sha256: book.sha256, excelVersion: book.excelVersion, scenarios: book.cases.map((record) => record.id) })), summary, cases: rowResults }
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ outputPath, summary }, null, 2))
if (summary.quantity.MISMATCH || summary.quantity.UNVERIFIED || summary.costAmount.MISMATCH || summary.costAmount.UNVERIFIED) process.exitCode = 1
