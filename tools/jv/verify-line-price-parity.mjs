import { readFileSync, writeFileSync } from 'node:fs'
import { addRational, divideRational, multiplyRational, rationalFromDecimal } from '../../packages/shared/src/jv/rational.ts'

const [goldenPath = 'docs/jv/fixtures/line-price-excel-golden.json', snapshotsPath = 'docs/jv/fixtures/line-price-snapshots.json', reportPath = 'docs/jv/LINE_PRICE_PARITY.json'] = process.argv.slice(2)
const golden = JSON.parse(readFileSync(goldenPath, 'utf8'))
const snapshots = JSON.parse(readFileSync(snapshotsPath, 'utf8')).sources
const snapshotFor = new Map(snapshots.map((s) => [s.profile, s]))
function sameRational(a, b) { return BigInt(a.numerator) * BigInt(b.denominator) === BigInt(b.numerator) * BigInt(a.denominator) }
function toDisplay(value, scale) {
  const n = BigInt(value.numerator), d = BigInt(value.denominator), factor = 10n ** BigInt(scale)
  const abs = n < 0n ? -n : n
  let q = abs * factor / d
  const rem = abs * factor % d
  if (rem * 2n >= d) q++
  let digits = q.toString().padStart(scale + 1, '0')
  if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
  return `${n < 0n ? '-' : ''}${digits}`
}
function decimalPlaces(format) { const match = /[.,](0+|#+)/.exec(format ?? ''); return match?.[1].length ?? 0 }
function normalizeDisplay(value) { return String(value ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.') }
function binary64AsRational(hex) {
  if (!hex) return undefined
  const bits = BigInt(`0x${hex}`), sign = bits >> 63n ? -1n : 1n
  const exponent = Number((bits >> 52n) & 0x7ffn), fraction = bits & ((1n << 52n) - 1n)
  if (exponent === 0x7ff) return undefined
  if (exponent === 0 && fraction === 0n) return { numerator: '0', denominator: '1' }
  const mantissa = exponent === 0 ? fraction : (1n << 52n) + fraction
  const power = exponent === 0 ? -1074 : exponent - 1023 - 52
  return power >= 0 ? { numerator: String(sign * (mantissa << BigInt(power))), denominator: '1' } : { numerator: String(sign * mantissa), denominator: String(1n << BigInt(-power)) }
}
function classify(expected, excelCell) {
  const binary = binary64AsRational(excelCell?.binary64)
  if (binary && sameRational(expected, binary)) return 'EXACT'
  if (excelCell?.displayedText == null || !excelCell?.numberFormat) return 'UNVERIFIED'
  const expectedText = toDisplay(expected, decimalPlaces(excelCell.numberFormat))
  return normalizeDisplay(expectedText) === normalizeDisplay(excelCell.displayedText) ? 'DISPLAY_MATCH' : 'MISMATCH'
}
const results = []
for (const scenario of golden.cases) {
  const snapshot = snapshotFor.get(scenario.profile)
  if (!snapshot || snapshot.workbookSha256 !== scenario.workbookSha256) throw new Error(`Missing or stale snapshot for ${scenario.workbook} ${scenario.scenarioId}`)
  const entries = new Map(snapshot.entries.map((entry) => [entry.sku, entry]))
  for (let row = 5; row <= 44; row++) {
    const cells = scenario.values[`L1!${row}`]
    const sku = cells.L?.value
    const priceRow = row <= 25 ? row : row + 1
    const price = entries.get(sku)
    if (!price) { results.push({ profile: scenario.profile, scenarioId: scenario.scenarioId, row, sku, field: 'P', classification: 'UNVERIFIED', reason: 'no source price record' }); continue }
    let expectedUnitPrice = rationalFromDecimal(price.value)
    if (row >= 5 && row <= 8) expectedUnitPrice = divideRational(expectedUnitPrice, rationalFromDecimal(snapshot.settings.D2))
    if (row === 44) expectedUnitPrice = divideRational(expectedUnitPrice, rationalFromDecimal(snapshot.settings.L7))
    for (const [field, expected] of [['P', expectedUnitPrice], ['Q', (() => {
      try { return multiplyRational(expectedUnitPrice, rationalFromDecimal(String(cells.O.value))) } catch { return undefined }
    })()]]) {
      if (!expected) { results.push({ profile: scenario.profile, scenarioId: scenario.scenarioId, row, sku, field, classification: 'UNVERIFIED', reason: 'quantity is not numeric' }); continue }
      results.push({ profile: scenario.profile, scenarioId: scenario.scenarioId, row, sku, field, sourcePriceCell: price.sourceCell, sourceFormula: cells[field]?.formula, exactExpected: expected, excelValue2: cells[field]?.value, excelBinary64: cells[field]?.binary64, excelDisplay: cells[field]?.displayedText, numberFormat: cells[field]?.numberFormat, classification: classify(expected, cells[field]) })
    }
    if (price.sourceCell !== `'Прайс-Line'!E${priceRow}`) throw new Error(`Price row mismatch for ${sku}: ${price.sourceCell}`)
  }
}
const summary = Object.fromEntries(['EXACT', 'DISPLAY_MATCH', 'MISMATCH', 'UNVERIFIED'].map((category) => [category, results.filter((r) => r.classification === category).length]))
const report = { schemaVersion: '1.0', sourceFixture: goldenPath, priceSnapshotFixture: snapshotsPath, method: 'Fresh Excel 16.0 CalculateFullRebuild COM Value2 with IEEE-754 bits, displayed text and number format. Engine side uses exact rational BigInt operations; no epsilon. EXACT means rational equality to Excel binary64 value. DISPLAY_MATCH means formatted cell display equality only; it does not rewrite the exact engine amount or assert unrounded equivalence.', comparisonUnits: { quantities: 'not assessed by this price-only comparison', intermediateMoney: 'exact rational; display scale taken from each Excel cell NumberFormat', finalTotals: 'not assessed' }, summary, results }
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ reportPath, total: results.length, summary }, null, 2))
