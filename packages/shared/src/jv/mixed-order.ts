import { EngineError } from './errors.ts'
import { calculateLineConstruction, type LineEngineInputs, type LineEngineSettings, type LineEngineResult } from './line-calculator.ts'
import type { LinePriceSnapshot } from './pricing-line.ts'
import type { LineGlassPriceSnapshot } from './glass-line.ts'
import type { LinePaintPriceSnapshot } from './paint-line.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, type ExactRational } from './rational.ts'
import { traceStep } from './trace.ts'
import type { TraceStep } from './types.ts'
import { calculateZigzagGeometry, type ZigzagGeometryInput } from './zigzag/geometry.ts'
import { calculateZigzagBaseMaterialQuantities } from './zigzag/material-quantities.ts'
import { calculateZigzagOrderAdhesiveAllocation, type ZigzagOrderAllocationResult } from './zigzag/order-allocation.ts'
import { calculateZigzagOrder, type ZigzagOrderPositionInput, type ZigzagOrderPositionResult } from './zigzag/order-calculation.ts'
import { buildZigzagPriceSnapshot, type ZigzagPriceSnapshot, type ZigzagPriceSnapshotInput } from './zigzag/pricing.ts'

export type MixedOrderPositionInput =
  | Readonly<{ id:string; slot:number; family:'LINE'; calculation:LineEngineInputs }>
  | (ZigzagOrderPositionInput & Readonly<{ family:'ZIGZAG' }>)

export interface MixedOrderSpecificationLine {
  readonly id:string
  readonly sku:string
  readonly description:string
  readonly unit:string
  readonly quantity:ExactRational
  readonly unitPrice:ExactRational
  readonly amount:ExactRational
  readonly family:'LINE'|'ZIGZAG'
  readonly sourcePositionId:string
  readonly profile:'COMPLETATION'|'RETAIL'
  readonly catalogVersion:string
  readonly traceStepId:string
}

export interface MixedOrderPositionResult {
  readonly id:string
  readonly slot:number
  readonly family:'LINE'|'ZIGZAG'
  readonly quantity:ExactRational
  readonly status:'COMPLETE'|'PARTIAL'
  readonly baseUnitSalePrice?:ExactRational
  readonly unitSalePrice?:ExactRational
  readonly extendedSalePrice?:ExactRational
  readonly lineCalculation?:LineEngineResult
  readonly zigzagCalculation?:ZigzagOrderPositionResult
  readonly diagnostics:readonly string[]
}

export interface MixedOrderCalculationResult {
  readonly orderId:string
  readonly profile:'COMPLETATION'|'RETAIL'
  readonly workbook:string
  readonly status:'COMPLETE'|'PARTIAL'
  readonly positions:readonly MixedOrderPositionResult[]
  readonly allocation:ZigzagOrderAllocationResult
  readonly specification:readonly MixedOrderSpecificationLine[]
  readonly totalSalePrice?:ExactRational
  readonly trace:readonly TraceStep[]
  readonly diagnostics:readonly string[]
}

/** Coordinates supported Line and Zigzag formulas against one Excel order context. */
export function calculateMixedOrder(input:{
  readonly orderId:string
  readonly positions:readonly MixedOrderPositionInput[]
  readonly lineSettings:LineEngineSettings
  readonly linePriceSnapshot:LinePriceSnapshot
  readonly glassSnapshot:LineGlassPriceSnapshot
  readonly paintSnapshot:LinePaintPriceSnapshot
  readonly zigzagSnapshot:ZigzagPriceSnapshot|ZigzagPriceSnapshotInput
}):MixedOrderCalculationResult {
  if(!input.orderId.trim())throw new EngineError('INVALID_CONFIGURATION','orderId must not be empty')
  if(!input.positions.length)throw new EngineError('MISSING_INPUT','A mixed order requires at least one position')
  if(new Set(input.positions.map(x=>x.id)).size!==input.positions.length)throw new EngineError('INVALID_CONFIGURATION','Order position ids must be unique')
  if(new Set(input.positions.map(x=>x.slot)).size!==input.positions.length||input.positions.some(x=>!Number.isInteger(x.slot)||x.slot<1||x.slot>7))throw new EngineError('INVALID_CONFIGURATION','Each position must map to one unique Excel slot 1..7')
  const lines=input.positions.filter((x):x is Extract<MixedOrderPositionInput,{family:'LINE'}>=>x.family==='LINE')
  const zigInput=input.positions.filter((x):x is Extract<MixedOrderPositionInput,{family:'ZIGZAG'}>=>x.family==='ZIGZAG')
  if(!lines.length||!zigInput.length)throw new EngineError('INVALID_CONFIGURATION','Mixed orders require at least one supported JV-Line and one JV-Zigzag position')
  const zigSnapshot='capturedFrom' in input.zigzagSnapshot?buildZigzagPriceSnapshot(input.zigzagSnapshot):input.zigzagSnapshot
  const profile=input.linePriceSnapshot.profile,workbook=input.linePriceSnapshot.workbook
  if(input.linePriceSnapshot.currency!=='RUB'||input.glassSnapshot.profile!==profile||input.paintSnapshot.profile!==profile||zigSnapshot.profile!==profile||input.glassSnapshot.workbook!==workbook||input.paintSnapshot.workbook!==workbook||zigSnapshot.workbook!==workbook)throw new EngineError('INVALID_CONFIGURATION','All mixed-order price snapshots must use one workbook, currency, and profile')
  const snapshots=[input.linePriceSnapshot,input.glassSnapshot,input.paintSnapshot,zigSnapshot]
  if(snapshots.some(x=>x.workbookSha256!==input.linePriceSnapshot.workbookSha256))throw new EngineError('INVALID_CONFIGURATION','Mixed-order snapshots must have matching source workbook hashes')
  const divisorLine=readPositiveSetting(input.linePriceSnapshot.settings.D11,'Настройки!D11')
  const divisorZig=readPositiveSetting(zigSnapshot.settings.D12,'Настройки!D12')
  const markupLine=rationalFromDecimal(requiredSetting(input.linePriceSnapshot.settings.D21,'Настройки!D21'))
  const markupZig=rationalFromDecimal(requiredSetting(input.linePriceSnapshot.settings.D22,'Настройки!D22'))

  const globalModes=new Set<number>()
  const modeValue=(value:number)=>{if(!Number.isInteger(value))throw new EngineError('INVALID_CONFIGURATION','Главная!F28 must be an integer selector');globalModes.add(value)}
  lines.forEach(p=>{if(p.id!==p.calculation.constructionId)throw new EngineError('INVALID_CONFIGURATION','Position id must match Line constructionId',{id:p.id});if(p.calculation.profile!==profile||p.calculation.workbook!==workbook)throw new EngineError('INVALID_CONFIGURATION','Line position snapshot profile/workbook mismatch',{id:p.id});modeValue(p.calculation.commercialModeIndex)})
  zigInput.forEach(p=>{if(!p.geometry||!p.commercial)throw new EngineError('MISSING_INPUT','Zigzag positions require geometry and commercial inputs',{id:p.id});modeValue(p.commercial.F28)})
  if(globalModes.size!==1)throw new EngineError('INVALID_CONFIGURATION','All active positions must use the same order-level Главная!F28')
  const modes=[...globalModes]
  if(modes[0]!==1&&modes[0]!==2)throw new EngineError('RULE_UNCONFIRMED','Only source-verified Главная!F28 selectors 1 and 2 are supported',{F28:modes[0]})
  const zigModes=new Set(zigInput.map(p=>{const c=p.commercial!;return `${c.D32}|${c.D33}|${c.D34}|${c.L3}`}))
  if(zigModes.size!==1)throw new EngineError('INVALID_CONFIGURATION','Настройки!D32/D33/D34/L3 are order-level and must match across Zigzag positions')
  const zMode=zigInput[0]!.commercial!
  if(input.lineSettings.D32!==zMode.D32)throw new EngineError('INVALID_CONFIGURATION','Line and Zigzag glass toggles must use the same Настройки!D32')
  for(const p of lines){const i=p.calculation;if(i.assemblyEnabled!==zMode.D33||i.millingEnabled!==zMode.L3||i.installationEnabled!==zMode.D34)throw new EngineError('INVALID_CONFIGURATION','Line work toggles must match the common Zigzag order settings',{positionId:p.id})}

  const quantities=new Map<string,ExactRational>()
  for(const p of lines)quantities.set(p.id,positiveQuantity(p.calculation.constructionQuantity,p.id))
  for(const p of zigInput)quantities.set(p.id,positiveQuantity(p.quantity,p.id))
  const linePreliminary=lines.map(p=>({position:p,result:calculateLineConstruction({...p.calculation,excelSlot:p.slot},input.lineSettings,input.linePriceSnapshot,input.glassSnapshot,input.paintSnapshot)}))
  const zigPreliminary=zigInput.map(position=>{const geometry=calculateZigzagGeometry(position.geometry as ZigzagGeometryInput);return {position,geometry,bom:calculateZigzagBaseMaterialQuantities(geometry)}})
  const lineById=new Map(linePreliminary.map(x=>[x.position.id,x.result]))
  const zigById=new Map(zigPreliminary.map(x=>[x.position.id,x]))
  const allocationInputs=input.positions.map(position=>{
    const quantity=quantities.get(position.id)!
    if(position.family==='LINE'){
      const result=lineById.get(position.id)!,bySku=new Map(result.additionalBom.lines.map(x=>[x.sku,x.quantity]))
      const activator=bySku.get('AA-110'),adhesive=bySku.get('AA-120')
      if(activator===undefined||adhesive===undefined)throw new EngineError('RULE_UNCONFIRMED','Line requires confirmed per-construction AA-110 and AA-120 consumption',{positionId:position.id})
      return {id:position.id,family:'LINE' as const,quantity,activatorPerConstruction:activator,adhesivePerConstruction:adhesive,widthMm:rationalFromDecimal(position.calculation.widthMm),heightMm:rationalFromDecimal(position.calculation.heightMm)}
    }
    const item=zigById.get(position.id)!
    return {id:position.id,family:'ZIGZAG' as const,quantity,activatorPerConstruction:item.bom.exactQuantities[34]!,adhesivePerConstruction:item.bom.exactQuantities[35]!,widthMm:rationalFromDecimal(item.geometry.inputs.widthMm),heightMm:rationalFromDecimal(item.geometry.inputs.heightMm)}
  })
  const rawAllocation=calculateZigzagOrderAdhesiveAllocation({orderId:input.orderId,workbook,positions:allocationInputs})
  const allocationInputsTrace=allocationInputs.map(position=>({positionId:position.id,family:position.family,quantity:position.quantity,activatorPerConstruction:position.activatorPerConstruction,adhesivePerConstruction:position.adhesivePerConstruction,activatorSource:position.family==='LINE'?`L${input.positions.find(p=>p.id===position.id)!.slot}!O49`:`Z${input.positions.find(p=>p.id===position.id)!.slot}!N34`,adhesiveSource:position.family==='LINE'?`L${input.positions.find(p=>p.id===position.id)!.slot}!O50`:`Z${input.positions.find(p=>p.id===position.id)!.slot}!N35`}))
  const allocation=Object.freeze({...rawAllocation,trace:Object.freeze(rawAllocation.trace.map(step=>step.source?.sheet==='Клей+акт'?Object.freeze({...step,inputRefs:Object.freeze([...allocationInputsTrace.map(x=>x.positionId),...allocationInputsTrace.map(x=>step.source?.cell==='N12'||step.source?.cell==='O5'?x.activatorSource:x.adhesiveSource)]),input:Object.freeze({...step.input,positionConsumptions:allocationInputsTrace})}):step))})
  if(allocation.status!=='COMPLETE'||!allocation.adhesiveFactors||!allocation.systemAllocations)throw new EngineError('RULE_UNCONFIRMED','The mixed-family order is missing a shared glue or area allocation dependency',{unsupported:allocation.unsupportedPositions})

  const allocations=new Map(allocation.systemAllocations.map(x=>[x.positionId,x.W]))
  const lineResults=new Map<string,LineEngineResult>()
  for(const p of lines){
    const factor=allocations.get(p.id);if(!factor)throw new EngineError('MISSING_INPUT','PRM area allocation is missing a Line position',{positionId:p.id})
    const result=calculateLineConstruction({...p.calculation,excelSlot:p.slot},input.lineSettings,input.linePriceSnapshot,input.glassSnapshot,input.paintSnapshot,{adhesiveFactors:allocation.adhesiveFactors,systemAllocationFactor:factor,trace:allocation.trace})
    lineResults.set(p.id,result)
  }
  const zigOrder=calculateZigzagOrder({orderId:input.orderId,snapshot:zigSnapshot,positions:zigInput,sharedAllocation:allocation})
  const zigResults=new Map(zigOrder.positions.map(x=>[x.id,x]))

  const specification:MixedOrderSpecificationLine[]=[]
  const positionResults:MixedOrderPositionResult[]=[]
  const orderPriceRules:TraceStep[]=[]
  let total=rationalFromDecimal('0');let allComplete=true
  for(const p of input.positions){
    const quantity=quantities.get(p.id)!,allocationFactor=allocations.get(p.id)!
    let baseUnit:ExactRational|undefined,unit:ExactRational|undefined,extended:ExactRational|undefined,complete=false
    const diagnostics:string[]=[]
    if(p.family==='LINE'){
      const result=lineResults.get(p.id)!
      if(!result.finalPriceAvailable||typeof result.commercial.q58==='string'){diagnostics.push(...result.diagnostics);allComplete=false}
      else{
        baseUnit=divideRational(result.commercial.q58,divisorLine)
        unit=multiplyRational(baseUnit,divideRational(addRational(rationalFromDecimal('100'),markupLine),rationalFromDecimal('100')))
        extended=multiplyRational(unit,quantity);total=addRational(total,extended);complete=true
        orderPriceRules.push(mainPriceTrace(input.orderId,p,workbook,'R',result.commercial.q58,divisorLine,markupLine,quantity,baseUnit,unit,extended,input.linePriceSnapshot.version))
      }
      appendLineSpecification(specification,p.id,quantity,profile,input.linePriceSnapshot.version,result)
      positionResults.push(Object.freeze({id:p.id,slot:p.slot,family:p.family,quantity,status:complete?'COMPLETE':'PARTIAL',...(baseUnit?{baseUnitSalePrice:baseUnit}:{}),...(unit?{unitSalePrice:unit}:{}),...(extended?{extendedSalePrice:extended}:{}),lineCalculation:result,diagnostics:Object.freeze(diagnostics)}))
    }else{
      const result=zigResults.get(p.id)!
      if(result.status!=='COMPLETE'||!result.unitSalePrice){diagnostics.push(...result.diagnostics);allComplete=false}
      else{
        baseUnit=result.unitSalePrice
        unit=multiplyRational(baseUnit,divideRational(addRational(rationalFromDecimal('100'),markupZig),rationalFromDecimal('100')))
        extended=multiplyRational(unit,quantity);total=addRational(total,extended);complete=true
        orderPriceRules.push(mainPriceTrace(input.orderId,p,workbook,'S',result.costs?.P44!,divisorZig,markupZig,quantity,baseUnit,unit,extended,zigSnapshot.version))
      }
      if(result.status==='COMPLETE')appendZigzagSpecification(specification,p.id,quantity,profile,zigSnapshot.version,result,zigSnapshot)
      positionResults.push(Object.freeze({id:p.id,slot:p.slot,family:p.family,quantity,status:complete?'COMPLETE':'PARTIAL',...(baseUnit?{baseUnitSalePrice:baseUnit}:{}),...(unit?{unitSalePrice:unit}:{}),...(extended?{extendedSalePrice:extended}:{}),zigzagCalculation:result,diagnostics:Object.freeze(diagnostics)}))
    }
    if(!complete)allComplete=false
    const allocRule=traceStep({id:`JV.MIXED.ORDER.AREA.${p.id}`,kind:'summary',label:`ПРМ!AB${24+p.slot} area share for ${p.family}`,inputRefs:[`Главная!C${10+p.slot}`,`Главная!D${10+p.slot}`,`Главная!Z${10+p.slot}`,'ПРМ!AA32'],ruleId:'JV-MIXED-ORDER-AREA-SHARE-2026-11-04-v1',source:{workbook,sheet:'ПРМ',cell:`AB${24+p.slot}`,formula:`=IFERROR(AA${24+p.slot}/($AA$32*W${24+p.slot}),0)`},catalogRefs:[],input:{positionId:p.id,family:p.family,widthMm:allocationInputs.find(x=>x.id===p.id)!.widthMm,heightMm:allocationInputs.find(x=>x.id===p.id)!.heightMm,quantity,totalWeightedArea:allocationInputs.reduce((sum,x)=>addRational(sum,multiplyRational(multiplyRational(x.widthMm!,x.heightMm!),x.quantity)),rationalFromDecimal('0'))},result:allocationFactor,status:'ok',errorIds:[],warningIds:[]})
    orderPriceRules.push(allocRule)
  }
  const trace=[...allocation.trace,...[...lineResults.values()].flatMap(x=>x.trace as readonly TraceStep[]),...zigOrder.trace,...orderPriceRules]
  const uniqueTrace=[...new Map(trace.map(step=>[step.id,step])).values()]
  const diagnostics=[...positionResults.flatMap(p=>p.status==='PARTIAL'?p.diagnostics.map(x=>`${p.id}: ${x}`):[])]
  return Object.freeze({orderId:input.orderId,profile,workbook,status:allComplete?'COMPLETE':'PARTIAL',positions:Object.freeze(positionResults),allocation,specification:Object.freeze(specification),...(allComplete?{totalSalePrice:total}:{}),trace:Object.freeze(uniqueTrace),diagnostics:Object.freeze(diagnostics)})
}

function requiredSetting(value:string|undefined,source:string):string {if(value===undefined)throw new EngineError('MISSING_INPUT',`Missing source setting ${source}`);try{rationalFromDecimal(value)}catch{throw new EngineError('INVALID_DECIMAL',`Invalid source setting ${source}`,{value})}return value}
function readPositiveSetting(value:string|undefined,source:string):ExactRational {const result=rationalFromDecimal(requiredSetting(value,source));if(BigInt(result.numerator)<=0n)throw new EngineError('INVALID_CONFIGURATION',`${source} must be positive`);return result}
function positiveQuantity(value:string,id:string):ExactRational {let result:ExactRational;try{result=rationalFromDecimal(value)}catch{throw new EngineError('INVALID_DECIMAL',`Invalid position quantity for ${id}`,{positionId:id,value})}if(BigInt(result.numerator)<=0n)throw new EngineError('INVALID_CONFIGURATION','Position quantity must be positive',{positionId:id});return result}

function mainPriceTrace(orderId:string,p:MixedOrderPositionInput,workbook:string,baseColumn:'R'|'S',sourceAmount:ExactRational,divisor:ExactRational,markup:ExactRational,quantity:ExactRational,base:ExactRational,unit:ExactRational,extended:ExactRational,version:string):TraceStep {
  return traceStep({id:`JV.MIXED.ORDER.Y.${p.id}`,kind:'pricing',label:`Главная!Y${10+p.slot} selected family sale price and quantity extension`,inputRefs:[`${p.family==='LINE'?'L':'Z'}${p.slot}!${p.family==='LINE'?'Q58':'P44'}`,`Настройки!D${p.family==='LINE'?'11':'12'}`,`Настройки!D${p.family==='LINE'?'21':'22'}`,`Главная!Z${10+p.slot}`],ruleId:'JV-MIXED-ORDER-MAIN-PRICE-2026-11-04-v1',source:{workbook,sheet:'Главная',cell:`Y${10+p.slot}`,formula:`=INDEX(R${10+p.slot}:X${10+p.slot},G${10+p.slot})*(100+Настройки!$D${20+p.slot})/100`},catalogRefs:[{id:'JV-LINE-PRICE-SNAPSHOT',version},{id:'JV-ZIGZAG-PRICE-SNAPSHOT',version}],input:{orderId,positionId:p.id,baseColumn,sourceAmount,divisor,markupPercent:markup,quantity,baseUnitSalePrice:base},result:{unitSalePrice:unit,extendedSalePrice:extended},status:'ok',errorIds:[],warningIds:[]})
}

function appendLineSpecification(output:MixedOrderSpecificationLine[],positionId:string,multiplier:ExactRational,profile:'COMPLETATION'|'RETAIL',version:string,result:LineEngineResult):void {
  const baseRows=result.materials.positions.map(row=>({row,description:result.bom.lines.find(x=>x.sourceCell===row.sourceCell)?.description??row.sku}))
  const extraRows=result.additionalMaterials.positions.map(row=>({row,description:result.additionalBom.lines.find(x=>x.sourceCell===row.sourceCell)?.description??row.sku}))
  for(const {row,description} of [...baseRows,...extraRows])output.push(Object.freeze({id:`${positionId}:${row.sourceCell}:${row.sku}`,sku:row.sku,description,unit:row.unit,quantity:multiplyRational(asRational(row.quantity),multiplier),unitPrice:row.unitPrice,amount:multiplyRational(row.amount,multiplier),family:'LINE',sourcePositionId:positionId,profile,catalogVersion:version,traceStepId:row.traceStepId}))
}

function appendZigzagSpecification(output:MixedOrderSpecificationLine[],positionId:string,multiplier:ExactRational,profile:'COMPLETATION'|'RETAIL',version:string,result:ZigzagOrderPositionResult,snapshot:ZigzagPriceSnapshot):void {
  for(const row of result.materialCost?.positions??[]){const source=snapshot.entries.find(x=>x.bomRow===row.bomRow);if(!source||!row.amount)continue;output.push(Object.freeze({id:`${positionId}:Z${row.bomRow}:${row.sku}`,sku:row.sku,description:source.description,unit:row.unit,quantity:multiplyRational(row.quantity,multiplier),unitPrice:row.unitPrice,amount:multiplyRational(row.amount,multiplier),family:'ZIGZAG',sourcePositionId:positionId,profile,catalogVersion:version,traceStepId:row.traceStepId}))}
}

function asRational(value:string|ExactRational):ExactRational{return typeof value==='string'?rationalFromDecimal(value):value}
