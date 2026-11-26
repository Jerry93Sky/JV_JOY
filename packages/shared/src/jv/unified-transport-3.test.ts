import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateJVOrder } from './unified-order.ts'
import { buildTransport3Manifest } from '../../../../tools/jv/prepare-transport-3-parity.mjs'
import { compareCapturedPrice, transportOrderInput } from '../../../../tools/jv/transport-3-parity.mjs'

const readJson = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
const { scenarios } = buildTransport3Manifest(readJson('../../../../docs/jv/fixtures/unified-order-all-seven-f28-2-inputs.json'))
const report = readJson('../../../../docs/jv/JV_F28_MODE3_EXCEL_PARITY.json')

assert.equal(scenarios.length, 4)
assert.equal(report.cases.length, 4)
for (const scenario of scenarios) {
  test('F28=3 equals the independent Excel capture: ' + scenario.scenarioId, () => {
    const reference = report.cases.find((item: {scenarioId:string}) => item.scenarioId === scenario.scenarioId)
    assert.ok(reference)
    assert.equal(reference.excelVersion, '16.0')
    assert.equal(reference.calculationMode, 'CalculateFullRebuild')
    assert.equal(reference.sourceSha256, scenario.sourceSha256)
    assert.equal(reference.inputsChecked, scenario.primaryInputWrites.length)
    assert.equal(reference.F28, 3)
    assert.equal(reference.B26, scenario.orderSettings.frontMainSurchargeSelector)
    assert.equal(reference.comparisons.length, 22)

    const result = calculateJVOrder(transportOrderInput(scenario))
    assert.equal(result.status, 'COMPLETE')
    assert.equal(result.positions.length, 7)
    const prices = new Map()
    for (const p of result.positions) {
      const [sheet, subtotal, price] = p.family === 'LINE' ? ['L', 'Q56', 'Q58']
        : p.family === 'ZIGZAG' ? ['Z', 'P42', 'P44']
          : p.family === 'FRONT' ? ['F', 'S36', 'S38'] : ['S', 'M51', 'M53']
      const calculation = p.calculation
      const amount = 'commercial' in calculation ? calculation.commercial.q56
        : 'costs' in calculation ? calculation.costs?.P42
          : 's36' in calculation ? calculation.s36
            : 'confirmedSubtotals' in calculation ? calculation.confirmedSubtotals.productSubtotalM51 : undefined
      prices.set(sheet + p.slot + '!' + subtotal, amount)
      const cell = 'AA' + (10 + p.slot)
      const trace = result.trace as {ruleId:string;source:{cell:string};input:{sourceAmount:unknown};result:{extendedPrice:unknown}}[]
      const transfer = trace.find(step => step.ruleId === 'JV.UNIFIED.MAIN.PRICE-2026-11-08-v2' && step.source.cell === cell)
      assert.ok(transfer)
      prices.set(sheet + p.slot + '!' + price, transfer.input.sourceAmount)
      prices.set('Главная!' + cell, transfer.result.extendedPrice)
    }
    prices.set('Главная!AA18', result.totalSalePrice)
    assert.equal(prices.size, 22)
    for (const row of reference.comparisons) {
      const value = prices.get(row.address)
      assert.ok(value, row.address)
      assert.deepEqual(value, row.engine, row.address)
      assert.notEqual(row.status, 'UNVERIFIED', row.address)
      assert.notEqual(row.status, 'MISMATCH', row.address)
      assert.equal(compareCapturedPrice(value, row), row.status, row.address)
    }
  })
}

test('F28=3 with Front in slot 7 cannot infer B26 from F28', () => {
  const order = transportOrderInput(scenarios[0])
  assert.throws(() => calculateJVOrder({ ...order, frontSlot7B26: undefined }), {code:'RULE_UNCONFIRMED'})
})

test('Unified F28=3 cannot disagree between positions', () => {
  const order = transportOrderInput(scenarios[0])
  const line = order.positions.find((p: {family:string}) => p.family === 'LINE')
  line.calculation.input.commercialModeIndex = 1
  try {
    assert.throws(() => calculateJVOrder(order), {code:'INVALID_CONFIGURATION'})
  } finally {
    line.calculation.input.commercialModeIndex = 3
  }
})
