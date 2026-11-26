import { readFile, writeFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile(new URL('../../docs/jv/fixtures/unified-order-all-seven-f28-2-inputs.json', import.meta.url)))
const cases = [
  { id: 'base', line: [4000, 2500, 1], zigzag: [5000, 2600, 1], glass: true, milling: true },
  { id: 'installation', line: [4200, 2300, 2], zigzag: [4800, 2450, 3], glass: true, assembly: true, installation: true, milling: true },
  { id: 'extra-no-glass', line: [4000, 2500, 1], zigzag: [5000, 2600, 2], glass: false, milling: false, extra: true },
]

export function scenarios() {
  return manifest.scenarios.filter(entry => entry.scenarioId.endsWith('-base-f28-2')).flatMap(template => cases.map(spec => {
    const scenario = structuredClone(template)
    const writes = new Map(scenario.primaryInputWrites.map(input => [input.sheet + '!' + input.address, input]))
    const set = (sheet, address, value) => writes.set(sheet + '!' + address, { sheet, address, value })
    const watch = []
    const derivedInputs = []
    const read = (sheet, ...addresses) => watch.push(...addresses.map(address => ({ sheet, address })))
    for (const ref of scenario.primaryInputWrites) {
      if (ref.sheet !== 'Главная') continue
      if (/^K1[12]$/.test(ref.address)) {
        writes.delete(ref.sheet + '!' + ref.address)
        derivedInputs.push({ sheet: ref.sheet, address: ref.address, value: ref.value })
      } else if (/^M1[3-6]$/.test(ref.address)) {
        writes.delete(ref.sheet + '!' + ref.address)
        set(ref.sheet, ref.address.replace('M', 'L'), ref.value)
        derivedInputs.push({ sheet: ref.sheet, address: ref.address, value: ref.value })
      }
    }
    for (let slot = 3; slot <= 7; slot++) set('Главная', 'Z' + (10 + slot), 0)
    set('Главная', 'F28', 3)
    set('Главная', 'B26', null)
    const flags = { D32: spec.glass, D33: Boolean(spec.assembly), D34: Boolean(spec.installation), L3: spec.milling }
    for (const [key, value] of Object.entries(flags)) set('Настройки', key, value)
    const positions = scenario.engineInput.positions.filter(position => position.family === 'LINE' || position.family === 'ZIGZAG')
    for (const position of positions) {
      const { family, calculation, slot } = position
      const [width, height, quantity] = family === 'LINE' ? spec.line : spec.zigzag
      const row = 10 + slot
      for (const [column, value] of Object.entries({ C: width, D: height, Z: quantity })) set('Главная', column + row, value)
      position.quantity = String(quantity)
      if (family === 'LINE') {
        Object.assign(calculation.input, {
          widthMm: String(width), heightMm: String(height), constructionQuantity: String(quantity),
          commercialModeIndex: 3, assemblyEnabled: flags.D33, installationEnabled: flags.D34, millingEnabled: flags.L3,
        })
        calculation.settings.D32 = flags.D32
        read('L1', 'I25', 'I26', 'I27', 'D28', 'D29', 'D30', 'D31', 'D32')
        for (let material = 5; material <= 50; material++) read('L1', 'O' + material, 'P' + material, 'Q' + material)
        for (let cost = 52; cost <= 58; cost++) read('L1', 'Q' + cost)
      } else {
        Object.assign(calculation.position.geometry, { widthMm: String(width), heightMm: String(height) })
        Object.assign(calculation.position.commercial, flags, { F28: 3 })
        if (spec.extra) {
          set('Главная', 'H12', 2)
          set('Z2', 'N40', 2)
          set('Z2', 'N41', 3)
          Object.assign(calculation.position.commercial, { c8: '2', N40: '2', N41: '3' })
        }
        read('Z2', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H13', 'H14', 'H15', 'H16', 'H17', 'H18', 'D29', 'D30', 'D31')
        for (let material = 5; material <= 35; material++) read('Z2', 'K' + material, 'N' + material, 'O' + material, 'P' + material)
        for (let cost = 38; cost <= 44; cost++) read('Z2', 'P' + cost)
      }
    }
    read('Главная', 'AA11', 'AA12', 'AA18')
    read('Клей+акт', 'N12', 'N25', 'O5', 'O18')
    read('ПРМ', 'AB25', 'AB26')
    const scenarioId = scenario.profile.toLowerCase() + '-line-zigzag-f28-3-' + spec.id
    return {
      scenarioId, profile: scenario.profile, workbook: scenario.workbook, sourceSha256: scenario.sourceSha256,
      primaryInputWrites: [...writes.values()], derivedInputs, watch,
      engineInput: { ...scenario.engineInput, positions, orderId: scenarioId },
    }
  }))
}

if (import.meta.main) {
  if (!process.argv[2]) throw new Error('Usage: node tools/jv/prepare-line-zigzag-f28-3.mjs MANIFEST')
  await writeFile(process.argv[2], JSON.stringify(scenarios()))
}
