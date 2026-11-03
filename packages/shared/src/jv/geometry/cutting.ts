import type { DecimalString } from '../types.ts'
import { addDecimal, decimalString, divideDecimalExact, multiplyDecimal, subtractDecimal } from '../decimal.ts'
import { EngineError } from '../errors.ts'
import { executeGraph } from '../graph.ts'
import type { GeometryMeasure, LineOpeningWidthInput, LineOpeningWidthResult, LineParkingDepthInput, LineParkingDepthResult } from './line.ts'
import { calculateLineOpeningLeafWidth, calculateLineParkingDepth } from './line.ts'

export interface LineCarrierCutItem {
  readonly cutId: 'A'|'B'|'E'|'F'
  readonly label: string
  readonly quantity: {readonly value:DecimalString;readonly unit:'piece'}
  readonly cutLength: GeometryMeasure
  readonly totalCutLength: GeometryMeasure
  readonly sourceCells: {readonly quantity:string;readonly length:string}
}
export interface LineCarrierProfileMaterial {
  readonly catalogCode:'LN-010'
  readonly description:'Профиль несущий'
  readonly catalogUnit:'п.м'
  readonly catalogSource:{readonly workbook:'JV-комплектация 08.10.2026.xlsm'|'JV-розница 08.10.2026.xlsm';readonly sheet:'Прайс-Line';readonly cell:'B5';readonly sourceFormula:"='Прайс-Line'!B5"}
  readonly quantity:DecimalString
  readonly quantitySource:{readonly sheet:'L1';readonly cell:'O5';readonly formula:'=$D$32/1000+Настройки!$D$7/1000'}
}
export interface LineCarrierCuttingResult {
  readonly cutProfile:'LINE_CARRIER_PROFILE'
  readonly items:readonly LineCarrierCutItem[]
  readonly totalCutLength:GeometryMeasure
  readonly materialRequirement:LineCarrierProfileMaterial
  readonly trace:ReturnType<typeof executeGraph>['trace']
  readonly parity:'EXCEL_PARITY_UNVERIFIED'|'EXCEL_GOLDEN_MATCH'
}
export interface LineCarrierCuttingInput {
  readonly openingWidth:GeometryMeasure
  readonly sideCount:DecimalString
  readonly parkingDepth:GeometryMeasure
  readonly parkingAxisWidth:GeometryMeasure
  readonly settings:{
    readonly carrierProfileWidth:GeometryMeasure // Настройки!P2; P1 labels these settings in mm.
    readonly teeWidth:GeometryMeasure // Настройки!P6
    readonly teeProjection:GeometryMeasure // Настройки!P7
    readonly carrierProfileAllowance:GeometryMeasure // Настройки!D7, with D7!E7 = mm.
  }
  readonly sourceWorkbook:'JV-комплектация 08.10.2026.xlsm'|'JV-розница 08.10.2026.xlsm'
}

const CUT_RULE_VERSION='JV-XLSM-2026-10-08'
const FORMULAS={
  C28:'=$D$6',D28:'=$I$26+Настройки!$P$2/2',
  C29:'=$D$6',D29:'=$I$27+Настройки!$P$2/2-Настройки!$P$7',
  C30:'=$D$6',D30:'=$I$26-Настройки!$P$6/2',
  D31:'=$D$3-$D$6*(Настройки!$P$6+$D$30)',
  D32:'=$C$28*$D$28+$C$29*$D$29+$C$30*$D$30+$C$31*$D$31',
  O5:'=$D$32/1000+Настройки!$D$7/1000',
} as const

function assertSameUnit(base:GeometryMeasure,other:GeometryMeasure,source:string):void{
  if(base.unit!==other.unit)throw new EngineError('UNIT_MISMATCH',`${source} combines lengths which must use the same explicit unit`,{expected:base.unit,actual:other.unit,source})
}
function measure(value:DecimalString,unit:GeometryMeasure['unit']):GeometryMeasure{return Object.freeze({value,unit})}

/** Implements L1 carrier-profile cuts C28:D32 and the directly consumed material quantity L1!O5. */
export function calculateLineCarrierProfileCuts(input:LineCarrierCuttingInput):LineCarrierCuttingResult{
  const {openingWidth,sideCount,parkingDepth,parkingAxisWidth,settings}=input
  assertSameUnit(openingWidth,parkingDepth,'L1!D28/D30')
  assertSameUnit(openingWidth,parkingAxisWidth,'L1!D29')
  assertSameUnit(openingWidth,settings.carrierProfileWidth,'Настройки!P2')
  assertSameUnit(openingWidth,settings.teeWidth,'Настройки!P6')
  assertSameUnit(openingWidth,settings.teeProjection,'Настройки!P7')
  assertSameUnit(openingWidth,settings.carrierProfileAllowance,'Настройки!D7')
  const unit=openingWidth.unit
  const p2=decimalString(settings.carrierProfileWidth.value),p6=decimalString(settings.teeWidth.value),p7=decimalString(settings.teeProjection.value),d7=decimalString(settings.carrierProfileAllowance.value)
  const graph=executeGraph({D3:decimalString(openingWidth.value),D6:decimalString(sideCount),I26:decimalString(parkingDepth.value),I27:decimalString(parkingAxisWidth.value),P2:p2,P6:p6,P7:p7,D7:d7,C31:decimalString('1')},[
    {id:'JV.LINE.CUT_A_QUANTITY',version:CUT_RULE_VERSION,dependsOn:['D6'],source:{workbook:input.sourceWorkbook,sheet:'L1',cell:'C28',formula:FORMULAS.C28},execute:({inputs})=>decimalString(inputs.D6 as string)},
    {id:'JV.LINE.CUT_A_LENGTH',version:CUT_RULE_VERSION,dependsOn:['I26','P2'],source:{workbook:input.sourceWorkbook,sheet:'L1',cell:'D28',formula:FORMULAS.D28},execute:({inputs})=>addDecimal(decimalString(inputs.I26 as string),divideDecimalExact(decimalString(inputs.P2 as string),decimalString('2')))},
    {id:'JV.LINE.CUT_B_QUANTITY',version:CUT_RULE_VERSION,dependsOn:['D6'],source:{workbook:input.sourceWorkbook,sheet:'L1',cell:'C29',formula:FORMULAS.C29},execute:({inputs})=>decimalString(inputs.D6 as string)},
    {id:'JV.LINE.CUT_B_LENGTH',version:CUT_RULE_VERSION,dependsOn:['I27','P2','P7'],source:{workbook:input.sourceWorkbook,sheet:'L1',cell:'D29',formula:FORMULAS.D29},execute:({inputs})=>subtractDecimal(addDecimal(decimalString(inputs.I27 as string),divideDecimalExact(decimalString(inputs.P2 as string),decimalString('2'))),decimalString(inputs.P7 as string))},
    {id:'JV.LINE.CUT_E_QUANTITY',version:CUT_RULE_VERSION,dependsOn:['D6'],source:{workbook:input.sourceWorkbook,sheet:'L1',cell:'C30',formula:FORMULAS.C30},execute:({inputs})=>decimalString(inputs.D6 as string)},
    {id:'JV.LINE.CUT_E_LENGTH',version:CUT_RULE_VERSION,dependsOn:['I26','P6'],source:{workbook:input.sourceWorkbook,sheet:'L1',cell:'D30',formula:FORMULAS.D30},execute:({inputs})=>subtractDecimal(decimalString(inputs.I26 as string),divideDecimalExact(decimalString(inputs.P6 as string),decimalString('2')))},
    {id:'JV.LINE.CUT_F_QUANTITY',version:CUT_RULE_VERSION,dependsOn:['C31'],source:{workbook:input.sourceWorkbook,sheet:'L1',cell:'C31'},execute:({inputs})=>decimalString(inputs.C31 as string)},
    {id:'JV.LINE.CUT_F_LENGTH',version:CUT_RULE_VERSION,dependsOn:['D3','D6','P6','JV.LINE.CUT_E_LENGTH'],source:{workbook:input.sourceWorkbook,sheet:'L1',cell:'D31',formula:FORMULAS.D31},execute:({inputs,results})=>subtractDecimal(decimalString(inputs.D3 as string),multiplyDecimal(decimalString(inputs.D6 as string),addDecimal(decimalString(inputs.P6 as string),results['JV.LINE.CUT_E_LENGTH'] as DecimalString)))},
    {id:'JV.LINE.CARRIER_TOTAL_CUT_LENGTH',version:CUT_RULE_VERSION,dependsOn:['JV.LINE.CUT_A_QUANTITY','JV.LINE.CUT_A_LENGTH','JV.LINE.CUT_B_QUANTITY','JV.LINE.CUT_B_LENGTH','JV.LINE.CUT_E_QUANTITY','JV.LINE.CUT_E_LENGTH','JV.LINE.CUT_F_QUANTITY','JV.LINE.CUT_F_LENGTH'],source:{workbook:input.sourceWorkbook,sheet:'L1',cell:'D32',formula:FORMULAS.D32},execute:({results})=>{let total=decimalString('0');for(const [q,l] of [['JV.LINE.CUT_A_QUANTITY','JV.LINE.CUT_A_LENGTH'],['JV.LINE.CUT_B_QUANTITY','JV.LINE.CUT_B_LENGTH'],['JV.LINE.CUT_E_QUANTITY','JV.LINE.CUT_E_LENGTH'],['JV.LINE.CUT_F_QUANTITY','JV.LINE.CUT_F_LENGTH']] as const)total=addDecimal(total,multiplyDecimal(results[q] as DecimalString,results[l] as DecimalString));return total}},
    {id:'JV.LINE.CARRIER_PROFILE_MATERIAL_QUANTITY',version:CUT_RULE_VERSION,dependsOn:['JV.LINE.CARRIER_TOTAL_CUT_LENGTH','D7'],source:{workbook:input.sourceWorkbook,sheet:'L1',cell:'O5',formula:FORMULAS.O5},execute:({inputs,results})=>addDecimal(divideDecimalExact(results['JV.LINE.CARRIER_TOTAL_CUT_LENGTH'] as DecimalString,decimalString('1000')),divideDecimalExact(decimalString(inputs.D7 as string),decimalString('1000')))},
  ])
  const values=graph.values
  const makeItem=(cutId:LineCarrierCutItem['cutId'],label:string,q:string,l:string,qCell:string,lCell:string):LineCarrierCutItem=>{
    const quantity=decimalString(values[q] as string),length=decimalString(values[l] as string)
    return Object.freeze({cutId,label,quantity:Object.freeze({value:quantity,unit:'piece'}),cutLength:measure(length,unit),totalCutLength:measure(multiplyDecimal(quantity,length),unit),sourceCells:Object.freeze({quantity:`L1!${qCell}`,length:`L1!${lCell}`})})
  }
  const total=decimalString(values['JV.LINE.CARRIER_TOTAL_CUT_LENGTH'] as string)
  const materialQuantity=decimalString(values['JV.LINE.CARRIER_PROFILE_MATERIAL_QUANTITY'] as string)
  const catalogSource=Object.freeze({workbook:input.sourceWorkbook,sheet:'Прайс-Line' as const,cell:'B5' as const,sourceFormula:"='Прайс-Line'!B5" as const})
  return Object.freeze({cutProfile:'LINE_CARRIER_PROFILE',items:Object.freeze([
    makeItem('A','А-рез (глубина парковки)','JV.LINE.CUT_A_QUANTITY','JV.LINE.CUT_A_LENGTH','C28','D28'),
    makeItem('B','B-рез (ширина парковки)','JV.LINE.CUT_B_QUANTITY','JV.LINE.CUT_B_LENGTH','C29','D29'),
    makeItem('E','E-рез (глубина парковки на линии остекления)','JV.LINE.CUT_E_QUANTITY','JV.LINE.CUT_E_LENGTH','C30','D30'),
    makeItem('F','F-рез (основная часть несущего)','JV.LINE.CUT_F_QUANTITY','JV.LINE.CUT_F_LENGTH','C31','D31'),
  ]),totalCutLength:measure(total,unit),materialRequirement:Object.freeze({catalogCode:'LN-010',description:'Профиль несущий',catalogUnit:'п.м',catalogSource,quantity:materialQuantity,quantitySource:Object.freeze({sheet:'L1',cell:'O5',formula:FORMULAS.O5})}),trace:graph.trace,parity:'EXCEL_PARITY_UNVERIFIED'})
}

export interface LineGeometryAndCutsInput {
  readonly opening:LineOpeningWidthInput
  readonly parking:Omit<LineParkingDepthInput,'leaves'|'sideCount'|'unit'>
  readonly cuttingSettings:LineCarrierCuttingInput['settings']
  readonly sourceWorkbook:LineCarrierCuttingInput['sourceWorkbook']
}
export interface LineGeometryAndCutsResult {readonly openingWidth:LineOpeningWidthResult;readonly parking:LineParkingDepthResult;readonly cutting:LineCarrierCuttingResult;readonly trace:readonly ReturnType<typeof executeGraph>['trace'][number][];readonly parity:'EXCEL_PARITY_UNVERIFIED'}
/** Composes already implemented geometry DAG rules with the cut DAG; it does not reimplement I25/I26/I27. */
export function calculateLineGeometryAndCuts(input:LineGeometryAndCutsInput):LineGeometryAndCutsResult{
  const opening=calculateLineOpeningLeafWidth(input.opening)
  const parking=calculateLineParkingDepth({...input.parking,leaves:input.opening.leaves,sideCount:input.opening.sideCount,unit:input.opening.unit})
  const cutting=calculateLineCarrierProfileCuts({openingWidth:{value:input.opening.openingWidth,unit:input.opening.unit},sideCount:input.opening.sideCount,parkingDepth:parking.depth,parkingAxisWidth:opening.I27,settings:input.cuttingSettings,sourceWorkbook:input.sourceWorkbook})
  return Object.freeze({openingWidth:opening,parking,cutting,trace:Object.freeze([...opening.trace,...parking.trace,...cutting.trace]),parity:'EXCEL_PARITY_UNVERIFIED'})
}
