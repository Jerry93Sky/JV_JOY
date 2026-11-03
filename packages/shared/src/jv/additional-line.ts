import type { DecimalString } from './types.ts'
import { addDecimal, decimalString, multiplyDecimal, subtractDecimal } from './decimal.ts'
import { EngineError } from './errors.ts'
import { executeGraph } from './graph.ts'
import { divideRational, rationalFromDecimal, roundRationalAwayFromZero, type ExactRational } from './rational.ts'

export interface LineAdditionalInputs {
  readonly constructionId: string
  readonly sourceWorkbook: string
  readonly baseQuantities: Readonly<{ O5?: string; O6?: string; O7?: string; O8?: string }>
  readonly width?: string // L1!D3
  readonly leaves?: string // L1!D5
  readonly sideCount?: string // L1!D6
  readonly profileCount?: string // L1!D8
  readonly connectorAngle?: string // L1!D9
  readonly frameState?: string // L1!D15
  readonly weatherSealState?: string // L1!D18
  readonly settings: Readonly<{ L4?: string; L5?: string; L6?: boolean; L7?: string; L8?: string; P21?: string }>
}
export interface LineAdditionalMaterialLine {
  readonly id: string
  readonly constructionId: string
  readonly sourceL1Row: number
  readonly sku: string
  readonly description: string
  readonly unit: 'м' | 'шт.'
  readonly quantity: ExactRational
  readonly formula: string
  readonly sourceWorkbook: string
  readonly sourceCell: string
  readonly traceStepId: string
  readonly ruleVersion: 'JV-LINE-ADDITIONAL-BOM-2026-10-08'
}
export interface LineAdditionalBomResult {
  readonly status: 'PARTIAL' | 'COMPLETE'
  readonly lines: readonly LineAdditionalMaterialLine[]
  readonly unsupported: readonly { readonly sourceL1Row: number; readonly sku: string; readonly sourceCell: string; readonly reason: 'MISSING_INPUT' }[]
  readonly trace: ReturnType<typeof executeGraph>['trace']
}

const RULE_VERSION = 'JV-LINE-ADDITIONAL-BOM-2026-10-08' as const
const ROWS = [
  { row: 45, sku: 'AA-020', description: 'Уплотнитель щёточный 7х12', unit: 'м', formula: '=(2*$O$5+IF($D$18="ДА",2*$O$6,0)+IF($D$15="ДА",$O$8,0))/Настройки!$L$8', needs: ['O5', 'O6', 'O8', 'D15', 'D18', 'L8'] },
  { row: 46, sku: 'AA-050', description: 'Уплотнитель светопрозр. h-типа, 3 м', unit: 'шт.', formula: '=IF($D$15="ДА",$D$5-1,$D$5+1)', needs: ['D15', 'D5'] },
  { row: 47, sku: 'AA-070', description: 'Уплотнитель светопрозр. D-типа, 3 м', unit: 'шт.', formula: '=IF($D$15="ДА",2,0)', needs: ['D15'] },
  { row: 48, sku: 'AA-090', description: 'Уплотнитель светопрозр. магнитн. 45 гр., 3 м', unit: 'шт.', formula: '=IF($D$9=90,$D$8,0)', needs: ['D9', 'D8'] },
  { row: 49, sku: 'AA-110', description: 'Активатор (50 мл)', unit: 'шт.', formula: '=ROUNDUP(0.001*2*$D$3/Настройки!$L$4,IF(Настройки!$L$6,0,3))', needs: ['D3', 'L4', 'L6'] },
  { row: 50, sku: 'AA-120', description: 'Клей (уп."колбаса")', unit: 'шт.', formula: '=ROUNDUP(0.001*2*$D$3/Настройки!$L$5,IF(Настройки!$L$6,0,3))', needs: ['D3', 'L5', 'L6'] },
] as const

export function buildLineAdditionalBom(input: LineAdditionalInputs): LineAdditionalBomResult {
  if (!input.constructionId.trim()) throw new EngineError('INVALID_CONFIGURATION', 'constructionId must not be empty')
  const values: Record<string, unknown> = {
    ...(input.width === undefined ? {} : { D3: input.width }),
    ...(input.leaves === undefined ? {} : { D5: input.leaves }),
    ...(input.sideCount === undefined ? {} : { D6: input.sideCount }),
    ...(input.profileCount === undefined ? {} : { D8: input.profileCount }),
    ...(input.connectorAngle === undefined ? {} : { D9: input.connectorAngle }),
    ...(input.frameState === undefined ? {} : { D15: input.frameState }),
    ...(input.weatherSealState === undefined ? {} : { D18: input.weatherSealState }),
    ...(input.baseQuantities.O5 === undefined ? {} : { O5: input.baseQuantities.O5 }),
    ...(input.baseQuantities.O6 === undefined ? {} : { O6: input.baseQuantities.O6 }),
    ...(input.baseQuantities.O7 === undefined ? {} : { O7: input.baseQuantities.O7 }),
    ...(input.baseQuantities.O8 === undefined ? {} : { O8: input.baseQuantities.O8 }),
    ...(input.settings.L4 === undefined ? {} : { L4: input.settings.L4 }),
    ...(input.settings.L5 === undefined ? {} : { L5: input.settings.L5 }),
    ...(input.settings.L6 === undefined ? {} : { L6: input.settings.L6 }),
    ...(input.settings.L7 === undefined ? {} : { L7: input.settings.L7 }),
    ...(input.settings.L8 === undefined ? {} : { L8: input.settings.L8 }),
    ...(input.settings.P21 === undefined ? {} : { P21: input.settings.P21 }),
  }
  const supported = ROWS.filter((row) => row.needs.every((key) => key in values))
  const rules = supported.map((row) => ({
    id: `JV.LINE.BOM.${row.sku}`,
    version: RULE_VERSION,
    dependsOn: [...row.needs],
    source: { workbook: input.sourceWorkbook, sheet: 'L1', cell: `O${row.row}`, formula: row.formula },
    execute: ({ inputs: source }: { readonly inputs: Readonly<Record<string, unknown>> }) => {
      const n = (key: string) => decimalString(String(source[key]))
      switch (row.sku) {
        case 'AA-020': {
          let numerator = multiplyDecimal(decimalString('2'), n('O5'))
          if (source.D18 === 'ДА') numerator = addDecimal(numerator, multiplyDecimal(decimalString('2'), n('O6')))
          if (source.D15 === 'ДА') numerator = addDecimal(numerator, n('O8'))
          return divideRational(rationalFromDecimal(numerator), rationalFromDecimal(n('L8')))
        }
        case 'AA-050': return rationalFromDecimal(source.D15 === 'ДА' ? subtractDecimal(n('D5'), decimalString('1')) : addDecimal(n('D5'), decimalString('1')))
        case 'AA-070': return rationalFromDecimal(source.D15 === 'ДА' ? decimalString('2') : decimalString('0'))
        case 'AA-090': return rationalFromDecimal(n('D9') === decimalString('90') ? n('D8') : decimalString('0'))
        case 'AA-110': return rationalFromDecimal(roundedGlueInput(n('D3'), n('L4'), source.L6 === true ? 0 : 3))
        case 'AA-120': return rationalFromDecimal(roundedGlueInput(n('D3'), n('L5'), source.L6 === true ? 0 : 3))
        default: throw new EngineError('RULE_FAILED', 'Unreachable additional quantity rule branch')
      }
    },
  }))
  const graph = executeGraph(values, rules)
  const lines: LineAdditionalMaterialLine[] = supported.map((row) => {
    const result = graph.values[`JV.LINE.BOM.${row.sku}`]
    if (!isRational(result)) throw new EngineError('RULE_FAILED', `Additional quantity did not return an exact rational for ${row.sku}`, { sku: row.sku })
    return Object.freeze({ id: `${input.constructionId}:LINE:${row.sku}:L1!O${row.row}`, constructionId: input.constructionId, sourceL1Row: row.row, sku: row.sku, description: row.description, unit: row.unit, quantity: result, formula: row.formula, sourceWorkbook: input.sourceWorkbook, sourceCell: `L1!O${row.row}`, traceStepId: `JV.LINE.BOM.${row.sku}`, ruleVersion: RULE_VERSION })
  })
  const unsupported = ROWS.filter((row) => !supported.includes(row)).map((row) => Object.freeze({ sourceL1Row: row.row, sku: row.sku, sourceCell: `L1!O${row.row}`, reason: 'MISSING_INPUT' as const }))
  return Object.freeze({ status: unsupported.length ? 'PARTIAL' : 'COMPLETE', lines: Object.freeze(lines), unsupported: Object.freeze(unsupported), trace: graph.trace })
}

function isRational(value: unknown): value is ExactRational { return typeof value === 'object' && value !== null && typeof (value as ExactRational).numerator === 'string' && typeof (value as ExactRational).denominator === 'string' }
function roundedGlueInput(width: DecimalString, denominator: DecimalString, digits: number): DecimalString {
  const numerator = multiplyDecimal(decimalString('0.002'), width)
  return roundRationalAwayFromZero(divideRational(rationalFromDecimal(numerator), rationalFromDecimal(denominator)), digits)
}
