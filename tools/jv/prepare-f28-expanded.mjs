import { readFile, writeFile } from 'node:fs/promises'

const base = JSON.parse(await readFile(new URL('../../docs/jv/fixtures/unified-order-all-seven-f28-2-inputs.json', import.meta.url)))
const front = 'FRONT'
const pair = ['LINE', 'ZIGZAG']
const triple = [...pair, front]
const cases = [
  { id: 'front-slot1', families: [front], slot: 1, b26: null },
  { id: 'front-slot1-inactive-front', families: [front], slot: 1, b26: null, inactiveFront: true },
  { id: 'front-slot7-blank-inactive-front', families: [front], b26: null, inactiveFront: true },
  { id: 'front-b26-1', families: [front], b26: 1 },
  { id: 'front-b26-2', families: [front], b26: 2 },
  { id: 'front-b26-blank', families: [front], b26: null },
  { id: 'line-zigzag', families: pair, b26: null },
  { id: 'line-zigzag-front', families: triple, b26: 1 },
  { id: 'installation', families: triple, b26: 1, installation: true },
  { id: 'extra-works', families: triple, b26: 2, assembly: true, zigzagOptions: true },
  { id: 'f28-2-control', families: triple, b26: 1, f28: 2 },
  { id: 'f28-1-control', families: triple, b26: 1, f28: 1 },
  { id: 'switches-off', families: triple, b26: 1, switchesOff: true },
  { id: 'front-invalid-door', families: [front], slot: 1, b26: null, invalidDoor: true },
]

const refs = {
  LINE: ['Q52','Q53','Q54','Q55','Q56','Q57','Q58'],
  ZIGZAG: ['P38','P39','P40','P41','P42','P43','P44'],
  FRONT: ['I23','S33','S34','S35','S36','S37','S38'],
}

export function prepareExpandedScenarios() {
  return base.scenarios.filter(row => row.scenarioId.endsWith('-base-f28-2')).flatMap(template => cases.map(spec => {
    const example = structuredClone(template)
    const positions = example.engineInput.positions
    const writes = new Map(example.primaryInputWrites.map(ref => [ref.sheet + '!' + ref.address, ref]))
    const set = (sheet, address, value, source) => writes.set(sheet + '!' + address, { sheet, address, value, source })
    const watch = [{ sheet: 'Главная', address: 'AA18' }]
    const derivedInputs = []
    for (const ref of example.primaryInputWrites) {
      if (ref.sheet !== 'Главная') continue
      if (/^K1[12]$/.test(ref.address)) {
        writes.delete(ref.sheet + '!' + ref.address)
      } else if (/^M1[3-6]$/.test(ref.address)) {
        writes.delete(ref.sheet + '!' + ref.address)
        set(ref.sheet, ref.address.replace(/^M/, 'L'), ref.value, 'Slider leaves input to CEILING')
        derivedInputs.push({ sheet: ref.sheet, address: ref.address, value: ref.value })
      }
    }
    const comparison = (sheet, address) => watch.push({ sheet, address })
    for (const position of positions) {
      if (!spec.families.includes(position.family)) set('Главная', 'Z' + (10 + position.slot), 0, 'Inactive position')
    }

    const d32 = !spec.switchesOff
    const l3 = !spec.switchesOff
    const f28 = spec.f28 ?? 3
    const d33 = Boolean(spec.assembly)
    const d34 = Boolean(spec.installation)
    for (const [address, value] of Object.entries({ D32: d32, D33: d33, D34: d34, L3: l3 })) {
      set('Настройки', address, value, 'Order switch')
    }
    set('Главная', 'F28', f28, 'Transport selector')
    set('Главная', 'B26', spec.b26, 'Independent Front slot 7 selector')
    const active = positions.filter(p => spec.families.includes(p.family))
    const frontInputs = example.primaryInputWrites.filter(ref => ref.family === front)
    if (spec.inactiveFront) {
      for (let slot = 1; slot <= 7; slot++) {
        const row = 10 + slot
        for (const ref of frontInputs) {
          const sheet = ref.sheet === 'Главная' ? ref.sheet : 'F' + slot
          const address = sheet === 'Главная' ? ref.address.replace(/17$/, String(row)) : ref.address
          set(sheet, address, ref.value, 'Front workbook input for inactive row')
        }
        if (slot !== (spec.slot ?? 7)) set('Главная', 'Z' + row, 0, 'Inactive Front position')
      }
    }
    for (const position of active) {
      const { family, calculation } = position
      if (family === 'LINE') {
        Object.assign(calculation.input, { commercialModeIndex: f28, assemblyEnabled: d33, millingEnabled: l3, installationEnabled: d34 })
        calculation.settings.D32 = d32
      } else if (family === 'ZIGZAG') {
        Object.assign(calculation.position.commercial, { F28: f28, D32: d32, D33: d33, D34: d34, L3: l3 })
        if (spec.zigzagOptions) {
          set('Главная', 'H12', 2, 'Zigzag activates P39 at C8=2')
          set('Z2', 'N40', 2, 'Manual Zigzag work quantity')
          set('Z2', 'N41', 3, 'Manual Zigzag work quantity')
          Object.assign(calculation.position.commercial, { c8: '2', N40: '2', N41: '3' })
        }
      } else {
        Object.assign(calculation.commercial, { mainSurchargeSelector: f28, glassEnabled: d32, installationEnabled: d34 })
        calculation.commercial.excelGlassSwitchOff = !d32
        if (spec.slot === 1) {
          position.slot = 1
          for (const ref of frontInputs) {
            const targetSheet = ref.sheet === 'F7' ? 'F1' : ref.sheet
            const targetAddress = targetSheet === 'Главная' ? ref.address.replace(/17$/, '11') : ref.address
            set(targetSheet, targetAddress, ref.value, 'Front moved to slot 1: ' + ref.source)
          }
          set('Главная', 'Z17', 0, 'Front moved to slot 1')
          if (spec.invalidDoor) {
            calculation.construction.openingSelector = 1
            set('Главная', 'J11', 1, 'Incompatible door with I42=1')
          }
        }
      }
      if (family === 'LINE' || family === 'ZIGZAG' || family === 'FRONT') {
        derivedInputs.push({
          sheet: 'Главная', address: 'K' + (10 + position.slot),
          value: family === 'FRONT' && !spec.invalidDoor ? 3 : 1,
        })
      }
      const prefix = { LINE: 'L', ZIGZAG: 'Z', FRONT: 'F' }[family]
      for (const address of refs[family]) comparison(prefix + position.slot, address)
      comparison('Главная', 'AA' + (10 + position.slot))
    }
    for (let slot = 1; slot <= 7; slot++) {
      if (active.some(p => p.slot === slot)) continue
      watch.push({ sheet: 'Главная', address: 'AA' + (10 + slot), diagnostic: true })
    }
    if (spec.inactiveFront || ['front-slot1', 'front-b26-1'].includes(spec.id)) {
      for (const address of ['N12','N25','O5','O18']) watch.push({ sheet: 'Клей+акт', address, diagnostic: true })
      const inactiveSlot = spec.slot === 1 ? 2 : 1
      const inactiveSheet = inactiveSlot === 1 ? 'L1' : 'Z2'
      watch.push({ sheet: inactiveSheet, address: inactiveSlot === 1 ? 'Q58' : 'P44', diagnostic: true })
    }
    watch.push(
      { sheet: '#1', address: 'C' + (28 + f28), diagnostic: true },
      { sheet: 'Прайс-сб+монт', address: 'C25', diagnostic: true },
      { sheet: 'F7', address: 'Y5', diagnostic: true },
    )
    for (const ref of derivedInputs) {
      if (ref.address.startsWith('M')) {
        ref.value = Math.ceil(writes.get(ref.sheet + '!' + ref.address.replace(/^M/, 'L')).value)
      }
    }
    return {
      scenarioId: example.profile.toLowerCase() + '-' + spec.id,
      profile: example.profile, workbook: example.workbook, sourceSha256: example.sourceSha256,
      f28, b26: spec.b26, primaryInputWrites: [...writes.values()], derivedInputs, watch,
      engineInput: { ...example.engineInput, orderId: example.profile.toLowerCase() + '-' + spec.id, positions: active },
    }
  }))
}

if (import.meta.main) {
  if (!process.argv[2]) throw new Error('Usage: node tools/jv/prepare-f28-expanded.mjs MANIFEST')
  await writeFile(process.argv[2], JSON.stringify(prepareExpandedScenarios()))
}
