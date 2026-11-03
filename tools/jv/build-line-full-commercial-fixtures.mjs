import { readFileSync, writeFileSync } from 'node:fs'

const [rawPath, outputPath = 'docs/jv/fixtures/line-full-commercial-excel-golden.json'] = process.argv.slice(2)
if (!rawPath) throw new Error('Usage: node build-line-full-commercial-fixtures.mjs <Excel COM JSON> [output JSON]')
const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
const cases = raw.cases.map((result) => {
  const { scenarioInputs: scenario, scenarioSelectors: selectors, values } = result
  const line = values.L1
  const main = values.Main
  const profile = result.workbook.includes('розница') ? 'RETAIL' : 'COMPLETATION'
  const directionBySelector = { 1: 'НАЛЕВО', 2: 'НАПРАВО', 3: 'ДВУХСТОР' }
  const direction = directionBySelector[Number(scenario.main.openingSelector)]
  if (!direction) throw new Error(`Unsupported opening selector in ${result.scenarioId}`)
  const expected = Object.fromEntries(['Q52','Q53','Q54','Q55','Q56','Q57','Q58'].map((cell) => [cell, line[cell]]))
  const input = {
    constructionQuantity: String(main.Z11.value),
    widthMm: String(scenario.main.width),
    heightMm: String(scenario.main.height),
    leaves: String(line.D5.value),
    mainLeavesSelector: String(scenario.main.leaves),
    sideCount: String(line.D6.value),
    direction,
    profileCount: String(line.D8.value),
    connectorAngle: String(line.D9.value),
    frameState: String(line.D15.value),
    knobState: String(line.D16.value),
    latchState: String(line.D17.value),
    weatherSealState: String(line.D18.value),
    floorLockState: String(line.D19.value),
    bottomPivotState: String(line.D20.value),
    specialSashEnabled: Boolean(scenario.controls.specialSashEnabled),
    specialSashWidthMm: String(scenario.controls.specialSashWidth),
    rollerAxisToEdgeMm: String(scenario.controls.rollerAxisToEdge),
    parkedDoorSelected: Boolean(scenario.controls.parkedDoorSelected),
    parkedDoorPosition: String(scenario.controls.parkedDoorPosition),
    parkedDoorReuseOpening: Boolean(line.C25.value),
    parkedDoorWidthMm: String(line.D25.value),
    glassSelectionIndex: Number(selectors.glassIndex),
    finishSelectionIndex: Number(selectors.finishIndex),
    commercialModeIndex: Number(selectors.commercialModeIndex),
    assemblyEnabled: Boolean(values.Settings.D33.value),
    millingEnabled: Boolean(values.Settings.L3.value),
    installationEnabled: Boolean(values.Settings.D34.value),
  }
  const settings = Object.fromEntries(['P2','P3','P4','P5','P6','P7','P8','P9','P10','P12','P13','P14','P15','P16','P17','L23','D6','D7','D8','L4','L5','L6','L7','L8','P21'].map((cell) => [cell, String(values.Settings[cell].value)]))
  const mainInputMap = { widthMm: 'C11', heightMm: 'D11', directionSelector: 'J11', leaves: 'L11', quantity: 'Z11' }
  return {
    workbook: result.workbook,
    workbookSha256: result.workbookSha256,
    profile,
    scenarioId: result.scenarioId,
    excelVersion: result.excelVersion,
    macrosForceDisabled: result.macrosForceDisabled,
    scenarioInputs: scenario,
    selectors,
    input,
    inputProvenance: {
      mainInputs: mainInputMap,
      normalizedChoices: { frameState: 'L1!D15 selection from Настройки/#1 list', knobState: 'L1!D16 selection from Настройки/#1 list', latchState: 'L1!D17 selection from Настройки/#1 list', weatherSealState: 'L1!D18 selection from Настройки/#1 list', floorLockState: 'L1!D19 selection from Настройки/#1 list', bottomPivotState: 'L1!D20 selection from Настройки/#1 list' },
      formulaOutputsExcluded: ['I25','I26','I27','O15','O49','O50','Q52','Q53','Q54','Q55','Q56','Q57','Q58'],
    },
    settings,
    expected,
  }
})
writeFileSync(outputPath, `${JSON.stringify({ schemaVersion: '1.0', method: 'Excel 16 CalculateFullRebuild on temporary copies; macros force-disabled; events disabled; isolated JV-Line slot only.', scope: 'Ten varied construction scenarios per workbook; H11/I11 cycle through finish and glass selection indices; Z11=1 and Z12:Z17=0.', cases }, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ outputPath, cases: cases.length, perWorkbook: 10 }, null, 2)}\n`)
