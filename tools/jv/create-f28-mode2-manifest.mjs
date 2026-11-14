import { readFile, writeFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile('docs/jv/fixtures/unified-order-all-seven-inputs.json', 'utf8'))
manifest.purpose = 'PR_15A R1: PR_13E scenarios with only order transport selector F28 changed to 2.'
for (const scenario of manifest.scenarios) {
  scenario.scenarioId += '-f28-2'
  scenario.orderSettings.F28 = 2
  const writes = scenario.primaryInputWrites.filter(write => write.sheet === 'Главная' && write.address === 'F28')
  if (writes.length !== 1 || writes[0].value !== 1) throw new Error('Unexpected source F28')
  writes[0].value = 2
  for (const position of scenario.engineInput.positions) {
    const c = position.calculation
    if (position.family === 'LINE') c.input.commercialModeIndex = 2
    else if (position.family === 'ZIGZAG') c.position.commercial.F28 = 2
    else if (position.family === 'FRONT') c.commercial.mainSurchargeSelector = 2
    else c.controls.mainSurchargeSelector = 2
  }
}
await writeFile('docs/jv/fixtures/unified-order-all-seven-f28-2-inputs.json', JSON.stringify(manifest, null, 2) + '\n')
console.log(`Prepared ${manifest.scenarios.length} F28=2 scenarios`)
