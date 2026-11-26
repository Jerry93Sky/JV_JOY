import { readFileSync, writeFileSync } from 'node:fs'
import { getUiDefaults } from '../../apps/backend/src/domain/jv/jvUiInputs.ts'

const [manifestPath, verifiedInputsPath] = process.argv.slice(2)
if (!manifestPath || !verifiedInputsPath) throw Error('Expected manifest and verified inputs output paths')

const source = JSON.parse(readFileSync('docs/jv/fixtures/unified-order-all-seven-inputs.json', 'utf8'))
const scenarios = source.scenarios.filter(scenario => scenario.profile === 'COMPLETATION')
for (const scenario of scenarios) {
  const glassSwitch = scenario.primaryInputWrites.find(write => write.sheet === 'Настройки' && write.address === 'D32')
  if (!glassSwitch) throw Error(`Missing D32 write for ${scenario.scenarioId}`)
  glassSwitch.value = false
  for (const position of scenario.engineInput.positions) {
    const { family, calculation } = position
    if (family === 'LINE') calculation.settings.D32 = false
    else if (family === 'ZIGZAG') calculation.position.commercial.D32 = false
    else if (family === 'FRONT') {
      calculation.commercial.glassEnabled = false
      calculation.commercial.excelGlassSwitchOff = true
    } else if (family.startsWith('SLIDER_')) calculation.controls.additionalWorkEnabled = false
    else throw Error(`Unexpected family ${family}`)
  }
}

const records = scenarios.map(({ scenarioId, engineInput }) => ({
  scenarioId,
  positions: engineInput.positions.map(({ id, slot, family, quantity, calculation }) => ({
    id, slot, family, quantity, calculation: getUiDefaults(family, calculation),
  })),
}))
writeFileSync(manifestPath, JSON.stringify({ ...source, scenarios }, null, 2) + '\n')
writeFileSync(verifiedInputsPath, JSON.stringify({ schemaVersion: '1.0', sourceSha256: scenarios[0].sourceSha256, records }, null, 2) + '\n')
