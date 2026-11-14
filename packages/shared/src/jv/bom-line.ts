import type { DecimalString, Unit } from './types.ts'
import { addDecimal, compareDecimal, decimalString, divideDecimalExact, multiplyDecimal, subtractDecimal } from './decimal.ts'
import { EngineError } from './errors.ts'
import { executeGraph } from './graph.ts'
import type { LineCarrierCuttingResult } from './geometry/cutting.ts'
import { LINE_MATERIAL_CATALOG, LINE_MATERIAL_CATALOG_VERSION, LINE_MATERIAL_CATALOG_SOURCES } from './catalog-line.ts'
import type { LineSashProfileResult } from './geometry/sash-cutting.ts'
import type { LineParkingComponentsResult } from './geometry/parking-components.ts'
import { divideRational, multiplyRational, rationalFromDecimal, roundRationalAwayFromZero } from './rational.ts'

export type LineBomStatus = 'PARTIAL' | 'COMPLETE'
export interface LineBomLine {
  readonly id: string
  readonly positionId: string
  readonly constructionId: string
  readonly kind: 'material' | 'component'
  readonly category: 'material' | 'component'
  readonly catalogId: string
  readonly sku: string
  readonly description: string
  /** Excel catalog label is retained; e.g. "п.м". */
  readonly unit: Unit
  readonly quantity: { readonly value: DecimalString; readonly unit: Unit }
  readonly sourceWorkbook: string
  readonly sourceCell: string
  readonly sourceFormula?: string
  readonly sourceExpression: string
  readonly catalogVersion: string
  readonly verification: 'NOT_YET_PARITY_TESTED'
  readonly traceStepIds: readonly string[]
  readonly sourceTraceStepId: string
}
export interface UnsupportedLineBomEntry {
  readonly id: string
  readonly sourceL1Row: number
  readonly sku: string
  readonly description: string
  readonly unit: string
  readonly quantitySourceCell: string
  readonly quantityFormula?: string
  readonly quantityConstant?: string
  readonly status: 'QUANTITY_RULE_NOT_IMPLEMENTED'
}
export interface LineMaterialBom {
  readonly schemaVersion: '1.0'
  readonly constructionId: string
  readonly catalogVersion: string
  readonly status: LineBomStatus
  readonly lines: readonly LineBomLine[]
  readonly unsupported: readonly UnsupportedLineBomEntry[]
  readonly trace: readonly ReturnType<typeof executeGraph>['trace'][number][]
  readonly parity: 'EXCEL_PARITY_UNVERIFIED'
}
export interface LineBomConfiguration {
  /** Resolved Excel source cells; no input-form/BMS parameter mapping is implied. */
  readonly leaves: DecimalString // L1!D5
  readonly sideCount: DecimalString // L1!D6
  readonly connectorAngle?: DecimalString // L1!D9; existing callers without it retain the confirmed 90-degree workbook path
  readonly direction: string // L1!D7
  readonly mountingFrameState: string // L1!D15
  readonly profileCount?: DecimalString // L1!D8, used by 90-degree rail plugs
  readonly floorLockState?: string // L1!D19
  readonly floorCloserState?: string // L1!D20
  readonly constructionHeight?: DecimalString // L1!D4, mm
  readonly sideProfileHeightAllowance?: DecimalString // Настройки!P3, mm
  readonly sideProfileCutAllowance?: DecimalString // Настройки!D8, mm
  readonly sashProfile?: LineSashProfileResult // L1!I42:I49 -> F39 -> O6/O7
  readonly brushUnitsPerRoll?: DecimalString // Настройки!L7
  readonly brushRollLengthMm?: DecimalString // Настройки!P21
  readonly parkingComponents?: LineParkingComponentsResult // D24, O12:O20, O26:O27
}

const BOM_RULE_VERSION = 'JV-LINE-BOM-2026-10-08'
const LN010_FORMULA = '=$D$32/1000+Настройки!$D$7/1000'
const CUTTING_STEP = 'JV.LINE.CARRIER_PROFILE_MATERIAL_QUANTITY'
const SIDE_PROFILE_CUT_STEP = 'JV.LINE.SIDE_PROFILE_CUT_LENGTH'

/**
 * Creates a deliberately partial BOM using the already calculated L1!O5 quantity.
 * No dimensions, cuts, component counts, or prices are recalculated here.
 */
export function buildLineMaterialBom(input: {
  readonly constructionId: string
  readonly cutting: LineCarrierCuttingResult
  readonly configuration: LineBomConfiguration
}): LineMaterialBom {
  const { constructionId, cutting, configuration } = input
  if (!constructionId.trim()) throw new EngineError('INVALID_CONFIGURATION', 'constructionId must not be empty')
  if (cutting.materialRequirement.catalogCode !== 'LN-010') {
    throw new EngineError('LOOKUP_NOT_FOUND', 'The existing cutting result is not mapped to the confirmed JV-Line carrier profile', {
      catalogCode: cutting.materialRequirement.catalogCode,
    })
  }
  const catalogEntry = LINE_MATERIAL_CATALOG.find((entry) => entry.sku === 'LN-010')
  if (!catalogEntry) throw new EngineError('LOOKUP_NOT_FOUND', 'LN-010 is missing from the versioned JV-Line material catalog')
  if (catalogEntry.unit !== cutting.materialRequirement.catalogUnit) {
    throw new EngineError('UNIT_MISMATCH', 'LN-010 catalog unit differs from the confirmed Excel material row', {
      catalogUnit: catalogEntry.unit,
      requirementUnit: cutting.materialRequirement.catalogUnit,
      source: 'L1!N5',
    })
  }
  const workbook = cutting.materialRequirement.catalogSource.workbook
  if (workbook !== LINE_MATERIAL_CATALOG_SOURCES.COMPLETATION && workbook !== LINE_MATERIAL_CATALOG_SOURCES.RETAIL) {
    throw new EngineError('INVALID_CONFIGURATION', 'Unsupported source workbook for the JV-Line catalog snapshot', { workbook })
  }

  const source = {
    workbook,
    sheet: 'L1',
    cell: 'O5',
    formula: LN010_FORMULA,
  } as const
  const ruleId = 'JV.LINE.BOM.LN010'
  const constantEntries = LINE_MATERIAL_CATALOG.filter((entry) => ['LN-210', 'LN-220'].includes(entry.sku) && entry.quantityConstant === '0')
  const implementedFormulaSkus = [
    'LN-050-L','LN-050-R','LN-060','LN-140-L','LN-140-R','LN-150','LN-160','LN-170','LN-TF','LN-TSL','LN-TSR',
    'LN-TL','LN-TR','LN-BL','LN-BR','LN-BF','LN-BSL','LN-BSR',
    ...(configuration.constructionHeight !== undefined && configuration.sideProfileHeightAllowance !== undefined && configuration.sideProfileCutAllowance !== undefined ? ['LN-040'] : []),
    ...(configuration.sashProfile === undefined ? [] : ['LN-020','LN-030']),
    ...(configuration.sashProfile !== undefined && configuration.brushUnitsPerRoll !== undefined && configuration.brushRollLengthMm !== undefined ? ['AA-010'] : []),
    ...(configuration.profileCount === undefined ? [] : ['LN-T90','LN-B90']),
    ...(configuration.floorLockState === undefined ? [] : ['LN-230']),
    ...(configuration.floorCloserState === undefined ? [] : ['LN-240']),
    ...(configuration.parkingComponents === undefined ? [] : ['LN-070-A','LN-070-B','LN-070-C','LN-080','LN-090','LN-100','LN-110','LN-120','LN-130','LN-190','LN-200']),
  ]
  const formulaEntries = implementedFormulaSkus.map((sku) => {
    const entry = LINE_MATERIAL_CATALOG.find((item) => item.sku === sku)
    if (!entry?.quantityFormula) throw new EngineError('LOOKUP_NOT_FOUND', `Confirmed quantity formula is missing for ${sku}`, { sku })
    return entry
  })
  let leaves: DecimalString
  let sides: DecimalString
  try {
    leaves = decimalString(configuration.leaves)
    sides = decimalString(configuration.sideCount)
  } catch (error) {
    throw new EngineError('INVALID_CONFIGURATION', 'L1!D5 and D6 must be numeric values for the supported quantity rules', {
      leaves: configuration.leaves, sideCount: configuration.sideCount,
      cause: error instanceof Error ? error.message : String(error),
    })
  }
  const inputValues = {
    [CUTTING_STEP]: decimalString(cutting.materialRequirement.quantity),
    D5: leaves,
    D6: sides,
    D9: decimalString(configuration.connectorAngle ?? '90'),
    D7: configuration.direction,
    D15: configuration.mountingFrameState,
    ...(configuration.profileCount === undefined ? {} : { D8: decimalString(configuration.profileCount) }),
    ...(configuration.floorLockState === undefined ? {} : { D19: configuration.floorLockState }),
    ...(configuration.floorCloserState === undefined ? {} : { D20: configuration.floorCloserState }),
    ...(configuration.constructionHeight === undefined ? {} : { D4: decimalString(configuration.constructionHeight) }),
    ...(configuration.sashProfile === undefined ? {} : { SASH_O6: decimalString(configuration.sashProfile.upperProfileQuantity), SASH_O7: decimalString(configuration.sashProfile.lowerProfileQuantity) }),
    ...(configuration.brushUnitsPerRoll === undefined ? {} : { SETTINGS_L7: decimalString(configuration.brushUnitsPerRoll) }),
    ...(configuration.brushRollLengthMm === undefined ? {} : { SETTINGS_P21: decimalString(configuration.brushRollLengthMm) }),
    ...(configuration.sideProfileHeightAllowance === undefined ? {} : { SETTINGS_P3: decimalString(configuration.sideProfileHeightAllowance) }),
    ...(configuration.sideProfileCutAllowance === undefined ? {} : { SETTINGS_D8: decimalString(configuration.sideProfileCutAllowance) }),
    ...(configuration.parkingComponents === undefined ? {} : Object.fromEntries(Object.entries({ 'LN-070-A':configuration.parkingComponents.O12,'LN-070-B':configuration.parkingComponents.O13,'LN-070-C':configuration.parkingComponents.O14,'LN-080':configuration.parkingComponents.O15,'LN-090':configuration.parkingComponents.O16,'LN-100':configuration.parkingComponents.O17,'LN-110':configuration.parkingComponents.O18,'LN-120':configuration.parkingComponents.O19,'LN-130':configuration.parkingComponents.O20,'LN-190':configuration.parkingComponents.O26,'LN-200':configuration.parkingComponents.O27}).map(([sku,value])=>[`PARKING_${sku}`,value]))),
  }
  const ruleFor = (entry: typeof catalogEntry extends infer T ? NonNullable<T> : never) => ({
    id: `JV.LINE.BOM.${entry.sku}`,
    version: BOM_RULE_VERSION,
    dependsOn: entry.sku === 'AA-010' ? ['SASH_O7','SETTINGS_L7','SETTINGS_P21']
      : entry.sku === 'LN-020' ? ['SASH_O6']
      : entry.sku === 'LN-030' ? ['SASH_O7']
      : ['LN-060'].includes(entry.sku) ? ['D5','D6']
      : ['LN-050-L','LN-050-R','LN-140-L','LN-140-R'].includes(entry.sku) ? ['D7','D6']
      : entry.sku === 'LN-040' ? [SIDE_PROFILE_CUT_STEP,'D15','SETTINGS_D8']
      : entry.sku === 'LN-150' ? ['D6']
      : ['LN-160','LN-170','LN-T90'].includes(entry.sku) ? ['D6','JV.LINE.FIXED_CONNECTOR_ANGLE']
      : entry.sku === 'LN-TL' ? ['D5','D7']
      : entry.sku === 'LN-TR' ? ['D5','D7','JV.LINE.BOM.LN-TL']
      : entry.sku === 'LN-BL' ? ['JV.LINE.BOM.LN-TL']
      : entry.sku === 'LN-BR' ? ['JV.LINE.BOM.LN-TR']
      : entry.sku === 'LN-BF' ? ['JV.LINE.BOM.LN-TF']
      : entry.sku === 'LN-BSL' ? ['JV.LINE.BOM.LN-TSL']
      : entry.sku === 'LN-BSR' ? ['JV.LINE.BOM.LN-TSR']
      : entry.sku === 'LN-B90' ? ['JV.LINE.BOM.LN-T90']
      : entry.sku === 'LN-230' ? ['D19']
      : entry.sku === 'LN-240' ? ['D20','D6']
      : ['LN-070-A','LN-070-B','LN-070-C','LN-080','LN-090','LN-100','LN-110','LN-120','LN-130','LN-190','LN-200'].includes(entry.sku) ? [`PARKING_${entry.sku}`]
      : ['D15'],
    source: { workbook, sheet: 'L1', cell: `O${entry.sourceL1Row}`, formula: entry.quantityFormula },
    execute: ({ inputs, results }: { readonly inputs: Readonly<Record<string, unknown>>; readonly results: Readonly<Record<string, unknown>> }) => {
      const d6 = decimalString(inputs.D6 as string)
      if (['LN-070-A','LN-070-B','LN-070-C','LN-080','LN-090','LN-100','LN-110','LN-120','LN-130','LN-190','LN-200'].includes(entry.sku)) return decimalString(inputs[`PARKING_${entry.sku}`] as string)
      if (entry.sku === 'LN-020') return decimalString(inputs.SASH_O6 as string)
      if (entry.sku === 'LN-030') return decimalString(inputs.SASH_O7 as string)
      if (entry.sku === 'AA-010') {
        const numerator = multiplyDecimal(decimalString('2'), decimalString(inputs.SASH_O7 as string))
        const denominator = divideRational(multiplyRational(rationalFromDecimal(inputs.SETTINGS_L7 as string), rationalFromDecimal(inputs.SETTINGS_P21 as string)), rationalFromDecimal('1000'))
        return roundRationalAwayFromZero(divideRational(rationalFromDecimal(numerator), denominator), 0)
      }
      if (entry.sku === 'LN-050-L' || entry.sku === 'LN-140-L') return configuration.direction === 'НАЛЕВО' || compareDecimal(d6, decimalString('2')) === 0 ? decimalString('1') : decimalString('0')
      if (entry.sku === 'LN-050-R' || entry.sku === 'LN-140-R') return configuration.direction === 'НАПРАВО' || compareDecimal(d6, decimalString('2')) === 0 ? decimalString('1') : decimalString('0')
      if (entry.sku === 'LN-060') return subtractDecimal(decimalString(inputs.D5 as string), d6)
      if (entry.sku === 'LN-040') {
        const sideCut = decimalString(results[SIDE_PROFILE_CUT_STEP] as string)
        return configuration.mountingFrameState === 'ДА'
          ? addDecimal(divideDecimalExact(multiplyDecimal(decimalString('2'), sideCut), decimalString('1000')), divideDecimalExact(decimalString(inputs.SETTINGS_D8 as string), decimalString('1000')))
          : decimalString('0')
      }
      if (entry.sku === 'LN-150') return multiplyDecimal(decimalString('3'), d6)
      if (entry.sku === 'LN-TL') {
        const leaves = decimalString(inputs.D5 as string)
        if (configuration.direction === 'НАЛЕВО') return subtractDecimal(multiplyDecimal(decimalString('2'), leaves), decimalString('2'))
        if (configuration.direction === 'ДВУХСТОР') return compareDecimal(leaves, decimalString('3')) <= 0 ? decimalString('2') : multiplyDecimal(decimalString('2'), subtractDecimal(leaves, decimalString('2')))
        return decimalString('0')
      }
      if (entry.sku === 'LN-TR') {
        const leaves = decimalString(inputs.D5 as string)
        const left = decimalString(results['JV.LINE.BOM.LN-TL'] as string)
        const directional = configuration.direction === 'НАПРАВО' ? subtractDecimal(multiplyDecimal(decimalString('2'), leaves), decimalString('2')) : decimalString('0')
        const twoSideExactTwo = configuration.direction === 'ДВУХСТОР' && compareDecimal(leaves, decimalString('2')) === 0 ? decimalString('2') : decimalString('0')
        const twoSideTerm = configuration.direction === 'ДВУХСТОР' ? subtractDecimal(subtractDecimal(multiplyDecimal(decimalString('2'), leaves), decimalString('2')), left) : decimalString('0')
        return addDecimal(addDecimal(directional, twoSideExactTwo), twoSideTerm)
      }
      if (entry.sku === 'LN-BL') return decimalString(results['JV.LINE.BOM.LN-TL'] as string)
      if (entry.sku === 'LN-BR') return decimalString(results['JV.LINE.BOM.LN-TR'] as string)
      if (entry.sku === 'LN-BF') return decimalString(results['JV.LINE.BOM.LN-TF'] as string)
      if (entry.sku === 'LN-BSL') return decimalString(results['JV.LINE.BOM.LN-TSL'] as string)
      if (entry.sku === 'LN-BSR') return decimalString(results['JV.LINE.BOM.LN-TSR'] as string)
      const sourceAngle = decimalString(results['JV.LINE.FIXED_CONNECTOR_ANGLE'] as string)
      if (entry.sku === 'LN-160') return multiplyDecimal(d6, compareDecimal(sourceAngle, decimalString('90')) === 0 ? decimalString('1') : decimalString('0'))
      if (entry.sku === 'LN-170') return multiplyDecimal(d6, compareDecimal(sourceAngle, decimalString('135')) === 0 ? decimalString('1') : decimalString('0'))
      if (entry.sku === 'LN-T90') return multiplyDecimal(decimalString(inputs.D8 as string), compareDecimal(sourceAngle, decimalString('90')) === 0 ? decimalString('1') : decimalString('0'))
      if (entry.sku === 'LN-B90') return decimalString(results['JV.LINE.BOM.LN-T90'] as string)
      if (entry.sku === 'LN-230') return configuration.floorLockState === 'ДА' ? decimalString('1') : decimalString('0')
      if (entry.sku === 'LN-240') return configuration.floorCloserState === 'ДА' ? d6 : decimalString('0')
      if (entry.sku === 'LN-TF') return configuration.mountingFrameState === 'ДА' ? decimalString('0') : decimalString('2')
      if (entry.sku === 'LN-TSL' || entry.sku === 'LN-TSR') return configuration.mountingFrameState === 'ДА' ? decimalString('1') : decimalString('0')
      throw new EngineError('RULE_FAILED', `No confirmed calculation branch for ${entry.sku}`, { sku: entry.sku })
    },
  })
  const graphRules = [...formulaEntries.map(ruleFor), ...constantEntries.map((entry) => ({
      id: `JV.LINE.BOM.${entry.sku}.CONSTANT`, version: BOM_RULE_VERSION, dependsOn: [] as readonly string[],
      source: { workbook, sheet: 'L1', cell: `O${entry.sourceL1Row}` }, execute: () => decimalString(entry.quantityConstant!),
    }))]
  const graph = executeGraph(
    inputValues,
    [{
      id: ruleId,
      version: BOM_RULE_VERSION,
      dependsOn: [CUTTING_STEP],
      source,
      execute: ({ inputs }) => decimalString(inputs[CUTTING_STEP] as string),
    }, {
      id: 'JV.LINE.FIXED_CONNECTOR_ANGLE',
      version: BOM_RULE_VERSION,
      dependsOn: ['D9'],
      source: { workbook, sheet: 'L1', cell: 'D9' },
      execute: ({inputs}) => decimalString(inputs.D9 as string),
    }, ...(configuration.constructionHeight !== undefined && configuration.sideProfileHeightAllowance !== undefined ? [{
      id: SIDE_PROFILE_CUT_STEP,
      version: BOM_RULE_VERSION,
      dependsOn: ['D4','D15','SETTINGS_P3'],
      source: { workbook, sheet: 'L1', cell: 'D33', formula: '=IF($D$15="ДА",($D$4-Настройки!$P$3),0)' },
      execute: ({ inputs }: { readonly inputs: Readonly<Record<string, unknown>> }) => configuration.mountingFrameState === 'ДА'
        ? subtractDecimal(decimalString(inputs.D4 as string), decimalString(inputs.SETTINGS_P3 as string))
        : decimalString('0'),
    }] : []), ...graphRules],
  )
  const quantity = graph.values[ruleId]
  if (typeof quantity !== 'string') throw new EngineError('RULE_FAILED', 'LN-010 BOM quantity rule did not return a decimal string', { ruleId })

  const supportedEntries = [catalogEntry, ...formulaEntries, ...constantEntries].sort((a, b) => a.sourceL1Row - b.sourceL1Row)
  const lines: LineBomLine[] = supportedEntries.map((entry): LineBomLine => {
    const constant = entry.quantityConstant === '0'
    const lineRuleId = constant ? `JV.LINE.BOM.${entry.sku}.CONSTANT` : entry.sku === 'LN-010' ? ruleId : `JV.LINE.BOM.${entry.sku}`
    const lineQuantity = graph.values[lineRuleId]
    if (typeof lineQuantity !== 'string') throw new EngineError('RULE_FAILED', 'BOM quantity rule did not return decimal text', { lineRuleId })
    const expression = constant ? entry.quantityConstant! : entry.sku === 'LN-010' ? LN010_FORMULA : entry.quantityFormula!
    return Object.freeze({
      id: `${constructionId}:LINE:${entry.sku}:L1!O${entry.sourceL1Row}`,
      positionId: constructionId,
      constructionId,
      kind: entry.category,
      category: entry.category,
      catalogId: entry.sku,
      sku: entry.sku,
      description: entry.description,
      unit: entry.unit,
      quantity: Object.freeze({ value: decimalString(lineQuantity), unit: entry.unit }),
      sourceWorkbook: workbook,
      sourceCell: `L1!O${entry.sourceL1Row}`,
      ...(constant ? {} : { sourceFormula: entry.quantityFormula }),
      sourceExpression: expression,
      catalogVersion: LINE_MATERIAL_CATALOG_VERSION,
      verification: 'NOT_YET_PARITY_TESTED',
      traceStepIds: Object.freeze([
      ...(entry.sku === 'LN-010' ? cutting.trace.filter((step) => step.id === CUTTING_STEP).map((step) => step.id) : []),
        ...(['LN-160','LN-170'].includes(entry.sku) ? ['JV.LINE.FIXED_CONNECTOR_ANGLE'] : []),
        ...(entry.sku === 'LN-040' ? [SIDE_PROFILE_CUT_STEP] : []),
        ...(entry.sku === 'LN-020' || entry.sku === 'LN-030' || entry.sku === 'AA-010' ? ['JV.LINE.SASH.F39'] : []),
        lineRuleId,
      ]),
      sourceTraceStepId: lineRuleId,
    })
  })
  const unsupported = LINE_MATERIAL_CATALOG
    .filter((entry) => !supportedEntries.some((supportedEntry) => supportedEntry.sku === entry.sku))
    .map((entry): UnsupportedLineBomEntry => Object.freeze({
      id: `${constructionId}:LINE:${entry.sku}:L1!O${entry.sourceL1Row}`,
      sourceL1Row: entry.sourceL1Row,
      sku: entry.sku,
      description: entry.description,
      unit: entry.unit,
      quantitySourceCell: `L1!O${entry.sourceL1Row}`,
      ...(entry.quantityFormula === undefined ? {} : { quantityFormula: entry.quantityFormula }),
      ...(entry.quantityConstant === undefined ? {} : { quantityConstant: entry.quantityConstant }),
      status: 'QUANTITY_RULE_NOT_IMPLEMENTED',
    }))
    .sort((a, b) => a.sourceL1Row - b.sourceL1Row || a.sku.localeCompare(b.sku, 'en'))

  return Object.freeze({
    schemaVersion: '1.0',
    constructionId,
    catalogVersion: LINE_MATERIAL_CATALOG_VERSION,
    status: unsupported.length === 0 ? 'COMPLETE' : 'PARTIAL',
    lines: Object.freeze(lines),
    unsupported: Object.freeze(unsupported),
    trace: Object.freeze([...cutting.trace, ...(configuration.sashProfile?.trace ?? []), ...graph.trace]),
    parity: 'EXCEL_PARITY_UNVERIFIED',
  })
}
