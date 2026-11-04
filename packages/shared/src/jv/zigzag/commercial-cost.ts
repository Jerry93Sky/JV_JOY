import { EngineError } from '../errors.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, type ExactRational } from '../rational.ts'
import { traceStep } from '../trace.ts'
import type { TraceStep } from '../types.ts'
import type { ZigzagGeometryResult } from './geometry.ts'
import type { ZigzagMaterialCostResult, ZigzagPriceSnapshot } from './pricing.ts'
import type { ZigzagOrderAllocationResult } from './order-allocation.ts'

export interface ZigzagCommercialInputs {
  readonly slotId:string
  readonly c8:string
  readonly F28:1|2
  readonly D32:boolean
  readonly D33:boolean
  readonly D34:boolean
  readonly L3:boolean
  readonly glassTypeSelector?:number
  readonly N40?:string
  readonly N41?:string
}
export interface ZigzagCommercialResult {
  readonly status:'COMPLETE'|'PARTIAL'
  readonly costs:Readonly<{P39?:ExactRational;P40?:ExactRational;P41?:ExactRational;P43?:ExactRational}>
  readonly p42?:ExactRational
  readonly p44?:ExactRational
  readonly missingDependencies:readonly string[]
  readonly trace:readonly TraceStep[]
}

function flag(value:string):boolean { return /^(1|true|да)$/i.test(value.trim()) }
function maxRational(values:readonly ExactRational[]):ExactRational { return values.reduce((max,value)=>BigInt(value.numerator)*BigInt(max.denominator)>BigInt(max.numerator)*BigInt(value.denominator)?value:max) }
function source(workbook:string,cell:string,formula:string){return {workbook,sheet:'Z1',cell,formula}}
function costTrace(id:string,workbook:string,cell:string,formula:string,inputs:Readonly<Record<string,unknown>>,value:ExactRational,refs:readonly string[]):TraceStep{return traceStep({id,kind:'work',label:`Zigzag ${cell} additional cost`,inputRefs:refs,ruleId:`JV.ZIGZAG.COST.${cell}`,source:source(workbook,cell,formula),catalogRefs:[{id:'JV-ZIGZAG-PRICE-SNAPSHOT',version:workbook}],input:inputs,result:value,status:'ok',errorIds:[],warningIds:[]})}
function requireW(allocation:ZigzagOrderAllocationResult,slotId:string):ExactRational { const w=allocation.systemAllocations?.find((item)=>item.positionId===slotId)?.W;if(!w)throw new EngineError('MISSING_INPUT',`PRM!AB slot allocation is unavailable for ${slotId}`,{positionId:slotId,sourceCell:'ПРМ!AB25:AB31'});return w }

/** Calculates P39 exactly from its sourced U10:U18 chain. Optional additional quantities N40/N41 are explicit inputs, never assumed zero. */
export function calculateZigzagP39(input:{readonly workbook:string;readonly geometry:ZigzagGeometryResult;readonly bom:{readonly exactQuantities:Readonly<Record<number,ExactRational>>};readonly snapshot:ZigzagPriceSnapshot;readonly allocation:ZigzagOrderAllocationResult;readonly slotId:string;readonly c8:string;readonly N40?:string;readonly N41?:string}):{readonly value?:ExactRational;readonly missingDependencies:readonly string[];readonly trace:readonly TraceStep[]} {
  const c8=rationalFromDecimal(input.c8)
  if(BigInt(c8.numerator)===1n&&BigInt(c8.denominator)===1n){const value=rationalFromDecimal('0');return Object.freeze({value,missingDependencies:Object.freeze([]),trace:Object.freeze([costTrace('JV.ZIGZAG.COST.P39',input.workbook,'P39','=IF($C$8<>1,$U$18,0)',{C8:c8},value,['Z1.C8'])])})}
  const missing:string[]=[]
  if(input.N40===undefined)missing.push('Z1!N40')
  if(input.N41===undefined)missing.push('Z1!N41')
  const W=input.allocation.systemAllocations?.find((item)=>item.positionId===input.slotId)?.W
  if(!W)missing.push('ПРМ!AB25:AB31 (W5)')
  if(missing.length)return Object.freeze({missingDependencies:Object.freeze(missing),trace:Object.freeze([])})
  const w=W!,qty=input.bom.exactQuantities,price=input.snapshot.lineCostRates
  let materialSum=rationalFromDecimal('0')
  for(const row of [5,6,7,8,9,10]){
    const quantity=qty[row];if(!quantity)throw new EngineError('MISSING_INPUT',`P39 requires exact Z1!N${row}`)
    materialSum=addRational(materialSum,multiplyRational(quantity,rationalFromDecimal(price[`G${row}` as keyof typeof price].value)))
  }
  const u11=multiplyRational(rationalFromDecimal(input.N40!),rationalFromDecimal(price.G39.value))
  const u12=multiplyRational(rationalFromDecimal(input.N41!),rationalFromDecimal(price.G40.value))
  materialSum=addRational(materialSum,u11);materialSum=addRational(materialSum,u12)
  const c8IsFour=BigInt(c8.numerator)===4n*BigInt(c8.denominator)
  const u13=multiplyRational(materialSum,c8IsFour?rationalFromDecimal(input.snapshot.settings.L11):rationalFromDecimal('1'))
  const u10=multiplyRational(qty[10]!,rationalFromDecimal(price.G10.value))
  const u14=multiplyRational(multiplyRational(rationalFromDecimal(input.snapshot.settings.L9),rationalFromDecimal(input.snapshot.settings.L10)),w)
  const u15=maxRational([u10,u11,u12,u13,u14])
  const u17=multiplyRational(rationalFromDecimal(input.snapshot.serviceRates.C24.value),w)
  const u18=addRational(u15,u17)
  const value=u18
  return Object.freeze({value,missingDependencies:Object.freeze([]),trace:Object.freeze([costTrace('JV.ZIGZAG.COST.U18',input.workbook,'U18','=$U$15+$U$17',{C8:c8,N40:input.N40,N41:input.N41,W5:w,U10:u10,U11:u11,U12:u12,U13:u13,U14:u14,U15:u15,U17:u17},u18,['U15','U17']),costTrace('JV.ZIGZAG.COST.P39',input.workbook,'P39','=IF($C$8<>1,$U$18,0)',{C8:c8,U18:u18},value,['Z1.C8','Z1.U18'])])})
}

/** P40 glass/processing chain from C9, D28:D31 and G26:H33; no cached Excel outputs are accepted. */
export function calculateZigzagP40(input:{readonly workbook:string;readonly enabled:boolean;readonly geometry:ZigzagGeometryResult;readonly snapshot:ZigzagPriceSnapshot;readonly allocation:ZigzagOrderAllocationResult;readonly slotId:string;readonly glassTypeSelector?:number}):{readonly value?:ExactRational;readonly missingDependencies:readonly string[];readonly trace:readonly TraceStep[]} {
  if(!input.enabled){const value=rationalFromDecimal('0');return Object.freeze({value,missingDependencies:Object.freeze([]),trace:Object.freeze([costTrace('JV.ZIGZAG.COST.P40',input.workbook,'P40','=IF(Настройки!$D$32,$H$33,0)',{D32:false},value,['Настройки.D32'])])})}
  const selector=input.glassTypeSelector
  const missing:string[]=[]
  if(!Number.isInteger(selector)||selector!<1||selector!>12)missing.push('Главная!I11 (glass selector 1..12)')
  const W=input.allocation.systemAllocations?.find((item)=>item.positionId===input.slotId)?.W
  if(!W)missing.push('ПРМ!AB25:AB31 (W5)')
  if(missing.length)return Object.freeze({missingDependencies:Object.freeze(missing),trace:Object.freeze([])})
  const rate=input.snapshot.glassRates.find((item)=>item.selector===selector)
  if(!rate)throw new EngineError('LOOKUP_NOT_FOUND',`No glass price lookup for selector ${selector}`,{sourceRange:"'Прайс-Стекло'!D5:D16"})
  const geometry=input.geometry,settings=input.snapshot.settings
  const d28=addRational(rationalFromDecimal(geometry.inputs.heightMm),multiplyRational(rationalFromDecimal('-1'),rationalFromDecimal(settings.P19)))
  const openings=BigInt(geometry.inputs.normalizedOpeningCount),sashes=BigInt(geometry.inputs.normalizedSashCount)
  const c29=rationalFromDecimal(String(openings)),c30=rationalFromDecimal(String(openings===1n?sashes-2n:2n*sashes-4n)),c31=rationalFromDecimal(String(openings))
  const d29=geometry.outputs.D29,d30=geometry.outputs.D30,d31=geometry.outputs.D31
  const glassPrice=rationalFromDecimal(rate.price),oneMillion=rationalFromDecimal('1000000')
  const h26=divideRational(multiplyRational(multiplyRational(glassPrice,d28),d29),oneMillion)
  const h27=divideRational(multiplyRational(multiplyRational(glassPrice,d28),d30),oneMillion)
  const h28Factor=flag(settings.L21)?rationalFromDecimal(settings.L17):rationalFromDecimal('1')
  const h28=divideRational(multiplyRational(multiplyRational(multiplyRational(glassPrice,h28Factor),d28),d31),oneMillion)
  const h29=addRational(addRational(multiplyRational(c29,h26),multiplyRational(c30,h27)),multiplyRational(c31,h28))
  const W5=W!,h33=addRational(h29,multiplyRational(rationalFromDecimal(input.snapshot.serviceRates.C23.value),W5))
  const value=h33
  const trace=costTrace('JV.ZIGZAG.COST.P40',input.workbook,'P40','=IF(Настройки!$D$32,$H$33,0)',{glassSelector:selector,glassPrice:rate.price,sourceCell:rate.sourceCell,D28:d28,D29:d29,D30:d30,D31:d31,C29:c29,C30:c30,C31:c31,H26:h26,H27:h27,H28:h28,H29:h29,W5,H33:h33},value,['Настройки.D32','Z1.H33',rate.sourceCell])
  return Object.freeze({value,missingDependencies:Object.freeze([]),trace:Object.freeze([trace])})
}

/** Independently gated assembly and conversion costs P41. */
export function calculateZigzagP41(input:{readonly workbook:string;readonly assemblyEnabled:boolean;readonly l3Enabled:boolean;readonly widthMm:string;readonly exactN10:ExactRational;readonly snapshot:ZigzagPriceSnapshot}):{readonly value:ExactRational;readonly trace:TraceStep} {
  const width=rationalFromDecimal(input.widthMm),rates=input.snapshot.serviceRates
  const assembly=input.assemblyEnabled?divideRational(multiplyRational(width,rationalFromDecimal(rates.C6.value)),rationalFromDecimal('1000')):rationalFromDecimal('0')
  const production=input.l3Enabled?multiplyRational(input.exactN10,rationalFromDecimal(rates.C19.value)):rationalFromDecimal('0')
  const value=addRational(assembly,production)
  const trace=costTrace('JV.ZIGZAG.COST.P41',input.workbook,'P41',"=IF(Настройки!$D$33,D3*'Прайс-сб+монт'!$C$6/1000,0)+IF(Настройки!$L$3,N10*'Прайс-сб+монт'!$C$19,0)",{D33:input.assemblyEnabled,L3:input.l3Enabled,D3:width,N10:input.exactN10,assembly,production},value,['Настройки.D33','Z1.D3','Прайс-сб+монт.C6','Настройки.L3','Z1.N10','Прайс-сб+монт.C19'])
  return Object.freeze({value,trace})
}

/** Exact installation/measurement formula P43, evaluated only when its source switch is enabled. */
export function calculateZigzagP43(input:{readonly workbook:string;readonly enabled:boolean;readonly widthMm:string;readonly heightMm:string;readonly leafCount:number;snapshot:ZigzagPriceSnapshot}):{readonly value:ExactRational;readonly trace:TraceStep} {
  const rates=input.snapshot.serviceRates
  const value=input.enabled?addRational(addRational(divideRational(multiplyRational(rationalFromDecimal(input.widthMm),rationalFromDecimal(rates.C8.value)),rationalFromDecimal('1000')),divideRational(multiplyRational(multiplyRational(rationalFromDecimal(String(input.leafCount)),rationalFromDecimal(input.heightMm)),rationalFromDecimal(rates.C9.value)),rationalFromDecimal('1000'))),multiplyRational(rationalFromDecimal(String(input.leafCount)),rationalFromDecimal(rates.C13.value))):rationalFromDecimal('0')
  const trace=costTrace('JV.ZIGZAG.COST.P43',input.workbook,'P43',"=IF(Настройки!$D$34,D3*'Прайс-сб+монт'!$C$8/1000+D5*D4*'Прайс-сб+монт'!$C$9/1000+D5*'Прайс-сб+монт'!$C$13,0)",{D34:input.enabled,D3:input.widthMm,D4:input.heightMm,D5:input.leafCount,serviceRates:{C8:rates.C8.value,C9:rates.C9.value,C13:rates.C13.value}},value,['Настройки.D34','Z1.D3','Z1.D4','Z1.D5','Прайс-сб+монт.C8','Прайс-сб+монт.C9','Прайс-сб+монт.C13'])
  return Object.freeze({value,trace})
}

/** P42/P44 are published only if P38, every conditional input, and all shared allocations are complete. */
export function calculateZigzagCommercialPrice(input:{readonly workbook:string;readonly materialCost:ZigzagMaterialCostResult;readonly p39?:ExactRational;readonly p40?:ExactRational;readonly p41?:ExactRational;readonly p43?:ExactRational;readonly F28:1|2;readonly snapshot:ZigzagPriceSnapshot;readonly allocation:ZigzagOrderAllocationResult;readonly slotId:string}):ZigzagCommercialResult {
  const missing:string[]=[]
  if(input.materialCost.p38===undefined)missing.push('Z1!P38 (all P5:P35 must be complete)')
  for(const [name,value] of [['P39',input.p39],['P40',input.p40],['P41',input.p41],['P43',input.p43]] as const)if(value===undefined)missing.push(`Z1!${name}`)
  if(input.snapshot.workbook!==input.workbook||input.materialCost.priceSnapshotVersion!==input.snapshot.version)missing.push('matching workbook/profile price snapshot')
  const W=input.allocation.systemAllocations?.find((item)=>item.positionId===input.slotId)?.W
  if(input.F28===2&&!W)missing.push('ПРМ!AB25:AB31 (W5) for F28=2')
  if(missing.length)return Object.freeze({status:'PARTIAL',costs:Object.freeze({...(input.p39?{P39:input.p39}:{}),...(input.p40?{P40:input.p40}:{}),...(input.p41?{P41:input.p41}:{}),...(input.p43?{P43:input.p43}:{})}),missingDependencies:Object.freeze(missing),trace:Object.freeze([])})
  const slotCharge=input.F28===2?multiplyRational(rationalFromDecimal(input.snapshot.serviceRates.C25.value),W!):rationalFromDecimal('0')
  const p42=addRational(addRational(addRational(addRational(input.materialCost.p38!,input.p39!),input.p40!),input.p41!),slotCharge)
  const p44=addRational(p42,input.p43!)
  const p42Trace=costTrace('JV.ZIGZAG.COST.P42',input.workbook,'P42',"=SUM($P$38:$P$41)+IF(Главная!$F$28=2,'Прайс-сб+монт'!$C$25*$W$5,0)",{P38:input.materialCost.p38,P39:input.p39,P40:input.p40,P41:input.p41,F28:input.F28,C25:input.snapshot.serviceRates.C25.value,W5:W??null,slotCharge},p42,['P38','P39','P40','P41','Главная.F28','Прайс-сб+монт.C25','W5'])
  const p44Trace=costTrace('JV.ZIGZAG.COST.P44',input.workbook,'P44','=SUM($P$42:$P$43)',{P42:p42,P43:input.p43},p44,['P42','P43'])
  return Object.freeze({status:'COMPLETE',costs:Object.freeze({P39:input.p39!,P40:input.p40!,P41:input.p41!,P43:input.p43!}),p42,p44,missingDependencies:Object.freeze([]),trace:Object.freeze([p42Trace,p44Trace])})
}
