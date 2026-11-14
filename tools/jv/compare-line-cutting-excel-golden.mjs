import { readFileSync, writeFileSync } from 'node:fs'
import { calculateLineGeometryAndCuts } from '../../packages/shared/src/jv/geometry/cutting.ts'
import { buildLineMaterialBom } from '../../packages/shared/src/jv/bom-line.ts'
import { calculateLineMaterialCost } from '../../packages/shared/src/jv/pricing-line.ts'
import { buildLineAdditionalBom } from '../../packages/shared/src/jv/additional-line.ts'
import { calculateLineAdditionalMaterialCost, aggregateLineQ52MaterialSubtotal } from '../../packages/shared/src/jv/pricing-line.ts'
import { calculateLineWorkCosts } from '../../packages/shared/src/jv/line-work-cost.ts'
import { rationalToDecimalExact } from '../../packages/shared/src/jv/rational.ts'
import { calculateLineSashProfileLengths } from '../../packages/shared/src/jv/geometry/sash-cutting.ts'
import { calculateLineParkingComponents } from '../../packages/shared/src/jv/geometry/parking-components.ts'
import { compareDecimal, decimalString } from '../../packages/shared/src/jv/decimal.ts'

const sourcePath = process.argv[2]
const outputPath = process.argv[3]
if (!sourcePath || !outputPath) {
  throw new Error('Usage: node --experimental-strip-types tools/jv/compare-line-cutting-excel-golden.mjs <excel-results.json> <golden-fixture.json>')
}
const run = JSON.parse(readFileSync(sourcePath, 'utf8'))
const priceSnapshots = JSON.parse(readFileSync('docs/jv/fixtures/line-price-snapshots.json', 'utf8')).sources
const priceSnapshotByProfile = new Map(priceSnapshots.map(snapshot => [snapshot.profile, snapshot]))
const byWorkbook = new Map()
const numericCells = ['D5','D6','D8','D33','F39','O6','O7','O12','O13','O14','O15','O16','O17','O18','O19','O20','O26','O27','I25','I26','I27','C28','D28','C29','D29','C30','D30','C31','D31','D32','O5','Q55','Q57']
const textCells = ['D19','D20','D23','D24','L5','M5','N5']
let mismatchCount = 0

function valueOf(record, cell) { return record.values.L1[cell]?.value }
function dec(value) { return decimalString(String(value)) }
function compareNumber(actual, expected) {
  try { return compareDecimal(decimalString(String(actual)), decimalString(String(expected))) === 0 } catch { return false }
}

for (const record of run.cases) {
  const source = record.scenarioInputs
  const settings = source.settings
  const d5 = valueOf(record, 'D5')
  const d6 = valueOf(record, 'D6')
  const d15 = valueOf(record, 'D15')
  const d22 = valueOf(record, 'D22')
  const opening = {
    openingWidth: dec(source.main.width),
    leaves: dec(d5),
    sideCount: dec(d6),
    specialSashEnabled: Boolean(source.controls.specialSashEnabled),
    specialSashWidth: dec(source.controls.specialSashWidth),
    mountingFrameState: String(d15),
    unit: 'mm',
    settings: {
      sideClearance: dec(settings.P15),
      interLeafClearance: dec(settings.P14),
      sideProfileWidth: dec(settings.P4),
      rollerAxisToEdge: dec(d22),
    },
  }
  const sashProfile = calculateLineSashProfileLengths({
    workbook: record.workbook,
    openingWidth: dec(valueOf(record, 'D3')),
    constructionHeight: dec(valueOf(record, 'D4')),
    leaves: dec(d5), sides: dec(d6), frameState: String(d15),
    specialSash: Boolean(valueOf(record, 'C21')), specialSashWidth: dec(valueOf(record, 'D21')),
    parkedDoorSelected: Boolean(valueOf(record, 'C23')), parkedDoorPosition: dec(valueOf(record, 'C24')),
    parkedDoorReuseOpening: Boolean(valueOf(record, 'C25')), parkedDoorWidth: dec(valueOf(record, 'D25')),
    settings: { P3: dec(record.values.Settings.P3.value), P4: dec(record.values.Settings.P4.value), P12: dec(record.values.Settings.P12.value), P13: dec(record.values.Settings.P13.value), P14: dec(settings.P14), P15: dec(settings.P15), P16: dec(record.values.Settings.P16.value), P17: dec(record.values.Settings.P17.value), L23: dec(record.values.Settings.L23.value), D6: dec(record.values.Settings.D6.value) },
  })
  const engine = calculateLineGeometryAndCuts({
    opening,
    parking: {
      parkedDoorSelected: Boolean(source.controls.parkedDoorSelected),
      parkedDoorPosition: dec(source.controls.parkedDoorPosition),
      settings: {
        edgeToSwingAxis: dec(settings.P8),
        sashProfileWidth: dec(settings.P5),
        sideLockHandleProjection: dec(settings.P9),
        parkingDepthReserve: dec(settings.P10),
        rollerAxisToEdge: dec(d22),
      },
    },
    cuttingSettings: {
      carrierProfileWidth: { value: dec(settings.P2), unit: 'mm' },
      teeWidth: { value: dec(settings.P6), unit: 'mm' },
      teeProjection: { value: dec(settings.P7), unit: 'mm' },
      carrierProfileAllowance: { value: dec(settings.carrierProfileAllowance), unit: 'mm' },
    },
    sourceWorkbook: record.workbook,
  })
  const parkingComponents = calculateLineParkingComponents({ workbook:record.workbook,leaves:dec(d5),sides:dec(d6),direction:String(valueOf(record,'D7')),doorState:engine.parking.doorState,doorPosition:dec(valueOf(record,'C24')),parkingPartCount:engine.parking.parkingPartCount,knobState:String(valueOf(record,'D16')),latchState:String(valueOf(record,'D17')),bottomPivotState:String(valueOf(record,'D20')) })
  const configuration = {
    leaves: dec(d5),
    sideCount: dec(d6),
    direction: String(valueOf(record, 'D7')),
    mountingFrameState: String(d15),
    profileCount: dec(valueOf(record, 'D8')),
    floorLockState: String(valueOf(record, 'D19')),
    floorCloserState: String(valueOf(record, 'D20')),
    constructionHeight: dec(valueOf(record, 'D4')),
    sideProfileHeightAllowance: dec(record.values.Settings.P3.value),
    sideProfileCutAllowance: dec(record.values.Settings.D8.value),
    sashProfile,
    brushUnitsPerRoll: dec(record.values.Settings.L7.value),
    brushRollLengthMm: dec(record.values.Settings.P21.value),
  }
  const expected = Object.fromEntries([...numericCells, ...textCells].map(cell => [cell, valueOf(record, cell)]))
  const bom = buildLineMaterialBom({ constructionId: `${record.scenarioId}:${record.workbook}`, cutting: engine.cutting, configuration:{...configuration,parkingComponents} })
  const profile = record.workbook.includes('комплектация') ? 'COMPLETATION' : 'RETAIL'
  const materialCost = calculateLineMaterialCost({ bom, snapshot: priceSnapshotByProfile.get(profile) })
  const additionalBom = buildLineAdditionalBom({
    constructionId: `${record.scenarioId}:${record.workbook}:EXTRA`, sourceWorkbook: record.workbook,
    baseQuantities: Object.fromEntries(bom.lines.filter(line => ['L1!O5','L1!O6','L1!O7','L1!O8'].includes(line.sourceCell)).map(line => [line.sourceCell.slice(-2),line.quantity.value])),
    width: String(valueOf(record,'D3')), leaves: String(valueOf(record,'D5')), sideCount: String(valueOf(record,'D6')), profileCount: String(valueOf(record,'D8')), connectorAngle: String(valueOf(record,'D9')),
    frameState: String(valueOf(record,'D15')), weatherSealState: String(valueOf(record,'D18')),
    settings: Object.fromEntries(['L4','L5','L6','L7','L8','P21'].map(key => [key,record.values.Settings[key].value])),
  })
  const adhesiveFactors = Object.fromEntries(['O5','O18'].map(key => [key,record.values.Glue[key].value]))
  const additionalCost = calculateLineAdditionalMaterialCost({ bom: additionalBom, profile, snapshot: priceSnapshotByProfile.get(profile), adhesiveFactors })
  const q52MaterialSubtotal = aggregateLineQ52MaterialSubtotal({ base: materialCost, additional: additionalCost })
  const workCosts = calculateLineWorkCosts({ workbook: record.workbook, profile, snapshot: priceSnapshotByProfile.get(profile), widthMm: String(valueOf(record,'D3')), heightMm: String(valueOf(record,'D4')), leaves: String(valueOf(record,'D5')), sides: String(valueOf(record,'D6')), profileCount: String(valueOf(record,'D8')), parkedDoorSelected: Boolean(valueOf(record,'C23')), parkingPartCount: String(valueOf(record,'O15')), assemblyEnabled: Boolean(record.values.Settings.D33.value), millingEnabled: Boolean(record.values.Settings.L3.value), installationEnabled: Boolean(record.values.Settings.D34.value) })
  const bomLine = bom.lines.find(line => line.sku === 'LN-010')
  const materialPositions = Array.from({ length: 40 }, (_, index) => {
    const row = index + 5
    const excel = Object.fromEntries(['L', 'M', 'N', 'O'].map(column => {
      const cell = `${column}${row}`
      return [column, valueOf(record, cell)]
    }))
    const implemented = bom.lines.find(line => line.sourceCell === `L1!O${row}`)
    const unsupported = bom.unsupported.find(item => item.sourceL1Row === row)
    return {
      sourceRow: row,
      excel: { sku: excel.L, description: excel.M, unit: excel.N, quantity: excel.O },
      engineStatus: implemented ? (row === 5 ? 'IMPLEMENTED_LN_010' : [40,41].includes(row) ? 'IMPLEMENTED_CONFIRMED_CONSTANT' : 'IMPLEMENTED_RULE') : unsupported?.status ?? 'NO_CATALOG_MAPPING',
    }
  })
  const actual = {
    D5: opening.leaves,
    D6: opening.sideCount,
    D8: configuration.profileCount,
    D33: bom.trace.find(step => step.id === 'JV.LINE.SIDE_PROFILE_CUT_LENGTH')?.result ?? '0',
    F39: sashProfile.profileLengthTotal,
    O6: sashProfile.upperProfileQuantity,
    O7: sashProfile.lowerProfileQuantity,
    Q55: rationalToDecimalExact(workCosts.assemblyAndMilling),
    Q57: rationalToDecimalExact(workCosts.installation),
    O12:parkingComponents.O12,O13:parkingComponents.O13,O14:parkingComponents.O14,O16:parkingComponents.O16,O17:parkingComponents.O17,O18:parkingComponents.O18,O19:parkingComponents.O19,O20:parkingComponents.O20,O26:parkingComponents.O26,O27:parkingComponents.O27,
    D19: configuration.floorLockState,
    D20: configuration.floorCloserState,
    D23: engine.parking.doorState,
    D24: parkingComponents.D24,
    O15: engine.parking.parkingPartCount,
    I25: engine.openingWidth.I25.value,
    I26: engine.parking.depth.value,
    I27: engine.openingWidth.I27.value,
    C28: engine.cutting.items[0].quantity.value,
    D28: engine.cutting.items[0].cutLength.value,
    C29: engine.cutting.items[1].quantity.value,
    D29: engine.cutting.items[1].cutLength.value,
    C30: engine.cutting.items[2].quantity.value,
    D30: engine.cutting.items[2].cutLength.value,
    C31: engine.cutting.items[3].quantity.value,
    D31: engine.cutting.items[3].cutLength.value,
    D32: engine.cutting.totalCutLength.value,
    O5: engine.cutting.materialRequirement.quantity,
    L5: engine.cutting.materialRequirement.catalogCode,
    M5: engine.cutting.materialRequirement.description,
    N5: engine.cutting.materialRequirement.catalogUnit,
    bomLineCount: bom.lines.length,
    bomStatus: bom.status,
    bomSKU: bomLine?.sku,
    bomDescription: bomLine?.description,
    bomUnit: bomLine?.unit,
    bomQuantity: bomLine?.quantity.value,
    bomSourceCell: bomLine?.sourceCell,
    bomVerification: bomLine?.verification,
    unsupportedCount: bom.unsupported.length,
    bomPositions: bom.lines.map(line => ({ sku: line.sku, description: line.description, unit: line.unit, quantity: line.quantity.value, sourceCell: line.sourceCell, sourceExpression: line.sourceExpression })),
    materialCost: { profile: materialCost.profile, currency: materialCost.currency, priceSnapshotVersion: materialCost.priceSnapshotVersion, completeness: materialCost.completeness, supportedSubtotal: materialCost.supportedSubtotal, positions: materialCost.positions, unsupportedPositions: materialCost.unsupportedPositions, trace: materialCost.trace },
    additionalBomPositions: additionalBom.lines,
    unsupportedAdditionalBom: additionalBom.unsupported,
    additionalMaterialCost: { supportedSubtotal: additionalCost.supportedSubtotal, positions: additionalCost.positions, trace: additionalCost.trace, adhesiveFactors },
    q52MaterialSubtotal: { status: q52MaterialSubtotal.status, sourceFormula: q52MaterialSubtotal.sourceFormula, supportedSubtotal: q52MaterialSubtotal.supportedSubtotal, supportedSourceCells: q52MaterialSubtotal.supportedSourceCells, unsupportedPositions: q52MaterialSubtotal.unsupportedPositions, trace: q52MaterialSubtotal.trace },
    workCosts: { profile: workCosts.profile, priceSnapshotVersion: workCosts.priceSnapshotVersion, assemblyAndMilling: workCosts.assemblyAndMilling, installation: workCosts.installation, trace: workCosts.trace },
    parkingComponents,
  }
  const differences = []
  for (const cell of numericCells) if (!compareNumber(actual[cell], expected[cell])) differences.push({ cell, excel: expected[cell], engine: actual[cell] })
  for (const cell of textCells) if (String(actual[cell]) !== String(expected[cell])) differences.push({ cell, excel: expected[cell], engine: actual[cell] })
  for (const [field, cell] of [['bomSKU', 'L5'], ['bomDescription', 'M5'], ['bomUnit', 'N5'], ['bomQuantity', 'O5']]) {
    if (String(actual[field]) !== String(expected[cell])) differences.push({ cell, field, excel: expected[cell], engine: actual[field] })
  }
  if (actual.bomLineCount !== 40 || actual.bomStatus !== 'COMPLETE' || actual.unsupportedCount !== 0 || actual.bomSourceCell !== 'L1!O5') {
    differences.push({ field: 'BOM structure', expected: { lineCount: 40, status: 'COMPLETE', unsupportedCount: 0, sourceCell: 'L1!O5' }, actual: { lineCount: actual.bomLineCount, status: actual.bomStatus, unsupportedCount: actual.unsupportedCount, sourceCell: actual.bomSourceCell } })
  }
  for (const line of bom.lines.filter(line => line.sku !== 'LN-010')) {
    const row = Number(line.sourceCell.match(/O(\d+)/)?.[1])
    const excelPosition = materialPositions.find(position => position.sourceRow === row)
    if (!excelPosition || String(excelPosition.excel.quantity) !== line.quantity.value || excelPosition.excel.sku !== line.sku || excelPosition.excel.description !== line.description || excelPosition.excel.unit !== line.unit) {
      differences.push({ field: 'BOM material line', sourceCell: line.sourceCell, excel: excelPosition?.excel, engine: line })
    }
  }
  actual.bomVerification = differences.length === 0 ? 'EXCEL_GOLDEN_CASE_SET' : 'NOT_YET_PARITY_TESTED'
  mismatchCount += differences.length
  const normalizedInput = {
    scenario: source,
    settingsControls: { D33: record.values.Settings.D33.value, L3: record.values.Settings.L3.value, D34: record.values.Settings.D34.value },
    resolvedFromExcel: { D4: String(valueOf(record, 'D4')), D5: String(d5), D6: String(d6), D7: String(valueOf(record, 'D7')), D8: String(valueOf(record, 'D8')), D9: String(valueOf(record, 'D9')), D15: String(d15), D16: String(valueOf(record,'D16')), D17: String(valueOf(record,'D17')), D19: String(valueOf(record, 'D19')), D20: String(valueOf(record, 'D20')), D22: String(d22), P3: record.values.Settings.P3.value, SettingsD8: record.values.Settings.D8.value, P1: record.values.Settings.P1.value },
    sashProfileResolved: { openingWidth: String(valueOf(record,'D3')), constructionHeight: String(valueOf(record,'D4')), leaves: String(d5), sides: String(d6), frameState: String(d15), specialSash: Boolean(valueOf(record,'C21')), specialSashWidth: String(valueOf(record,'D21')), parkedDoorSelected: Boolean(valueOf(record,'C23')), parkedDoorPosition: String(valueOf(record,'C24')), parkedDoorReuseOpening: Boolean(valueOf(record,'C25')), parkedDoorWidth: String(valueOf(record,'D25')), settings: Object.fromEntries(['P3','P4','P12','P13','P14','P15','P16','P17','L23','D6','L7','P21'].map(key => [key,record.values.Settings[key].value])) },
  }
  const item = {
    id: record.scenarioId,
    input: normalizedInput,
    excel: expected,
    excelMaterialPositions: materialPositions,
    engine: actual,
    differences,
    exactMatch: differences.length === 0,
  }
  if (!byWorkbook.has(record.workbook)) byWorkbook.set(record.workbook, { name: record.workbook, sha256: record.workbookSha256, excelVersion: record.excelVersion, macrosForceDisabled: record.macrosForceDisabled, cases: [] })
  byWorkbook.get(record.workbook).cases.push(item)
}

const result = {
  schemaVersion: '1.0',
  generatedAt: run.runAt,
  method: 'Microsoft Excel 16.0 CalculateFullRebuild on per-scenario workbook copies with macros force-disabled; cell Value2 is captured as invariant decimal text plus original IEEE-754 binary64 bits, display text and number format. Decimal outputs are compared as exact decimal values; no epsilon or JS Number arithmetic is used in engine comparison.',
  sourceBooks: [...byWorkbook.values()],
  totalCases: run.cases.length,
  exactMatches: run.cases.length - [...byWorkbook.values()].flatMap(x => x.cases).filter(x => !x.exactMatch).length,
  mismatchCount,
  parityStatus: mismatchCount === 0 ? 'EXACT_MATCH_FOR_LISTED_CASES' : 'EXACT_DIFFERENCES_RECORDED',
}
writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8')
process.stdout.write(`${JSON.stringify({ outputPath, totalCases: result.totalCases, exactMatches: result.exactMatches, mismatchCount, parityStatus: result.parityStatus }, null, 2)}\n`)
if (mismatchCount > 0) process.exitCode = 1
