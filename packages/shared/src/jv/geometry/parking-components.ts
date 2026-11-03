import { addDecimal, compareDecimal, decimalString, subtractDecimal } from '../decimal.ts'
import { EngineError } from '../errors.ts'
import { executeGraph } from '../graph.ts'
import { PD_LONGITUDINAL_TABLE_METADATA, PD_LONGITUDINAL_TABLES, PD_LONGITUDINAL_VERSION } from './pd-catalog-longitudinal.ts'
import type { DecimalString } from '../types.ts'

export interface LineParkingComponentsInput {
  readonly workbook: string
  readonly leaves: DecimalString
  readonly sides: DecimalString
  readonly direction: string
  readonly doorState: 'ДА' | 'НЕТ' | 'ОШИБКА'
  readonly doorPosition: DecimalString
  readonly parkingPartCount: DecimalString // L1!O15 from calculateLineParkingDepth
  readonly knobState: string // L1!D16
  readonly latchState: string // L1!D17
  readonly bottomPivotState: string // L1!D20
}
export interface LineParkingComponentsResult {
  readonly D24: 'OK' | 'ОШИБКА' | '- - -'
  readonly O12: DecimalString
  readonly O13: DecimalString
  readonly O14: DecimalString
  readonly O15: DecimalString
  readonly O16: DecimalString
  readonly O17: DecimalString
  readonly O18: DecimalString
  readonly O19: DecimalString
  readonly O20: DecimalString
  readonly O26: DecimalString
  readonly O27: DecimalString
  readonly longitudinalLookup?: Readonly<{tableId:string;version:string;rowIndex:number;columnIndex:number;sourceCell:string;value:DecimalString}>
  readonly trace: ReturnType<typeof executeGraph>['trace']
}

function index(value: DecimalString, axis: 'row'|'column', sourceCell: string): number {
  if (compareDecimal(value, decimalString('1')) < 0 || compareDecimal(value, decimalString('50')) > 0 || !/^\d+$/.test(value)) throw new EngineError('LOOKUP_NOT_FOUND', `L1 ${axis} index is outside the extracted PD range`, {value,axis,sourceCell,excelError:'#REF!'})
  return Number(value)
}
function columnName(n:number):string { let s=''; while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s }

/** Rebuilds Excel D24 and O12:O20/O26:O27 from source formulas and both PD table pairs. */
export function calculateLineParkingComponents(input: LineParkingComponentsInput): LineParkingComponentsResult {
  const d5=decimalString(input.leaves),d6=decimalString(input.sides),c24=decimalString(input.doorPosition),o15=decimalString(input.parkingPartCount)
  const invalidTwoSidedSmall=compareDecimal(d5,decimalString('2'))<=0&&compareDecimal(d6,decimalString('2'))===0
  const d24=input.doorState!=='ДА'?'- - -':invalidTwoSidedSmall?'ОШИБКА':compareDecimal(c24,decimalString('2'))>=0&&compareDecimal(c24,subtractDecimal(d5,subtractDecimal(d6,decimalString('1'))))<=0?'OK':'ОШИБКА'
  let longitudinalLookup:LineParkingComponentsResult['longitudinalLookup']
  let o16=decimalString('0')
  if(input.doorState==='НЕТ') o16=subtractDecimal(subtractDecimal(d5,decimalString('1')),d6)
  else if(input.doorState==='ДА'&&(compareDecimal(d6,decimalString('1'))===0||compareDecimal(d6,decimalString('2'))===0)) {
    const row=index(d5,'row','L1!O16'),col=index(c24,'column','L1!O16'),one=compareDecimal(d6,decimalString('1'))===0
    const meta=one?PD_LONGITUDINAL_TABLE_METADATA.oneSided:PD_LONGITUDINAL_TABLE_METADATA.twoSided
    const table=one?PD_LONGITUDINAL_TABLES.oneSidedLongitudinal:PD_LONGITUDINAL_TABLES.twoSidedLongitudinal
    const raw=table[row-1]?.[col-1]
    if(raw===undefined)throw new EngineError('LOOKUP_NOT_FOUND','PD longitudinal lookup cell is missing',{row,col,source:'L1!O16'})
    const value=decimalString(String(raw)),sourceCell=`${columnName(meta.columnStart+col-1)}${meta.rowStart+row-1}`
    longitudinalLookup=Object.freeze({tableId:meta.id,version:PD_LONGITUDINAL_VERSION,rowIndex:row,columnIndex:col,sourceCell,value});o16=value
  }
  const o11=subtractDecimal(d5,d6)
  const o13=input.doorState==='ДА'?decimalString('1'):input.doorState==='ОШИБКА'||d24==='ОШИБКА'?(()=>{throw new EngineError('RULE_FAILED','Excel L1!O13 returns the text error ОШИБКА for this parking configuration',{source:'L1!O13',D23:input.doorState,D24:d24})})():decimalString('0')
  let o14=decimalString('0')
  if(d24==='OK'||d24==='- - -') {
    if(input.doorState==='ДА'&&compareDecimal(d6,decimalString('1'))===0)o14=subtractDecimal(d5,c24)
    if(input.doorState==='ДА'&&compareDecimal(d6,decimalString('2'))===0)o14=subtractDecimal(subtractDecimal(d5,c24),decimalString('1'))
  } else throw new EngineError('RULE_FAILED','Excel L1!O14 returns the text error ОШИБКА for this door-position configuration',{source:'L1!O14',D24:d24})
  const o12=subtractDecimal(subtractDecimal(o11,o13),o14)
  const o17=addDecimal(addDecimal(o15,o16),input.latchState==='ДА'?d6:decimalString('0'))
  const o18=input.knobState==='ДА'?d6:decimalString('0')
  const o19=input.bottomPivotState==='ДА'?decimalString('0'):d6
  const result=executeGraph({D5:d5,D6:d6,D7:input.direction,D20:input.bottomPivotState,D23:input.doorState,D24:d24,C24:c24,D16:input.knobState,D17:input.latchState,O15:o15,O11:o11,O12:o12,O13:o13,O14:o14,O16:o16,O17:o17,O18:o18,O19:o19},[
    {id:'JV.LINE.PARKING.D24',version:PD_LONGITUDINAL_VERSION,dependsOn:['D23','D5','D6','C24'],source:{workbook:input.workbook,sheet:'L1',cell:'D24',formula:'=IF(D23="ДА",IF(AND(C24>=H21,C24<=I21),"OK","ОШИБКА"),"- - -")'},execute:()=>d24},
    {id:'JV.LINE.PARKING.O12',version:PD_LONGITUDINAL_VERSION,dependsOn:['O11','O13','O14'],source:{workbook:input.workbook,sheet:'L1',cell:'O12',formula:'=$O$11-$O$13-$O$14'},execute:()=>o12},
    {id:'JV.LINE.PARKING.O13',version:PD_LONGITUDINAL_VERSION,dependsOn:['D23','D24'],source:{workbook:input.workbook,sheet:'L1',cell:'O13',formula:'=IF(D23="ДА",1,IF(OR(D23="ОШИБКА",D24="ОШИБКА"),"ОШИБКА",0))'},execute:()=>o13},
    {id:'JV.LINE.PARKING.O14',version:PD_LONGITUDINAL_VERSION,dependsOn:['D23','D24','D5','D6','C24'],source:{workbook:input.workbook,sheet:'L1',cell:'O14',formula:'=IF(OR(D24="OK",D24="- - -"),IF(AND(D23="ДА",D6=1),D5-C24,0)+IF(AND(D23="ДА",D6=2),D5-C24-1,0),"ОШИБКА")'},execute:()=>o14},
    {id:'JV.LINE.PARKING.O16',version:PD_LONGITUDINAL_VERSION,dependsOn:['D23','D5','D6','C24'],source:{workbook:input.workbook,sheet:'L1',cell:'O16',formula:'=IF(D23="НЕТ",D5-1-D6,0)+IF(AND(D23="ДА",D6=1),INDEX(ПД!D117:BA166,D5,C24),0)+IF(AND(D23="ДА",D6=2),INDEX(ПД!D173:BA222,D5,C24),0)'},execute:()=>o16},
    {id:'JV.LINE.PARKING.O17',version:PD_LONGITUDINAL_VERSION,dependsOn:['O15','O16','D17','D6'],source:{workbook:input.workbook,sheet:'L1',cell:'O17',formula:'=$O$15+$O$16+IF($D$17="ДА",$D$6,0)'},execute:()=>o17},
    {id:'JV.LINE.PARKING.O18',version:PD_LONGITUDINAL_VERSION,dependsOn:['D16','D6'],source:{workbook:input.workbook,sheet:'L1',cell:'O18',formula:'=IF($D$16="ДА",$D$6,0)'},execute:()=>o18},
    {id:'JV.LINE.PARKING.O19',version:PD_LONGITUDINAL_VERSION,dependsOn:['D20','D6'],source:{workbook:input.workbook,sheet:'L1',cell:'O19',formula:'=IF($D$20="ДА",0,$D$6)'},execute:()=>o19},
    {id:'JV.LINE.PARKING.O20',version:PD_LONGITUDINAL_VERSION,dependsOn:['O19'],source:{workbook:input.workbook,sheet:'L1',cell:'O20',formula:'=O19'},execute:()=>o19},
    {id:'JV.LINE.PARKING.O26',version:PD_LONGITUDINAL_VERSION,dependsOn:['O13'],source:{workbook:input.workbook,sheet:'L1',cell:'O26',formula:'=$O$13'},execute:()=>o13},
    {id:'JV.LINE.PARKING.O27',version:PD_LONGITUDINAL_VERSION,dependsOn:['O13'],source:{workbook:input.workbook,sheet:'L1',cell:'O27',formula:'=$O$13'},execute:()=>o13},
  ])
  return Object.freeze({D24:d24,O12:o12,O13:o13,O14:o14,O15:o15,O16:o16,O17:o17,O18:o18,O19:o19,O20:o19,O26:o13,O27:o13,...(longitudinalLookup?{longitudinalLookup}:{}),trace:result.trace})
}
