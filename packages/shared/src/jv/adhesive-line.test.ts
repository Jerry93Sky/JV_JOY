import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateLineAdhesiveFactors } from './adhesive-line.ts'
import { rationalFromDecimal, rationalToDecimalExact } from './rational.ts'

test('O5/O18 allocate whole-package consumption over the explicit JV-Line quote quantity', () => {
  const result = calculateLineAdhesiveFactors({
    activatorQuantityPerConstruction: rationalFromDecimal('0.445'),
    adhesiveQuantityPerConstruction: rationalFromDecimal('0.445'),
    constructionQuantity: rationalFromDecimal('1'),
    workbook: 'JV-комплектация 08.10.2026.xlsm',
  })
  assert.deepEqual(result.O5, { numerator: '200', denominator: '89' })
  assert.deepEqual(result.O18, result.O5)
  assert.deepEqual(result.trace.map((step) => step.source?.cell), ['O5', 'O18'])
})

test('adhesive factors move at the exact Excel ROUNDUP-to-whole-pack threshold', () => {
  const result = calculateLineAdhesiveFactors({
    activatorQuantityPerConstruction: rationalFromDecimal('0.445'),
    adhesiveQuantityPerConstruction: rationalFromDecimal('0.445'),
    constructionQuantity: rationalFromDecimal('3'),
    workbook: 'JV-розница 08.10.2026.xlsm',
  })
  assert.equal(rationalToDecimalExact(result.O5), undefined)
  assert.deepEqual(result.O5, { numerator: '400', denominator: '267' }) // ceil(3*0.445)=2
})

test('adhesive allocation rejects zero or negative quantity instead of fabricating a factor', () => {
  assert.throws(() => calculateLineAdhesiveFactors({
    activatorQuantityPerConstruction: rationalFromDecimal('0.445'),
    adhesiveQuantityPerConstruction: rationalFromDecimal('0.445'),
    constructionQuantity: rationalFromDecimal('0'),
    workbook: 'JV-комплектация 08.10.2026.xlsm',
  }), (error: any) => error.code === 'INVALID_CONFIGURATION')
})
