import type { DecimalString } from '../types.ts'
import { addDecimal, compareDecimal, decimalString, divideDecimalExact, divideDecimalTruncateToInteger, multiplyDecimal, subtractDecimal } from '../decimal.ts'
import { EngineError } from '../errors.ts'
import { executeGraph, type CalculationRule } from '../graph.ts'

export interface LineSashProfileInput {
  readonly workbook: string
  readonly openingWidth: string // L1!D3, mm
  readonly constructionHeight: string // L1!D4, mm
  readonly leaves: string // L1!D5
  readonly sides: string // L1!D6; must be numeric 1 or 2
  readonly frameState: string // L1!D15
  readonly specialSash: boolean // L1!C21
  readonly specialSashWidth?: string // L1!D21, required only when C21 is true
  readonly parkedDoorSelected: boolean // L1!C23
  readonly parkedDoorPosition: string // L1!C24
  readonly parkedDoorReuseOpening: boolean // L1!C25
  readonly parkedDoorWidth?: string // L1!D25, required only when C23 and C25 are true
  readonly settings: Readonly<{ P3: string; P4: string; P12: string; P13: string; P14: string; P15: string; P16: string; P17: string; L23: string; D6: string }>
}
export interface LineSashProfileResult {
  readonly profileLengthTotal: DecimalString // L1!F39, mm
  readonly upperProfileQuantity: DecimalString // L1!O6, m
  readonly lowerProfileQuantity: DecimalString // L1!O7, m
  readonly intermediates: Readonly<Record<string, DecimalString>>
  readonly trace: ReturnType<typeof executeGraph>['trace']
  readonly parity: 'EXCEL_PARITY_UNVERIFIED'
}

const VERSION = 'JV-LINE-SASH-PROFILES-2026-10-08'
function r(id: string, cell: string, formula: string, deps: readonly string[], execute: CalculationRule['execute'], workbook: string): CalculationRule {
  return { id: `JV.LINE.SASH.${id}`, version: VERSION, dependsOn: deps, source: { workbook, sheet: 'L1', cell, formula }, execute }
}
function n(inputs: Readonly<Record<string, unknown>>, key: string): DecimalString {
  try { return decimalString(String(inputs[key])) } catch { throw new EngineError('INVALID_DECIMAL', `Missing or invalid sash geometry input ${key}`, { key, value: inputs[key], source: `L1!${key}` }) }
}
function yes(value: unknown): boolean { return value === 'ДА' }
function maxZero(value: DecimalString): DecimalString { return compareDecimal(value, decimalString('0')) < 0 ? decimalString('0') : value }

/** Rebuilds Excel L1 I42:I49 -> C/D36:C41 -> F33:F39 -> O6/O7 without a resolved F39 input. */
export function calculateLineSashProfileLengths(input: LineSashProfileInput): LineSashProfileResult {
  const values = {
    D3: decimalString(input.openingWidth), D4: decimalString(input.constructionHeight), D5: decimalString(input.leaves), D6: decimalString(input.sides), D15: input.frameState,
    C21: input.specialSash, ...(input.specialSashWidth === undefined ? {} : { D21: decimalString(input.specialSashWidth) }), C23: input.parkedDoorSelected, C24: decimalString(input.parkedDoorPosition), C25: input.parkedDoorReuseOpening, ...(input.parkedDoorWidth === undefined ? {} : { D25: decimalString(input.parkedDoorWidth) }),
    SETTINGS_P3: decimalString(input.settings.P3), SETTINGS_P4: decimalString(input.settings.P4), SETTINGS_P12: decimalString(input.settings.P12), SETTINGS_P13: decimalString(input.settings.P13), SETTINGS_P14: decimalString(input.settings.P14), SETTINGS_P15: decimalString(input.settings.P15), SETTINGS_P16: decimalString(input.settings.P16), SETTINGS_P17: decimalString(input.settings.P17), SETTINGS_L23: decimalString(input.settings.L23), SETTINGS_D6: decimalString(input.settings.D6),
  }
  const rules: CalculationRule[] = [
    r('I42', 'I42', '=2*IF($D$15="ДА",Настройки!$P$4,0)', ['D15','SETTINGS_P4'], ({ inputs: x }) => yes(x.D15) ? multiplyDecimal(decimalString('2'), n(x,'SETTINGS_P4')) : decimalString('0'), input.workbook),
    r('I43', 'I43', '=2*(Настройки!$P$15+Настройки!$P$16+Настройки!$P$17)', ['SETTINGS_P15','SETTINGS_P16','SETTINGS_P17'], ({ inputs: x }) => multiplyDecimal(decimalString('2'), addDecimal(addDecimal(n(x,'SETTINGS_P15'),n(x,'SETTINGS_P16')),n(x,'SETTINGS_P17'))), input.workbook),
    r('I44', 'I44', '=($D$5-1)*(Настройки!$P$14+2*Настройки!$P$16+2*Настройки!$P$17)', ['D5','SETTINGS_P14','SETTINGS_P16','SETTINGS_P17'], ({ inputs: x }) => multiplyDecimal(subtractDecimal(n(x,'D5'),decimalString('1')), addDecimal(n(x,'SETTINGS_P14'), addDecimal(multiplyDecimal(decimalString('2'),n(x,'SETTINGS_P16')),multiplyDecimal(decimalString('2'),n(x,'SETTINGS_P17'))))), input.workbook),
    r('I45', 'I45', '=SUM($I$42:$I$44)', ['JV.LINE.SASH.I42','JV.LINE.SASH.I43','JV.LINE.SASH.I44'], ({ results: x }) => addDecimal(addDecimal(n(x,'JV.LINE.SASH.I42'),n(x,'JV.LINE.SASH.I43')),n(x,'JV.LINE.SASH.I44')), input.workbook),
    r('I46', 'I46', '=$D$3-$I$45', ['D3','JV.LINE.SASH.I45'], ({ inputs: x, results: y }) => subtractDecimal(n(x,'D3'),n(y,'JV.LINE.SASH.I45')), input.workbook),
    r('I47', 'I47', '=IF($C$21,$D$21-2*(Настройки!$P$16+Настройки!$P$17),0)', input.specialSash ? ['C21','D21','SETTINGS_P16','SETTINGS_P17'] : ['C21'], ({ inputs: x }) => x.C21 === true ? subtractDecimal(n(x,'D21'),multiplyDecimal(decimalString('2'),addDecimal(n(x,'SETTINGS_P16'),n(x,'SETTINGS_P17')))) : decimalString('0'), input.workbook),
    r('I48', 'I48', '=IF(AND($C$23,$C$25),$D$25-2*(Настройки!$P$16+Настройки!$P$17),0)', input.parkedDoorSelected && input.parkedDoorReuseOpening ? ['C23','C25','D25','SETTINGS_P16','SETTINGS_P17'] : ['C23','C25'], ({ inputs: x }) => x.C23 === true && x.C25 === true ? subtractDecimal(n(x,'D25'),multiplyDecimal(decimalString('2'),addDecimal(n(x,'SETTINGS_P16'),n(x,'SETTINGS_P17')))) : decimalString('0'), input.workbook),
    r('I49', 'I49', '=ROUNDDOWN(($I$46-$D$6*I47-$I$48)/($D$5-IF($I$47>0,$D$6,0)-IF($I$48>0,1,0)),0)', ['JV.LINE.SASH.I46','D5','D6','JV.LINE.SASH.I47','JV.LINE.SASH.I48'], ({ inputs: x, results: y }) => {
      let numerator = subtractDecimal(n(y,'JV.LINE.SASH.I46'),multiplyDecimal(n(x,'D6'),n(y,'JV.LINE.SASH.I47')))
      numerator = subtractDecimal(numerator,n(y,'JV.LINE.SASH.I48'))
      let denominator = n(x,'D5')
      if (compareDecimal(n(y,'JV.LINE.SASH.I47'),decimalString('0')) > 0) denominator = subtractDecimal(denominator,n(x,'D6'))
      if (compareDecimal(n(y,'JV.LINE.SASH.I48'),decimalString('0')) > 0) denominator = subtractDecimal(denominator,decimalString('1'))
      if (compareDecimal(denominator,decimalString('0')) === 0) throw new EngineError('DIVISION_BY_ZERO','Excel L1!I49 denominator is zero',{source:'L1!I49'})
      return divideDecimalTruncateToInteger(numerator,denominator)
    }, input.workbook),
    r('C46', 'C46', '=$D$6', ['D6'], ({ inputs: x }) => n(x,'D6'), input.workbook),
    r('C36', 'C36', '=C46', ['JV.LINE.SASH.C46'], ({ results: x }) => n(x,'JV.LINE.SASH.C46'),input.workbook),
    r('C37', 'C37', '=C47', ['JV.LINE.SASH.C47'], ({ results: x }) => n(x,'JV.LINE.SASH.C47'),input.workbook),
    r('C38', 'C38', '=C48', ['JV.LINE.SASH.C48'], ({ results: x }) => n(x,'JV.LINE.SASH.C48'),input.workbook),
    r('D46', 'D46', '=IF($C$46>0,IF($C$21,$I$47,$I$49)-Настройки!$L$23,0)', ['JV.LINE.SASH.C46','C21','JV.LINE.SASH.I47','JV.LINE.SASH.I49','SETTINGS_L23'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C46'),decimalString('0')) > 0 ? subtractDecimal(x.C21 === true ? n(y,'JV.LINE.SASH.I47') : n(y,'JV.LINE.SASH.I49'),n(x,'SETTINGS_L23')) : decimalString('0'), input.workbook),
    r('C47', 'C47', '=IF(AND($D$6=1,$D$5>1),1,0)+IF(AND($D$6=2,$D$5>=4),2,0)+IF(AND($D$6=2,$D$5=3),1,0)', ['D5','D6'], ({ inputs: x }) => {
      const d5=n(x,'D5'), d6=n(x,'D6'); let q=decimalString('0')
      if(compareDecimal(d6,decimalString('1'))===0&&compareDecimal(d5,decimalString('1'))>0) q=addDecimal(q,decimalString('1'))
      if(compareDecimal(d6,decimalString('2'))===0&&compareDecimal(d5,decimalString('4'))>=0) q=addDecimal(q,decimalString('2'))
      if(compareDecimal(d6,decimalString('2'))===0&&compareDecimal(d5,decimalString('3'))===0) q=addDecimal(q,decimalString('1'))
      return q
    }, input.workbook),
    r('D47', 'D47', '=IF(C47>0,I49-Настройки!$L$23,0)', ['JV.LINE.SASH.C47','JV.LINE.SASH.I49','SETTINGS_L23'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C47'),decimalString('0'))>0?subtractDecimal(n(y,'JV.LINE.SASH.I49'),n(x,'SETTINGS_L23')):decimalString('0'),input.workbook),
    r('C49', 'C49', '=IF($C$23,1,0)', ['C23'], ({ inputs: x }) => x.C23===true?decimalString('1'):decimalString('0'),input.workbook),
    r('C39', 'C39', '=C49', ['JV.LINE.SASH.C49'], ({ results: x }) => n(x,'JV.LINE.SASH.C49'),input.workbook),
    r('D49', 'D49', '=IF(C49>0,C49*IF(AND(C23,C25),I48,I49)-Настройки!$L$23,0)', ['JV.LINE.SASH.C49','C23','C25','JV.LINE.SASH.I48','JV.LINE.SASH.I49','SETTINGS_L23'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C49'),decimalString('0'))>0?subtractDecimal(multiplyDecimal(n(y,'JV.LINE.SASH.C49'),x.C23===true&&x.C25===true?n(y,'JV.LINE.SASH.I48'):n(y,'JV.LINE.SASH.I49')),n(x,'SETTINGS_L23')):decimalString('0'),input.workbook),
    r('C50', 'C50', '=C49', ['JV.LINE.SASH.C49'], ({ results: x }) => n(x,'JV.LINE.SASH.C49'),input.workbook),
    r('C40', 'C40', '=C39', ['JV.LINE.SASH.C39'], ({ results: x }) => n(x,'JV.LINE.SASH.C39'),input.workbook),
    r('D50', 'D50', '=IF(C50>0,I49-Настройки!$L$23,0)', ['JV.LINE.SASH.C50','JV.LINE.SASH.I49','SETTINGS_L23'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C50'),decimalString('0'))>0?subtractDecimal(n(y,'JV.LINE.SASH.I49'),n(x,'SETTINGS_L23')):decimalString('0'),input.workbook),
    r('C51', 'C51', '=IF(AND($D$6=1,$C$24<$D$5),1,0)', ['D6','C24','D5'], ({ inputs: x }) => compareDecimal(n(x,'D6'),decimalString('1'))===0&&compareDecimal(n(x,'C24'),n(x,'D5'))<0?decimalString('1'):decimalString('0'),input.workbook),
    r('C41', 'C41', '=C51', ['JV.LINE.SASH.C51'], ({ results: x }) => n(x,'JV.LINE.SASH.C51'),input.workbook),
    r('D51', 'D51', '=IF(C51>0,C51*(I49-Настройки!$L$23),0)', ['JV.LINE.SASH.C51','JV.LINE.SASH.I49','SETTINGS_L23'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C51'),decimalString('0'))>0?multiplyDecimal(n(y,'JV.LINE.SASH.C51'),subtractDecimal(n(y,'JV.LINE.SASH.I49'),n(x,'SETTINGS_L23'))):decimalString('0'),input.workbook),
    r('C48', 'C48', '=IF(($D$5-$C$46-$C$47-$C$49-$C$51-$C$50)>0,$D$5-$C$46-$C$47-$C$49-$C$51-$C$50,0)', ['D5','JV.LINE.SASH.C46','JV.LINE.SASH.C47','JV.LINE.SASH.C49','JV.LINE.SASH.C51','JV.LINE.SASH.C50'], ({ inputs: x, results: y }) => maxZero(subtractDecimal(subtractDecimal(subtractDecimal(subtractDecimal(subtractDecimal(n(x,'D5'),n(y,'JV.LINE.SASH.C46')),n(y,'JV.LINE.SASH.C47')),n(y,'JV.LINE.SASH.C49')),n(y,'JV.LINE.SASH.C51')),n(y,'JV.LINE.SASH.C50'))),input.workbook),
    r('D48', 'D48', '=IF(C48>0,I49-Настройки!$L$23,0)', ['JV.LINE.SASH.C48','JV.LINE.SASH.I49','SETTINGS_L23'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C48'),decimalString('0'))>0?subtractDecimal(n(y,'JV.LINE.SASH.I49'),n(x,'SETTINGS_L23')):decimalString('0'),input.workbook),
    r('D36', 'D36', '=IF(C46>0,D46+2*(Настройки!$P$17+Настройки!$P$16)-Настройки!$P$12-Настройки!$P$13,0)', ['JV.LINE.SASH.C46','JV.LINE.SASH.D46','SETTINGS_P17','SETTINGS_P16','SETTINGS_P12','SETTINGS_P13'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C46'),decimalString('0'))>0?subtractDecimal(addDecimal(n(y,'JV.LINE.SASH.D46'),multiplyDecimal(decimalString('2'),addDecimal(n(x,'SETTINGS_P17'),n(x,'SETTINGS_P16')))),addDecimal(n(x,'SETTINGS_P12'),n(x,'SETTINGS_P13'))):decimalString('0'),input.workbook),
    r('D37', 'D37', '=IF(C47>0,D47+2*(Настройки!$P$17+Настройки!$P$16)-2*Настройки!$P$13,0)', ['JV.LINE.SASH.C47','JV.LINE.SASH.D47','SETTINGS_P17','SETTINGS_P16','SETTINGS_P13'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C47'),decimalString('0'))>0?subtractDecimal(addDecimal(n(y,'JV.LINE.SASH.D47'),multiplyDecimal(decimalString('2'),addDecimal(n(x,'SETTINGS_P17'),n(x,'SETTINGS_P16')))),multiplyDecimal(decimalString('2'),n(x,'SETTINGS_P13'))):decimalString('0'),input.workbook),
    r('D38', 'D38', '=IF(C48>0,D48+2*(Настройки!$P$17+Настройки!$P$16)-2*Настройки!$P$13,0)', ['JV.LINE.SASH.C48','JV.LINE.SASH.D48','SETTINGS_P17','SETTINGS_P16','SETTINGS_P13'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C48'),decimalString('0'))>0?subtractDecimal(addDecimal(n(y,'JV.LINE.SASH.D48'),multiplyDecimal(decimalString('2'),addDecimal(n(x,'SETTINGS_P17'),n(x,'SETTINGS_P16')))),multiplyDecimal(decimalString('2'),n(x,'SETTINGS_P13'))):decimalString('0'),input.workbook),
    r('D39', 'D39', '=IF(C49>0,D49+2*(Настройки!$P$17+Настройки!$P$16)-IF($C$24=$D$5,Настройки!$P$12+Настройки!$P$13,2*Настройки!$P$13),0)', ['JV.LINE.SASH.C49','JV.LINE.SASH.D49','C24','D5','SETTINGS_P17','SETTINGS_P16','SETTINGS_P12','SETTINGS_P13'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C49'),decimalString('0'))>0?subtractDecimal(addDecimal(n(y,'JV.LINE.SASH.D49'),multiplyDecimal(decimalString('2'),addDecimal(n(x,'SETTINGS_P17'),n(x,'SETTINGS_P16')))),compareDecimal(n(x,'C24'),n(x,'D5'))===0?addDecimal(n(x,'SETTINGS_P12'),n(x,'SETTINGS_P13')):multiplyDecimal(decimalString('2'),n(x,'SETTINGS_P13'))):decimalString('0'),input.workbook),
    r('D40', 'D40', '=IF(C50>0,D50+2*(Настройки!$P$17+Настройки!$P$16)-2*Настройки!$P$13,0)', ['JV.LINE.SASH.C50','JV.LINE.SASH.D50','SETTINGS_P17','SETTINGS_P16','SETTINGS_P13'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C50'),decimalString('0'))>0?subtractDecimal(addDecimal(n(y,'JV.LINE.SASH.D50'),multiplyDecimal(decimalString('2'),addDecimal(n(x,'SETTINGS_P17'),n(x,'SETTINGS_P16')))),multiplyDecimal(decimalString('2'),n(x,'SETTINGS_P13'))):decimalString('0'),input.workbook),
    r('D41', 'D41', '=IF(C51>0,D51+2*(Настройки!$P$17+Настройки!$P$16)-Настройки!$P$12-Настройки!$P$13,0)', ['JV.LINE.SASH.C51','JV.LINE.SASH.D51','SETTINGS_P17','SETTINGS_P16','SETTINGS_P12','SETTINGS_P13'], ({ inputs: x, results: y }) => compareDecimal(n(y,'JV.LINE.SASH.C51'),decimalString('0'))>0?subtractDecimal(addDecimal(n(y,'JV.LINE.SASH.D51'),multiplyDecimal(decimalString('2'),addDecimal(n(x,'SETTINGS_P17'),n(x,'SETTINGS_P16')))),addDecimal(n(x,'SETTINGS_P12'),n(x,'SETTINGS_P13'))):decimalString('0'),input.workbook),
    ...(['36','37','38','39','40','41'] as const).map((row) => r(`F${Number(row)-3}`, `F${Number(row)-3}`, `=C${row}*D${row}`, [`JV.LINE.SASH.C${row}`,`JV.LINE.SASH.D${row}`], ({ results: x }) => multiplyDecimal(n(x,`JV.LINE.SASH.C${row}`),n(x,`JV.LINE.SASH.D${row}`)), input.workbook)),
    r('F39', 'F39', '=SUM(F33:F38)', ['JV.LINE.SASH.F33','JV.LINE.SASH.F34','JV.LINE.SASH.F35','JV.LINE.SASH.F36','JV.LINE.SASH.F37','JV.LINE.SASH.F38'], ({ results: x }) => ['F33','F34','F35','F36','F37','F38'].reduce<DecimalString>((sum, cell) => addDecimal(sum,n(x,`JV.LINE.SASH.${cell}`)),decimalString('0')),input.workbook),
    r('O6', 'O6', '=$F$39/1000+Настройки!$D$6/1000', ['JV.LINE.SASH.F39','SETTINGS_D6'], ({ inputs: x, results: y }) => addDecimal(divideDecimalExact(n(y,'JV.LINE.SASH.F39'),decimalString('1000')),divideDecimalExact(n(x,'SETTINGS_D6'),decimalString('1000'))),input.workbook),
    r('O7', 'O7', '=$F$39/1000+Настройки!$D$6/1000', ['JV.LINE.SASH.F39','SETTINGS_D6'], ({ inputs: x, results: y }) => addDecimal(divideDecimalExact(n(y,'JV.LINE.SASH.F39'),decimalString('1000')),divideDecimalExact(n(x,'SETTINGS_D6'),decimalString('1000'))),input.workbook),
  ]
  const graph = executeGraph(values, rules)
  const result = (id: string) => graph.values[`JV.LINE.SASH.${id}`]
  const intermediates = Object.fromEntries(Object.keys(graph.values).filter((key) => key.startsWith('JV.LINE.SASH.')).map((key) => [key.slice('JV.LINE.SASH.'.length), decimalString(String(graph.values[key]))]))
  return Object.freeze({ profileLengthTotal: decimalString(String(result('F39'))), upperProfileQuantity: decimalString(String(result('O6'))), lowerProfileQuantity: decimalString(String(result('O7'))), intermediates: Object.freeze(intermediates), trace: graph.trace, parity: 'EXCEL_PARITY_UNVERIFIED' })
}
