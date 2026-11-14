import { readFileSync, writeFileSync } from 'node:fs'
import { calculateLineSashProfileLengths } from '../../packages/shared/src/jv/geometry/sash-cutting.ts'

const [fixturePath = 'docs/jv/fixtures/line-price-excel-golden.json', outputPath = 'docs/jv/LINE_SASH_PROFILE_PARITY.json'] = process.argv.slice(2)
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
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
function fromDecimal(text) {
  const s = String(text), m = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(s)
  if (!m) throw new Error(`Invalid decimal in parity report: ${s}`)
  const frac = m[3] ?? '', n = BigInt(`${m[1]}${m[2]}${frac}`)
  return { numerator: String(n), denominator: String(10n ** BigInt(frac.length)) }
}
function same(a, b) { return BigInt(a.numerator) * BigInt(b.denominator) === BigInt(b.numerator) * BigInt(a.denominator) }
function display(r, format) {
  const digits = /[.,](0+|#+)/.exec(format ?? '')?.[1].length ?? 0
  const n = BigInt(r.numerator), d = BigInt(r.denominator), scale = 10n ** BigInt(digits), abs = n < 0n ? -n : n
  let q = abs * scale / d
  if ((abs * scale % d) * 2n >= d) q++
  let s = q.toString().padStart(digits + 1, '0')
  if (digits) s = `${s.slice(0, -digits)}.${s.slice(-digits)}`
  return `${n < 0n ? '-' : ''}${s}`
}
function normalize(v) { return String(v ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.') }
const comparisons = []
for (const scenario of fixture.cases) {
  const raw = (cell) => scenario.sourceInputs[cell]?.value
  const setting = (cell) => scenario.settingsInputs[cell]?.value
  const result = calculateLineSashProfileLengths({
    workbook: scenario.workbook, openingWidth: raw('D3'), constructionHeight: raw('D4'), leaves: raw('D5'), sides: raw('D6'), frameState: raw('D15'),
    specialSash: raw('C21'), specialSashWidth: raw('D21'), parkedDoorSelected: raw('C23'), parkedDoorPosition: raw('C24'), parkedDoorReuseOpening: raw('C25'), parkedDoorWidth: raw('D25'),
    settings: Object.fromEntries(['P3','P4','P12','P13','P14','P15','P16','P17','L23','D6'].map((key) => [key, setting(key)])),
  })
  for (const [address, engine] of [['F39', result.profileLengthTotal], ['O6', result.upperProfileQuantity], ['O7', result.lowerProfileQuantity]]) {
    const excel = scenario.sashGeometry[address]
    const expected = binary64(excel?.binary64), exact = same(fromDecimal(engine), expected)
    const displayMatch = normalize(display(fromDecimal(engine), excel?.numberFormat)) === normalize(excel?.displayedText)
    comparisons.push({ workbook: scenario.workbook, profile: scenario.profile, scenarioId: scenario.scenarioId, cell: `L1!${address}`, formula: excel?.formula, engineValue: engine, excelValue2: excel?.value, excelBinary64: excel?.binary64, displayedText: excel?.displayedText, numberFormat: excel?.numberFormat, classification: exact ? 'EXACT' : displayMatch ? 'DISPLAY_MATCH' : 'MISMATCH' })
  }
}
const summary = Object.fromEntries(['EXACT','DISPLAY_MATCH','MISMATCH','UNVERIFIED'].map((key) => [key, comparisons.filter((x) => x.classification === key).length]))
const report = { schemaVersion: '1.0', formulaChain: 'L1!I42:I49 -> C/D36:C41 -> F33:F39 -> O6/O7', methodology: 'Fresh Excel 16.0 CalculateFullRebuild Value2 and IEEE-754 bits; engine exact decimal values; display match is presentation only.', scenarios: fixture.cases.length, comparisons: comparisons.length, summary, cases: comparisons }
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ outputPath, scenarios: report.scenarios, comparisons: report.comparisons, summary }, null, 2))
if (summary.MISMATCH || summary.UNVERIFIED) process.exitCode = 1
