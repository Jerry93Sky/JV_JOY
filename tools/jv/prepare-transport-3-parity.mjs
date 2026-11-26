import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export function buildTransport3Manifest(manifest) {
  const scenarios = manifest.scenarios
    .filter(scenario => /-(base|quantity-all-distinct)-f28-2$/.test(scenario.scenarioId))
    .map(template => {
      const scenario = structuredClone(template)
      const independentB26 = scenario.scenarioId.includes('-base-') ? 1 : 2
      scenario.scenarioId = scenario.scenarioId.replace(/f28-2$/, 'f28-3')
      Object.assign(scenario.orderSettings, { F28: 3, frontMainSurchargeSelector: independentB26 })
      for (const input of scenario.primaryInputWrites) {
        if (input.sheet === 'Главная' && input.address === 'F28') input.value = 3
        if (input.sheet === 'Главная' && input.address === 'B26') input.value = independentB26
      }
      for (const { family, calculation } of scenario.engineInput.positions) {
        if (family === 'LINE') calculation.input.commercialModeIndex = 3
        else if (family === 'ZIGZAG') calculation.position.commercial.F28 = 3
        else if (family === 'FRONT') calculation.commercial.mainSurchargeSelector = 3
        else calculation.controls.mainSurchargeSelector = 3
      }
      const familyCells = {
        LINE: ['L', 'Q56'], ZIGZAG: ['Z', 'P42'], FRONT: ['F', 'S36'],
        SLIDER_L3: ['S', 'M51'], SLIDER_L5: ['S', 'M51'],
        SLIDER_X3: ['S', 'M51'], SLIDER_X5: ['S', 'M51'],
      }
      scenario.additionalOutputs = scenario.engineInput.positions.map(({ family, slot }) => {
        const [prefix, address] = familyCells[family]
        return { sheet: prefix + slot, address }
      })
      scenario.additionalOutputs.push({ sheet: '#1', address: 'C31' })
      return scenario
    })
  return { scenarios }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('../../docs/jv/fixtures/unified-order-all-seven-f28-2-inputs.json', import.meta.url)))
  await writeFile(process.argv[2], JSON.stringify(buildTransport3Manifest(manifest)))
}
