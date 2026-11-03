import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateLineSashProfileLengths } from './sash-cutting.ts'
import { decimalString } from '../decimal.ts'

const base = {
  workbook: 'JV-комплектация 08.10.2026.xlsm', openingWidth: '4000', constructionHeight: '2500', leaves: '5', sides: '1', frameState: 'ДА',
  specialSash: false, parkedDoorSelected: false, parkedDoorPosition: '2', parkedDoorReuseOpening: false,
  settings: { P3: '58', P4: '14', P12: '17', P13: '6', P14: '1', P15: '5', P16: '2', P17: '0.5', L23: '0', D6: '100' },
} as const

test('JV-Line sash profile geometry follows I42:I49 -> F39 -> O6/O7 with source trace', () => {
  const result = calculateLineSashProfileLengths({ ...base, specialSashWidth: '900', parkedDoorWidth: '900' })
  assert.equal(result.profileLengthTotal, '3873')
  assert.equal(result.upperProfileQuantity, '3.973')
  assert.equal(result.lowerProfileQuantity, '3.973')
  assert.equal(result.intermediates.I49, '786')
  assert.equal(result.trace.find((step) => step.id === 'JV.LINE.SASH.I49')?.source?.formula, '=ROUNDDOWN(($I$46-$D$6*I47-$I$48)/($D$5-IF($I$47>0,$D$6,0)-IF($I$48>0,1,0)),0)')
  assert.equal(result.parity, 'EXCEL_PARITY_UNVERIFIED')
})

test('special and parked opening branches are lazy and exact', () => {
  const special = calculateLineSashProfileLengths({ ...base, leaves: '4', openingWidth: '5000', specialSash: true, specialSashWidth: '900' })
  assert.equal(special.intermediates.I47, '895')
  const parked = calculateLineSashProfileLengths({ ...base, parkedDoorSelected: true, parkedDoorPosition: '2', parkedDoorReuseOpening: true, parkedDoorWidth: '900' })
  assert.equal(parked.intermediates.I48, '895')
  assert.equal(parked.trace.some((step) => step.id === 'JV.LINE.SASH.I48'), true)
})

test('decimal output and formula sequence are deterministic', () => {
  const input = { ...base, specialSashWidth: '900', parkedDoorWidth: '900' }
  assert.deepEqual(calculateLineSashProfileLengths(input), calculateLineSashProfileLengths(input))
  assert.equal(decimalString(calculateLineSashProfileLengths(input).lowerProfileQuantity), '3.973')
})
