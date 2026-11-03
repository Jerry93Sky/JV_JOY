import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLineMaterialBom } from './bom-line.ts'
import { decimalString } from './decimal.ts'
import { aggregateLineQ52MaterialSubtotal, calculateLineMaterialCost, type LinePriceSnapshot, type LineMaterialCostResult, type LineAdditionalCostResult } from './pricing-line.ts'
import { divideRational, rationalFromDecimal, rationalToDecimalExact } from './rational.ts'
import { calculateLineCarrierProfileCuts } from './geometry/cutting.ts'

function makeBom(workbook: string) {
  const cutting = calculateLineCarrierProfileCuts({
    openingWidth: { value: decimalString('4000'), unit: 'mm' }, sideCount: decimalString('1'),
    parkingDepth: { value: decimalString('369'), unit: 'mm' }, parkingAxisWidth: { value: decimalString('691'), unit: 'mm' },
    settings: { carrierProfileWidth: { value: decimalString('44'), unit: 'mm' }, teeWidth: { value: decimalString('218'), unit: 'mm' }, teeProjection: { value: decimalString('109'), unit: 'mm' }, carrierProfileAllowance: { value: decimalString('100'), unit: 'mm' } },
    sourceWorkbook: workbook,
  })
  return buildLineMaterialBom({ constructionId: 'PRICE-001', cutting, configuration: { leaves: decimalString('5'), sideCount: decimalString('1'), direction: 'НАЛЕВО', mountingFrameState: 'ДА' } })
}
function snapshotFor(bom: ReturnType<typeof makeBom>, profile: 'COMPLETATION' | 'RETAIL', price: string): LinePriceSnapshot {
  const workbook = bom.lines[0]!.sourceWorkbook
  return { profile, currency: 'RUB', version: `TEST-${profile}`, workbook, workbookSha256: 'test', capturedFrom: 'EXCEL_COM_VALUE2', settings: { D2: '0.9', L7: '0.95' }, entries: bom.lines.map((line) => { const lineRow = Number(/^L1!O(\d+)$/.exec(line.sourceCell)![1]); const row = lineRow <= 25 ? lineRow : lineRow + 1; return { sku: line.sku, unit: line.unit, value: price, sourceCell: `'Прайс-Line'!E${row}` } }) }
}

test('rational operations retain non-terminating exact amounts without Number conversion', () => {
  const price = rationalFromDecimal('4857.5')
  const coefficient = rationalFromDecimal('0.9')
  const unitPrice = divideRational(price, coefficient)
  assert.equal(rationalToDecimalExact(unitPrice), undefined)
  assert.equal(unitPrice.numerator, '48575')
  assert.equal(unitPrice.denominator, '9')
})

test('material cost applies row-specific P formulas and keeps amount exact', () => {
  const bom = makeBom('JV-комплектация 08.10.2026.xlsm')
  const result = calculateLineMaterialCost({ bom, snapshot: snapshotFor(bom, 'COMPLETATION', '100') })
  assert.equal(result.profile, 'COMPLETATION')
  assert.equal(result.completeness, 'PARTIAL_SUPPORTED_POSITIONS')
  assert.equal(result.unsupportedPositions.length, bom.unsupported.length)
  assert.equal(result.positions.length, bom.lines.length)
  const profile = result.positions.find((item) => item.sku === 'LN-010')!
  assert.deepEqual(profile.unitPrice, { numerator: '1000', denominator: '9' })
  assert.deepEqual(profile.amount, { numerator: '4877', denominator: '9' })
  const direct = result.positions.find((item) => item.sku === 'LN-050-L')!
  assert.deepEqual(direct.unitPrice, { numerator: '100', denominator: '1' })
  assert.ok(result.trace.every((step) => step.source?.cell?.startsWith('P')))
  assert.equal(result.parity, 'EXCEL_PARITY_UNVERIFIED')
})

test('retail is an independent price profile and unit mismatch is rejected', () => {
  const source = makeBom('JV-розница 08.10.2026.xlsm')
  const result = calculateLineMaterialCost({ bom: source, snapshot: snapshotFor(source, 'RETAIL', '250') })
  assert.equal(result.profile, 'RETAIL')
  assert.deepEqual(result.positions.find((item) => item.sku === 'LN-010')?.unitPrice, { numerator: '2500', denominator: '9' })
  const invalid = snapshotFor(source, 'RETAIL', '250')
  const wrong = { ...invalid, entries: invalid.entries.map((entry) => entry.sku === 'LN-010' ? { ...entry, unit: 'шт.' } : entry) }
  assert.throws(() => calculateLineMaterialCost({ bom: source, snapshot: wrong }), (error: any) => error.code === 'UNIT_MISMATCH')
})

test('missing price is an explicit typed error', () => {
  const bom = makeBom('JV-комплектация 08.10.2026.xlsm')
  const snapshot = snapshotFor(bom, 'COMPLETATION', '100')
  assert.throws(() => calculateLineMaterialCost({ bom, snapshot: { ...snapshot, entries: snapshot.entries.filter((entry) => entry.sku !== 'LN-010') } }), (error: any) => error.code === 'PRICE_NOT_FOUND')
})

test('Q52 aggregation preserves exact partial subtotal, provenance and unsupported positions', () => {
  const base = { profile:'COMPLETATION',currency:'RUB',priceSnapshotVersion:'v1',supportedSubtotal:{numerator:'10',denominator:'3'},positions:[{sourceCell:'L1!O5'}],unsupportedPositions:[{sku:'LN-020',sourceCell:'L1!O6',reason:'QUANTITY_RULE_NOT_IMPLEMENTED'}] } as unknown as LineMaterialCostResult
  const additional = { profile:'COMPLETATION',currency:'RUB',priceSnapshotVersion:'v1',supportedSubtotal:{numerator:'2',denominator:'3'},positions:[{sourceCell:'L1!O45'}],unsupportedPositions:[] } as unknown as LineAdditionalCostResult
  const result = aggregateLineQ52MaterialSubtotal({base,additional})
  assert.deepEqual(result.supportedSubtotal,{numerator:'4',denominator:'1'})
  assert.equal(result.status,'PARTIAL_SUPPORTED_POSITIONS')
  assert.equal(result.sourceFormula,'=SUM(Q5:Q50)')
  assert.deepEqual(result.supportedSourceCells,['L1!Q5','L1!Q45'])
  assert.equal(result.unsupportedPositions[0].sourceCell,'L1!O6')
  assert.equal(result.trace[0].source?.cell,'Q52')
})

test('Q52 refuses duplicate Q source cells across base and additional material groups', () => {
  const base = { profile:'COMPLETATION',currency:'RUB',priceSnapshotVersion:'v1',supportedSubtotal:{numerator:'0',denominator:'1'},positions:[{sourceCell:'L1!O45'}],unsupportedPositions:[] } as unknown as LineMaterialCostResult
  const additional = { profile:'COMPLETATION',currency:'RUB',priceSnapshotVersion:'v1',supportedSubtotal:{numerator:'0',denominator:'1'},positions:[{sourceCell:'L1!O45'}],unsupportedPositions:[] } as unknown as LineAdditionalCostResult
  assert.throws(()=>aggregateLineQ52MaterialSubtotal({base,additional}),(error:any)=>error.code==='INVALID_CONFIGURATION')
})
