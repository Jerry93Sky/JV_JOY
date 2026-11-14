import type { DecimalString, Unit } from '../types.ts'
import { decimalString, multiplyDecimal, subtractDecimal } from '../decimal.ts'
import { executeGraph } from '../graph.ts'
import { EngineError } from '../errors.ts'
export interface LineParkingWidthInput { readonly openingLeafWidth: { readonly value: DecimalString; readonly unit: Unit }; readonly rollerAxisToEdge: { readonly value: DecimalString; readonly unit: Unit } }
export interface GeometryMeasure { readonly value: DecimalString; readonly unit: Unit }
export interface LineParkingWidthResult { readonly ruleId: 'JV.LINE.PARKING_AXIS_WIDTH'; readonly value: GeometryMeasure; readonly trace: ReturnType<typeof executeGraph>['trace']; readonly parity: 'EXCEL_PARITY_UNVERIFIED' }
/** Implements only Excel L1!I27: =I25-2*D22 (label H27: parking width by axes). */
export function calculateLineParkingAxisWidth(input: LineParkingWidthInput): LineParkingWidthResult {
  if (input.openingLeafWidth.unit !== input.rollerAxisToEdge.unit) throw new EngineError('UNIT_MISMATCH','L1!I27 requires I25 and D22 in the same unit',{leftUnit:input.openingLeafWidth.unit,rightUnit:input.rollerAxisToEdge.unit,source:'L1!I27'})
  const graph=executeGraph({I25:decimalString(input.openingLeafWidth.value),D22:decimalString(input.rollerAxisToEdge.value)},[{id:'JV.LINE.PARKING_AXIS_WIDTH',version:'JV-XLSM-2026-10-08',dependsOn:['I25','D22'],source:{workbook:'JV-комплектация 08.10.2026.xlsm',sheet:'L1',cell:'I27',formula:'=$I$25-2*$D$22'},execute:({inputs})=>subtractDecimal(inputs.I25 as DecimalString,multiplyDecimal(decimalString('2'),inputs.D22 as DecimalString))}])
  const value=graph.values['JV.LINE.PARKING_AXIS_WIDTH']
  if(typeof value!=='string') throw new EngineError('RULE_FAILED','L1!I27 did not return decimal text',{source:'L1!I27'})
  return Object.freeze({ruleId:'JV.LINE.PARKING_AXIS_WIDTH',value:Object.freeze({value:decimalString(value),unit:input.openingLeafWidth.unit}),trace:graph.trace,parity:'EXCEL_PARITY_UNVERIFIED'})
}

import { addDecimal, compareDecimal, divideDecimalExact, divideDecimalTruncateToInteger } from '../decimal.ts'
import { PD_CATALOG_TABLES, PD_CATALOG_TABLE_METADATA, PD_CATALOG_VERSION } from './pd-catalog.ts'
import type { EngineErrorCode } from '../errors.ts'
export interface LineParkingDepthInput {
 readonly leaves: DecimalString
 readonly sideCount: DecimalString | 'НЕТ'
 readonly parkedDoorSelected: boolean
 readonly parkedDoorPosition?: DecimalString
 readonly unit: Unit
 readonly settings: { readonly edgeToSwingAxis: DecimalString; readonly sashProfileWidth: DecimalString; readonly sideLockHandleProjection: DecimalString; readonly parkingDepthReserve: DecimalString; readonly rollerAxisToEdge: DecimalString }
}
export interface LineParkingDepthResult { readonly status:'ok'; readonly doorState:'ДА'|'НЕТ'|'ОШИБКА'; readonly parkingPartCount:DecimalString; readonly parkingLookup?: {readonly tableId:string;readonly version:string;readonly rowIndex:number;readonly columnIndex:number;readonly sourceCell:string;readonly value:DecimalString}; readonly depth:GeometryMeasure; readonly trace:ReturnType<typeof executeGraph>['trace']; readonly parity:'EXCEL_PARITY_UNVERIFIED' }
const PD_FORMULA='=IF($D$23="НЕТ",$D$6+2,0) + IF(AND($D$23="ДА",$D$6=1),INDEX(ПД!$D$5:$BA$54,$D$5,$C$24),0) + IF(AND($D$23="ДА",$D$6=2),INDEX(ПД!$D$61:$BA$110,$D$5,$C$24),0)'
const D23_FORMULA='=IF($C$23,IF($D$5/$D$6>1,"ДА","ОШИБКА"),"НЕТ")'
function excelError(code:EngineErrorCode,message:string,details:Record<string,unknown>):never{throw new EngineError(code,message,details)}
function numericInput(value:unknown,cell:string):DecimalString{try{return decimalString(value as string)}catch{return excelError('INVALID_DECIMAL',`Excel numeric operation received a nonnumeric value in ${cell}`,{value,source:cell,excelError:'#VALUE!'})}}
function tableIndex(value:DecimalString,axis:'row'|'column'):number{
 let integer:DecimalString
 try{integer=divideDecimalTruncateToInteger(value,decimalString('1'))}catch{ return excelError('LOOKUP_NOT_FOUND',`ПД ${axis} index is invalid`,{value,axis,source:'L1!O15'}) }
 if(compareDecimal(value,integer)!==0)return excelError('RULE_UNCONFIRMED',`Excel INDEX fractional ${axis} coercion is not verified`,{value,axis,source:'L1!O15'})
 const n=Number(integer)
 if(n===0)return excelError('RULE_UNCONFIRMED',`Excel INDEX ${axis}=0 returns an array; scalar-intersection behavior in O15 is not verified`,{value,axis,source:'L1!O15'})
 if(!Number.isSafeInteger(n)||n<1||n>50)return excelError('LOOKUP_NOT_FOUND',`Excel INDEX ${axis} index is out of range (#REF!)`,{value,axis,min:1,max:50,source:'L1!O15',excelError:'#REF!'})
 return n
}
function pdValue(sideCount:DecimalString,leaves:DecimalString,position:DecimalString):{value:DecimalString;lookup:NonNullable<LineParkingDepthResult['parkingLookup']>}{
 const rowIndex=tableIndex(leaves,'row'),columnIndex=tableIndex(position,'column')
 const oneSided=compareDecimal(sideCount,decimalString('1'))===0
 const twoSided=compareDecimal(sideCount,decimalString('2'))===0
 if(!oneSided&&!twoSided)return excelError('LOOKUP_NOT_FOUND','Excel O15 requests a PD lookup only when D6 is 1 or 2',{sideCount,source:'L1!O15'})
 const meta=oneSided?PD_CATALOG_TABLE_METADATA.oneSided:PD_CATALOG_TABLE_METADATA.twoSided
 const table=oneSided?PD_CATALOG_TABLES.oneSided:PD_CATALOG_TABLES.twoSided
 const sourceRow=meta.rowStart+rowIndex-1,sourceColumn=meta.columnStart+columnIndex-1
 const sourceCell=`${excelColumn(sourceColumn)}${sourceRow}`
 const raw=table[rowIndex-1]?.[columnIndex-1]
 if(typeof raw!=='number'||!Number.isFinite(raw))return excelError('LOOKUP_NOT_FOUND','ПД cell is blank or is not a finite numeric constant',{sourceCell,source:'ПД'})
 return {value:decimalString(String(raw)),lookup:Object.freeze({tableId:meta.id,version:PD_CATALOG_VERSION,rowIndex,columnIndex,sourceCell,value:decimalString(String(raw))})}
}
function excelColumn(n:number):string{let s='';while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s}
/** Exact L1 D23 -> O15 -> I26 chain, including both workbook-extracted PD matrices. */
export function calculateLineParkingDepth(input:LineParkingDepthInput):LineParkingDepthResult {
 const lengths=[input.settings.edgeToSwingAxis,input.settings.sashProfileWidth,input.settings.sideLockHandleProjection,input.settings.parkingDepthReserve,input.settings.rollerAxisToEdge].map(decimalString)
 const position=input.parkedDoorPosition===undefined?undefined:decimalString(input.parkedDoorPosition)
 const graph=executeGraph({C23:input.parkedDoorSelected,D5:decimalString(input.leaves),D6:input.sideCount==='НЕТ'?'НЕТ':decimalString(input.sideCount),C24:position,P8:lengths[0],P5:lengths[1],P9:lengths[2],P10:lengths[3],D22:lengths[4],unit:input.unit},[
 {id:'JV.LINE.PARKED_DOOR_STATE',version:'JV-XLSM-2026-10-08',dependsOn:['C23','D5','D6'],source:{workbook:'JV-комплектация 08.10.2026.xlsm',sheet:'L1',cell:'D23',formula:D23_FORMULA},execute:({inputs})=>{if(inputs.C23===false)return 'НЕТ';if(inputs.C23!==true) return excelError('INVALID_CONFIGURATION','C23 must be a boolean',{value:inputs.C23,source:'L1!D23'});const d5=decimalString(inputs.D5 as string),d6=numericInput(inputs.D6,'L1!D23');if(compareDecimal(d6,decimalString('0'))===0)return excelError('DIVISION_BY_ZERO','Excel D5/D6 divides by zero',{D5:d5,D6:d6,source:'L1!D23',excelError:'#DIV/0!'});const quotientGreaterThanOne=compareDecimal(d6,decimalString('0'))>0?compareDecimal(d5,d6)>0:compareDecimal(d5,d6)<0;return quotientGreaterThanOne?'ДА':'ОШИБКА'}},
 {id:'JV.LINE.PARKING_PART_COUNT',version:'JV-XLSM-2026-10-08',dependsOn:['JV.LINE.PARKED_DOOR_STATE','D6','D5','C24'],source:{workbook:'JV-комплектация 08.10.2026.xlsm',sheet:'L1',cell:'O15',formula:PD_FORMULA},execute:({inputs,results})=>{const state=results['JV.LINE.PARKED_DOOR_STATE'];if(state==='НЕТ')return Object.freeze({value:addDecimal(numericInput(inputs.D6,'L1!O15'),decimalString('2'))});if(state==='ДА'){const sides=numericInput(inputs.D6,'L1!O15');if(compareDecimal(sides,decimalString('1'))===0||compareDecimal(sides,decimalString('2'))===0){if(inputs.C24===undefined)return excelError('MISSING_INPUT','C24 is required for the parked-door PD lookup',{source:'L1!O15'});const selected=pdValue(sides,decimalString(inputs.D5 as string),decimalString(inputs.C24 as string));return Object.freeze({value:selected.value,lookup:selected.lookup})}}return Object.freeze({value:decimalString('0')})}},
 {id:'JV.LINE.PARKING_DEPTH',version:'JV-XLSM-2026-10-08',dependsOn:['P8','D6','D5','P5','JV.LINE.PARKING_PART_COUNT','P9','D22','P10'],source:{workbook:'JV-комплектация 08.10.2026.xlsm',sheet:'L1',cell:'I26',formula:'=Настройки!$P$8+IF($D$6=2,$D$5/2,$D$5)*Настройки!$P$5+$O$15*Настройки!$P$9+$D$22+Настройки!$P$10'},execute:({inputs,results})=>{const state=results['JV.LINE.PARKING_PART_COUNT'] as {value:DecimalString};const d6=numericInput(inputs.D6,'L1!I26');const panels=compareDecimal(d6,decimalString('2'))===0?divideDecimalExact(decimalString(inputs.D5 as string),decimalString('2')):decimalString(inputs.D5 as string);let total=addDecimal(decimalString(inputs.P8 as string),multiplyDecimal(panels,decimalString(inputs.P5 as string)));total=addDecimal(total,multiplyDecimal(state.value,decimalString(inputs.P9 as string)));total=addDecimal(total,decimalString(inputs.D22 as string));return addDecimal(total,decimalString(inputs.P10 as string))}}
 ])
 const state=graph.values['JV.LINE.PARKED_DOOR_STATE'] as 'ДА'|'НЕТ'|'ОШИБКА'
 const parking=graph.values['JV.LINE.PARKING_PART_COUNT'] as {value:DecimalString;lookup?:LineParkingDepthResult['parkingLookup']}
 const depth=graph.values['JV.LINE.PARKING_DEPTH'] as DecimalString
 return Object.freeze({status:'ok',doorState:state,parkingPartCount:parking.value,...(parking.lookup?{parkingLookup:parking.lookup}:{}),depth:Object.freeze({value:depth,unit:input.unit}),trace:graph.trace,parity:'EXCEL_PARITY_UNVERIFIED'})
}
/** Backward-compatible name retained from PR_03C; the implementation now supports both O15 paths. */
export function calculateLineParkingDepthWithoutParkedDoor(input:LineParkingDepthInput):LineParkingDepthResult{return calculateLineParkingDepth(input)}

export interface LineOpeningWidthInput {
 readonly openingWidth:DecimalString;readonly leaves:DecimalString;readonly sideCount:DecimalString
 readonly specialSashEnabled:boolean;readonly specialSashWidth:DecimalString;readonly mountingFrameState:string
 readonly unit:Unit;readonly settings:{readonly sideClearance:DecimalString;readonly interLeafClearance:DecimalString;readonly sideProfileWidth:DecimalString;readonly rollerAxisToEdge:DecimalString}
}
export interface LineOpeningWidthResult {readonly I25:GeometryMeasure;readonly I27:GeometryMeasure;readonly trace:ReturnType<typeof executeGraph>['trace'];readonly parity:'EXCEL_PARITY_UNVERIFIED'}
/** L1 I25 ROUNDDOWN and I27 chain; dimensions use caller-declared common source unit. */
export function calculateLineOpeningLeafWidth(input:LineOpeningWidthInput):LineOpeningWidthResult{
 const x={D3:decimalString(input.openingWidth),D5:decimalString(input.leaves),D6:decimalString(input.sideCount),C21:input.specialSashEnabled,D21:decimalString(input.specialSashWidth),D15:input.mountingFrameState,P14:decimalString(input.settings.interLeafClearance),P15:decimalString(input.settings.sideClearance),P4:decimalString(input.settings.sideProfileWidth),D22:decimalString(input.settings.rollerAxisToEdge)}
 const graph=executeGraph(x,[
 {id:'JV.LINE.OPENING_LEAF_WIDTH',version:'JV-XLSM-2026-10-08',dependsOn:['D3','C21','D6','D21','P15','D5','P14','D15','P4'],source:{workbook:'JV-комплектация 08.10.2026.xlsm',sheet:'L1',cell:'I25',formula:'=ROUNDDOWN(($D$3-IF($C$21,$D$6*$D$21,0)-2*Настройки!$P$15-($D$5-1)*Настройки!$P$14-IF($D$15="ДА",2*Настройки!$P$4,0))/($D$5-IF($C$21,$D$6,0)),0)'},execute:({inputs})=>{const special=inputs.C21===true;let n=decimalString(inputs.D3 as string);if(special)n=subtractDecimal(n,multiplyDecimal(decimalString(inputs.D6 as string),decimalString(inputs.D21 as string)));n=subtractDecimal(n,multiplyDecimal(decimalString('2'),decimalString(inputs.P15 as string)));n=subtractDecimal(n,multiplyDecimal(subtractDecimal(decimalString(inputs.D5 as string),decimalString('1')),decimalString(inputs.P14 as string)));if(inputs.D15==='ДА')n=subtractDecimal(n,multiplyDecimal(decimalString('2'),decimalString(inputs.P4 as string)));let d=decimalString(inputs.D5 as string);if(special)d=subtractDecimal(d,decimalString(inputs.D6 as string));if(compareDecimal(d,decimalString('0'))===0)return excelError('DIVISION_BY_ZERO','Excel I25 denominator is zero',{denominator:d,source:'L1!I25'});return divideDecimalTruncateToInteger(n,d)}},
 {id:'JV.LINE.PARKING_AXIS_WIDTH',version:'JV-XLSM-2026-10-08',dependsOn:['JV.LINE.OPENING_LEAF_WIDTH','D22'],source:{workbook:'JV-комплектация 08.10.2026.xlsm',sheet:'L1',cell:'I27',formula:'=$I$25-2*$D$22'},execute:({inputs,results})=>subtractDecimal(results['JV.LINE.OPENING_LEAF_WIDTH'] as DecimalString,multiplyDecimal(decimalString('2'),decimalString(inputs.D22 as string)))}
 ])
 const i25=graph.values['JV.LINE.OPENING_LEAF_WIDTH'] as DecimalString,i27=graph.values['JV.LINE.PARKING_AXIS_WIDTH'] as DecimalString
 return Object.freeze({I25:Object.freeze({value:i25,unit:input.unit}),I27:Object.freeze({value:i27,unit:input.unit}),trace:graph.trace,parity:'EXCEL_PARITY_UNVERIFIED'})
}
