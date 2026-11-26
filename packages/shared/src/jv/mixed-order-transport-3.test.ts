import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { calculateJVOrder } from './unified-order.ts'
import { evaluateMixedScenario } from '../../../../tools/jv/line-zigzag-f28-3-parity.mjs'
import { scenarios } from '../../../../tools/jv/prepare-line-zigzag-f28-3.mjs'

const cases = scenarios()
const captures = JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-zigzag-f28-3-excel.json', import.meta.url), 'utf8'))
assert.equal(cases.length, 6)
assert.equal(captures.length, cases.length)
for (const s of cases) {
  test('mixed Line + Zigzag F28=3 matches the Excel capture: ' + s.scenarioId, () => {
    const capture = captures.find((entry: {scenarioId:string}) => entry.scenarioId === s.scenarioId)
    const { result, observations } = evaluateMixedScenario(s, capture)
    assert.equal(result.status, 'COMPLETE')
    assert.ok(result.totalSalePrice)
    assert.equal(observations.length, 308)
    assert.equal(observations.filter((row: {status:string}) => row.status === 'UNVERIFIED').length, 0)
    const mismatches = observations
      .filter((row: {status:string}) => row.status === 'MISMATCH')
      .map((row: {address:string}) => row.address).sort()
    // Existing source disagreements must stay visible and must not affect the price assertions.
    assert.deepEqual(mismatches, s.scenarioId.endsWith('-installation')
      ? ['Z2!H9', 'Z2!K9'] : ['Z2!H16', 'Z2!H17', 'Z2!K9'])
    assert.ok(result.bom.some((row: {family:string}) => row.family === 'ZIGZAG'))
    assert.ok(result.bom.some((row: {family:string}) => row.family === 'LINE'))
  })
}

test('mode 3 does not bypass mixed-order selector validation', () => {
  const scenario = structuredClone(cases[0])
  const line = scenario.engineInput.positions.find((p: {family:string}) => p.family === 'LINE')
  const zigzag = scenario.engineInput.positions.find((p: {family:string}) => p.family === 'ZIGZAG')
  line.calculation.input.commercialModeIndex = 1
  assert.throws(() => calculateJVOrder(scenario.engineInput), {code:'INVALID_CONFIGURATION'})
  line.calculation.input.commercialModeIndex = 4
  zigzag.calculation.position.commercial.F28 = 4
  assert.throws(() => calculateJVOrder(scenario.engineInput), {code:'RULE_UNCONFIRMED'})
})

test('mode 3 keeps the guard against an incomplete Line price', () => {
  const scenario = structuredClone(cases[0])
  const line = scenario.engineInput.positions.find((p: {family:string}) => p.family === 'LINE')
  line.calculation.input.sideCount = '3'
  const result = calculateJVOrder(scenario.engineInput)
  assert.equal(result.status, 'PARTIAL')
  assert.equal(result.totalSalePrice, undefined)
})
