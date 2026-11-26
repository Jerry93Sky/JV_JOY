import { readFile, writeFile } from 'node:fs/promises'
import { calculateJVOrder } from '../../packages/shared/src/jv/unified-order.ts'
import { transportComparisons, transportOrderInput, verifyCapturedInputs } from './transport-3-parity.mjs'

const [manifestPath, capturePath, outputPath] = process.argv.slice(2)
if (!manifestPath || !capturePath || !outputPath) {
  throw new Error('Usage: node --experimental-strip-types tools/jv/compare-transport-3-parity.mjs MANIFEST CAPTURE REPORT')
}
const { scenarios } = JSON.parse(await readFile(manifestPath))
const captures = JSON.parse(await readFile(capturePath))
if (scenarios.length !== 4 || captures.length !== 4) throw new Error('Expected two scenarios per profile')
const cases = scenarios.map(scenario => {
  const captured = captures.find(item => item.scenarioId === scenario.scenarioId)
  verifyCapturedInputs(scenario, captured)
  const result = calculateJVOrder(transportOrderInput(scenario))
  return {
    scenarioId: scenario.scenarioId,
    profile: scenario.profile,
    sourceSha256: captured.sourceSha256,
    excelVersion: captured.excelVersion,
    calculationMode: captured.calculationMode,
    inputsChecked: captured.inputCells.length,
    F28: scenario.orderSettings.F28,
    B26: scenario.orderSettings.frontMainSurchargeSelector,
    selectorLabel: captured.additionalOutputs['#1!C31'].value2,
    engineStatus: result.status,
    comparisons: transportComparisons(result, captured),
  }
})
const counts = Object.fromEntries(['EXACT', 'NUMERICALLY_EQUIVALENT', 'DISPLAY_MATCH', 'MISMATCH', 'UNVERIFIED'].map(s => [s, 0]))
for (const item of cases) for (const row of item.comparisons) counts[row.status]++
await writeFile(outputPath, JSON.stringify({ schemaVersion: '1.0', counts, cases }, null, 2) + '\n')
console.log(JSON.stringify(counts))
if (counts.MISMATCH || counts.UNVERIFIED || cases.some(item => item.engineStatus !== 'COMPLETE')) process.exitCode = 1
