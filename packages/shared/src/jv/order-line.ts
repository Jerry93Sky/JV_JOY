import { EngineError } from './errors.ts'
import { executeGraph } from './graph.ts'
import { calculateLineAdhesiveFactors } from './adhesive-line.ts'
import { addRational, multiplyRational, rationalFromDecimal, type ExactRational } from './rational.ts'
import { calculateLineConstruction, type LineEngineInputs, type LineEngineSettings, type LineEngineResult, type LineOrderContext } from './line-calculator.ts'
import type { LinePriceSnapshot } from './pricing-line.ts'
import type { LineGlassPriceSnapshot } from './glass-line.ts'
import type { LinePaintPriceSnapshot } from './paint-line.ts'
import type { JVVariant } from './types.ts'

export type LineOrderPosition = Readonly<{ id:string; slot:number; family:'LINE'; calculation:LineEngineInputs }>
export type UnsupportedOrderPosition = Readonly<{ id:string; slot:number; family:Exclude<JVVariant,'LINE'>; widthMm:string; heightMm:string; quantity:string }>
export type JVOrderPosition = LineOrderPosition | UnsupportedOrderPosition
export interface LineOrderInput {
  readonly orderId:string
  readonly positions:readonly JVOrderPosition[]
  readonly settings:LineEngineSettings
  readonly priceSnapshot:LinePriceSnapshot
  readonly glassSnapshot:LineGlassPriceSnapshot
  readonly paintSnapshot:LinePaintPriceSnapshot
}
export interface LineOrderTotals { readonly Q52:ExactRational; readonly Q53:ExactRational; readonly Q54:ExactRational; readonly Q55:ExactRational; readonly Q56:ExactRational; readonly Q57:ExactRational; readonly Q58:ExactRational }
export interface LineOrderSpecificationLine { readonly sku:string; readonly unit:string; readonly quantity:ExactRational; readonly amount:ExactRational; readonly sourcePositions:readonly string[] }
export interface LineOrderSharedRules {
  readonly totalActivatorConsumption:ExactRational
  readonly totalAdhesiveConsumption:ExactRational
  readonly adhesiveFactors:Readonly<{O5:ExactRational;O18:ExactRational}>
  readonly systemAllocations:readonly Readonly<{positionId:string;slot:number;X5:ExactRational}>[]
}
export interface LineOrderResult {
  readonly orderId:string
  readonly status:'COMPLETE'|'PARTIAL'
  readonly profile:LineEngineInputs['profile']
  readonly positions:readonly Readonly<{id:string;family:string;quantity:ExactRational;calculation?:LineEngineResult;pricingScope:'ORDER'|'CONSTRUCTION_ONLY_ORDER_RULES_UNAVAILABLE';status:'COMPLETE'|'PARTIAL'}>[]
  readonly totals?:LineOrderTotals
  readonly sharedRules?:LineOrderSharedRules
  readonly specification:readonly LineOrderSpecificationLine[]
  readonly trace:readonly unknown[]
  readonly diagnostics:readonly string[]
}

/** Order-level orchestration over the existing construction engine; it adds only shared Excel order rules. */
export function calculateLineOrder(input:LineOrderInput):LineOrderResult {
  if(!input.orderId.trim())throw new EngineError('INVALID_CONFIGURATION','orderId must not be empty')
  if(input.positions.length===0)throw new EngineError('MISSING_INPUT','An order must contain at least one position')
  if(new Set(input.positions.map(x=>x.id)).size!==input.positions.length)throw new EngineError('INVALID_CONFIGURATION','Order position ids must be unique')
  if(new Set(input.positions.map(x=>x.slot)).size!==input.positions.length||input.positions.some(x=>!Number.isInteger(x.slot)||x.slot<1||x.slot>7))throw new EngineError('INVALID_CONFIGURATION','Each position must map to a unique Excel slot 1..7')
  const lines=input.positions.filter((x):x is LineOrderPosition=>x.family==='LINE')
  for(const p of lines)if(p.id!==p.calculation.constructionId)throw new EngineError('INVALID_CONFIGURATION','Position id must match its construction calculation id',{positionId:p.id,constructionId:p.calculation.constructionId})
  const profile=input.priceSnapshot.profile, workbook=input.priceSnapshot.workbook
  if(input.glassSnapshot.profile!==profile||input.paintSnapshot.profile!==profile||input.glassSnapshot.workbook!==workbook||input.paintSnapshot.workbook!==workbook)throw new EngineError('INVALID_CONFIGURATION','All order catalog snapshots must reference the same workbook and profile')
  if(lines.some(x=>x.calculation.profile!==profile||x.calculation.workbook!==workbook))throw new EngineError('INVALID_CONFIGURATION','Every JV-Line position must use the order workbook and profile')
  const unsupported=input.positions.filter(x=>x.family!=='LINE')

  // Other-family glue consumption is unknown until its family engine exists. Never publish a made-up mixed-order total.
  if(unsupported.length){
    const positions:LineOrderResult['positions'][number][] = lines.map(p=>Object.freeze({id:p.id,family:p.family,quantity:rationalFromDecimal(p.calculation.constructionQuantity),calculation:calculateLineConstruction({...p.calculation,excelSlot:p.slot},input.settings,input.priceSnapshot,input.glassSnapshot,input.paintSnapshot),pricingScope:'CONSTRUCTION_ONLY_ORDER_RULES_UNAVAILABLE' as const,status:'PARTIAL' as const}))
    for(const p of unsupported)positions.push(Object.freeze({id:p.id,family:p.family,quantity:rationalFromDecimal(p.quantity),pricingScope:'CONSTRUCTION_ONLY_ORDER_RULES_UNAVAILABLE',status:'PARTIAL' as const}))
    return Object.freeze({orderId:input.orderId,status:'PARTIAL',profile,positions:Object.freeze(positions),specification:Object.freeze([]),trace:Object.freeze([]),diagnostics:Object.freeze([`No totals are published: unsupported system families affect order-wide adhesive/activator minima and cannot yet be included safely (${unsupported.map(x=>x.family).join(', ')}).`])})
  }
  if(lines.length!==input.positions.length)throw new EngineError('INVALID_CONFIGURATION','Order has no calculable JV-Line positions')

  // First pass obtains per-construction BOM consumption from the same Line engine; no formulas are reimplemented here.
  const preliminary=lines.map(p=>({position:p,result:calculateLineConstruction({...p.calculation,excelSlot:p.slot},input.settings,input.priceSnapshot,input.glassSnapshot,input.paintSnapshot)}))
  let activatorTotal=rationalFromDecimal('0'), adhesiveTotal=rationalFromDecimal('0')
  for(const {position,result} of preliminary){
    const quantity=rationalFromDecimal(position.calculation.constructionQuantity)
    const bySku=new Map(result.additionalBom.lines.map(x=>[x.sku,x.quantity]))
    const activator=bySku.get('AA-110'),adhesive=bySku.get('AA-120')
    if(!activator||!adhesive)throw new EngineError('RULE_UNCONFIRMED','JV-Line adhesive and activator BOM inputs are required for order aggregation',{positionId:position.id})
    activatorTotal=addRational(activatorTotal,multiplyRational(activator,quantity))
    adhesiveTotal=addRational(adhesiveTotal,multiplyRational(adhesive,quantity))
  }
  const adhesiveFactors=calculateLineAdhesiveFactors({activatorQuantityPerConstruction:activatorTotal,adhesiveQuantityPerConstruction:adhesiveTotal,constructionQuantity:rationalFromDecimal('1'),workbook})

  // ПРМ!AB25:AB31 = AA(slot)/(AA32*W(slot)); AA is area*quantity. Preserve the literal sourced relation in trace.
  let totalArea=rationalFromDecimal('0')
  for(const {position} of preliminary){const i=position.calculation;const area=multiplyRational(rationalFromDecimal(i.widthMm),rationalFromDecimal(i.heightMm));totalArea=addRational(totalArea,multiplyRational(area,rationalFromDecimal(i.constructionQuantity)))}
  if(BigInt(totalArea.numerator)<=0n)throw new EngineError('INVALID_CONFIGURATION','Order area denominator must be positive')
  const xValues:Record<string,unknown>={totalArea}
  for(const {position} of preliminary){const i=position.calculation;xValues[`${position.id}.area`]=multiplyRational(rationalFromDecimal(i.widthMm),rationalFromDecimal(i.heightMm));xValues[`${position.id}.quantity`]=rationalFromDecimal(i.constructionQuantity)}
  const xRules=preliminary.map(({position})=>{const sourceRow=24+position.slot;return {id:`JV.ORDER.X5.${position.id}`,version:'JV-ORDER-X5-2026-10-08',dependsOn:['totalArea',`${position.id}.area`,`${position.id}.quantity`],source:{workbook,sheet:'ПРМ',cell:`AB${sourceRow}`,formula:`=IFERROR(AA${sourceRow}/($AA$32*W${sourceRow}),0)`},execute:({inputs}:any)=>{const weighted=multiplyRational(inputs[`${position.id}.area`],inputs[`${position.id}.quantity`]);const denominator=multiplyRational(inputs.totalArea,inputs[`${position.id}.quantity`]);return multiplyRational(weighted,{numerator:denominator.denominator,denominator:denominator.numerator})}}})
  const allocations=executeGraph(xValues,xRules)
  const contexts=new Map<string,LineOrderContext>()
  for(const {position} of preliminary)contexts.set(position.id,Object.freeze({adhesiveFactors:{O5:adhesiveFactors.O5,O18:adhesiveFactors.O18},systemAllocationFactor:allocations.values[`JV.ORDER.X5.${position.id}`] as ExactRational,trace:Object.freeze([...adhesiveFactors.trace,...allocations.trace])}))
  const calculated=lines.map(p=>({position:p,result:calculateLineConstruction({...p.calculation,excelSlot:p.slot},input.settings,input.priceSnapshot,input.glassSnapshot,input.paintSnapshot,contexts.get(p.id))}))
  const aggregateInputs:Record<string,unknown>={}
  for(const {position,result} of calculated){const id=position.id;aggregateInputs[`${id}.quantity`]=rationalFromDecimal(position.calculation.constructionQuantity);aggregateInputs[`${id}.Q52`]=result.materialSubtotal.supportedSubtotal;aggregateInputs[`${id}.Q53`]=result.paint.q53;aggregateInputs[`${id}.Q54`]=result.glass.surcharge;aggregateInputs[`${id}.Q55`]=result.work.assemblyAndMilling;aggregateInputs[`${id}.Q56`]=result.commercial.q56;aggregateInputs[`${id}.Q57`]=result.work.installation;if(typeof result.commercial.q58==='string')throw new EngineError('RULE_FAILED','A position failed the Excel Q58 guard',{constructionId:result.constructionId});aggregateInputs[`${id}.Q58`]=result.commercial.q58}
  const aggregateRules=(['Q52','Q53','Q54','Q55','Q56','Q57','Q58'] as const).map(cell=>({id:`JV.ORDER.AGGREGATE.${cell}`,version:'JV-ORDER-AGGREGATION-2026-10-08',dependsOn:calculated.flatMap(({position})=>[`${position.id}.quantity`,`${position.id}.${cell}`]),execute:({inputs}:any)=>calculated.reduce((sum,{position})=>addRational(sum,multiplyRational(inputs[`${position.id}.${cell}`],inputs[`${position.id}.quantity`])),rationalFromDecimal('0'))}))
  const aggregateGraph=executeGraph(aggregateInputs,aggregateRules)
  const totals:LineOrderTotals=Object.freeze(Object.fromEntries((['Q52','Q53','Q54','Q55','Q56','Q57','Q58'] as const).map(cell=>[cell,aggregateGraph.values[`JV.ORDER.AGGREGATE.${cell}`]])) as unknown as LineOrderTotals)
  const spec=new Map<string,{unit:string;quantity:ExactRational;amount:ExactRational;positions:Set<string>}>()
  for(const {position,result} of calculated){const multiplier=rationalFromDecimal(position.calculation.constructionQuantity);const rows=[...result.materials.positions,...result.additionalMaterials.positions];for(const row of rows){const old=spec.get(row.sku);const rawQuantity=row.quantity as string|ExactRational;const baseQuantity=typeof rawQuantity==='string'?rationalFromDecimal(rawQuantity):rawQuantity;const qty=multiplyRational(baseQuantity,multiplier);if(old){old.quantity=addRational(old.quantity,qty);old.amount=addRational(old.amount,multiplyRational(row.amount,multiplier));old.positions.add(position.id)}else spec.set(row.sku,{unit:row.unit,quantity:qty,amount:multiplyRational(row.amount,multiplier),positions:new Set([position.id])})}}
  const specification=Object.freeze([...spec.entries()].map(([sku,x])=>Object.freeze({sku,unit:x.unit,quantity:x.quantity,amount:x.amount,sourcePositions:Object.freeze([...x.positions])})))
  const positionResults=calculated.map(({position,result})=>Object.freeze({id:position.id,family:'LINE',quantity:rationalFromDecimal(position.calculation.constructionQuantity),calculation:result,pricingScope:'ORDER' as const,status:result.finalPriceAvailable?'COMPLETE' as const:'PARTIAL' as const}))
  const diagnostics=calculated.flatMap(({position,result})=>result.finalPriceAvailable?[]:result.diagnostics.map(x=>`${position.id}: ${x}`))
  const sharedRules:LineOrderSharedRules=Object.freeze({totalActivatorConsumption:activatorTotal,totalAdhesiveConsumption:adhesiveTotal,adhesiveFactors:Object.freeze({O5:adhesiveFactors.O5,O18:adhesiveFactors.O18}),systemAllocations:Object.freeze(preliminary.map(({position})=>Object.freeze({positionId:position.id,slot:position.slot,X5:allocations.values[`JV.ORDER.X5.${position.id}`] as ExactRational})))})
  return Object.freeze({orderId:input.orderId,status:positionResults.every(x=>x.status==='COMPLETE')?'COMPLETE':'PARTIAL',profile,positions:Object.freeze(positionResults),...(positionResults.every(x=>x.status==='COMPLETE')?{totals}:{}),sharedRules,specification,trace:Object.freeze([...adhesiveFactors.trace,...allocations.trace,...aggregateGraph.trace,...calculated.flatMap(x=>x.result.trace)]),diagnostics:Object.freeze(diagnostics)})
}
