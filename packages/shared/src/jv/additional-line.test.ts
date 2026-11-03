import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLineAdditionalBom } from './additional-line.ts'
import { rationalFromDecimal, rationalToDecimalExact, roundRationalAwayFromZero } from './rational.ts'
import { calculateLineAdditionalMaterialCost } from './pricing-line.ts'

const shared = {
  constructionId: 'case-extra',
  sourceWorkbook: 'JV-комплектация 08.10.2026.xlsm',
  baseQuantities: { O5: '1', O6: '2', O7: '1', O8: '3' },
  width: '4000', leaves: '5', sideCount: '1', profileCount: '2', connectorAngle: '90',
  frameState: 'ДА', weatherSealState: 'ДА',
  settings: { L4: '18', L5: '18', L6: false, L7: '0.95', L8: '0.5', P21: '1600' },
} as const

test('Excel ROUNDUP exact rational helper rounds away from zero at confirmed precision', () => {
  assert.equal(roundRationalAwayFromZero(rationalFromDecimal('2.001'), 0), '3')
  assert.equal(roundRationalAwayFromZero(rationalFromDecimal('-2.001'), 0), '-3')
  assert.equal(roundRationalAwayFromZero({ numerator: '8', denominator: '9' }, 3), '0.889')
  assert.equal(roundRationalAwayFromZero({ numerator: '2000', denominator: '100' }, 0), '20')
})

test('L1 O44:O50 formulas calculate exact supplemental BOM quantities and trace source cells', () => {
  const result = buildLineAdditionalBom(shared)
  assert.equal(result.status, 'COMPLETE')
  assert.deepEqual(result.lines.map((line) => line.sku), ['AA-020', 'AA-050', 'AA-070', 'AA-090', 'AA-110', 'AA-120'])
  assert.deepEqual(result.lines.map((line) => rationalToDecimalExact(line.quantity)), ['18', '4', '2', '2', '0.445', '0.445'])
  assert.deepEqual(result.trace.map((step) => step.source?.cell), ['O45', 'O46', 'O47', 'O48', 'O49', 'O50'])
  assert.equal(result.lines[0].formula, '=(2*$O$5+IF($D$18="ДА",2*$O$6,0)+IF($D$15="ДА",$O$8,0))/Настройки!$L$8')
})

test('supplemental rules preserve branch switches and show missing prerequisites explicitly', () => {
  const noFrame = buildLineAdditionalBom({ ...shared, frameState: 'НЕТ', baseQuantities: { O7: '1' } })
  const bySku = new Map(noFrame.lines.map((line) => [line.sku, rationalToDecimalExact(line.quantity)]))
  assert.equal(bySku.get('AA-050'), '6')
  assert.equal(bySku.get('AA-070'), '0')
  assert.equal(bySku.get('AA-090'), '2')
  assert.equal(bySku.get('AA-110'), '0.445')
  assert.equal(bySku.get('AA-120'), '0.445')
  assert.deepEqual(noFrame.unsupported.map((item) => item.sku), ['AA-020'])
  assert.equal(noFrame.status, 'PARTIAL')
})

test('L6 precision toggle selects ROUNDUP 0 or 3 decimals without Number conversion', () => {
  const roundedInteger = buildLineAdditionalBom({ ...shared, settings: { ...shared.settings, L6: true } })
  const values = new Map(roundedInteger.lines.map((line) => [line.sku, rationalToDecimalExact(line.quantity)]))
  assert.equal(values.get('AA-110'), '1')
  assert.equal(values.get('AA-120'), '1')
})

test('supplemental material price rules use source rows, L8, and adhesive factors exactly', () => {
  const bom = buildLineAdditionalBom(shared)
  const snapshot = {
    profile: 'RETAIL' as const, currency: 'RUB' as const, version: 'retail-v1', workbook: 'JV-розница 08.10.2026.xlsm', workbookSha256: 'sha', capturedFrom: 'EXCEL_COM_VALUE2' as const,
    settings: { L8: '0.5' },
    entries: [
      { sku: 'AA-020', unit: 'м', value: '2', sourceCell: "'Прайс-Line'!E46" },
      { sku: 'AA-050', unit: 'шт.', value: '5', sourceCell: "'Прайс-Line'!E47" },
      { sku: 'AA-070', unit: 'шт.', value: '7', sourceCell: "'Прайс-Line'!E48" },
      { sku: 'AA-090', unit: 'шт.', value: '11', sourceCell: "'Прайс-Line'!E49" },
      { sku: 'AA-110', unit: 'шт.', value: '13', sourceCell: "'Прайс-Line'!E50" },
      { sku: 'AA-120', unit: 'шт.', value: '17', sourceCell: "'Прайс-Line'!E51" },
    ],
  }
  const result = calculateLineAdditionalMaterialCost({ bom, profile: 'RETAIL', snapshot, adhesiveFactors: { O5: rationalFromDecimal('0.2'), O18: rationalFromDecimal('0.6') } })
  assert.deepEqual(result.positions.map((position) => rationalToDecimalExact(position.amount)), ['72', '20', '14', '22', '1.157', '4.539'])
  assert.equal(rationalToDecimalExact(result.supportedSubtotal), '133.696')
  assert.equal(result.positions[4].formula, "=$P$49*$O$49*'Клей+акт'!$O$5")
  assert.deepEqual(result.trace.map((step) => step.source?.cell), ['Q45','Q46','Q47','Q48','Q49','Q50'])
})
