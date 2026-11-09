import { EngineError } from '../errors.ts'
import { executeGraph } from '../graph.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, type ExactRational } from '../rational.ts'
import { traceStep } from '../trace.ts'

export interface ZigzagAdhesivePosition {
  readonly id:string
  readonly family:'LINE'|'ZIGZAG'|'OTHER'
  readonly quantity:ExactRational
  readonly activatorPerConstruction?:ExactRational
  readonly adhesivePerConstruction?:ExactRational
  readonly widthMm?:ExactRational
  readonly heightMm?:ExactRational
}
export interface ZigzagOrderAllocationResult {
  readonly workbook:string
  readonly status:'COMPLETE'|'PARTIAL'
  readonly totalActivatorConsumption:ExactRational
  readonly totalAdhesiveConsumption:ExactRational
  readonly activatorPackages?:ExactRational
  readonly adhesivePackages?:ExactRational
  readonly adhesiveFactors?:Readonly<{O5:ExactRational;O18:ExactRational}>
  readonly systemAllocations?:readonly Readonly<{positionId:string;W:ExactRational}>[]
  readonly unsupportedPositions:readonly string[]
  readonly trace:ReturnType<typeof executeGraph>['trace']
}

function ceilAtLeastOne(value:ExactRational):ExactRational {
  const n=BigInt(value.numerator),d=BigInt(value.denominator)
  if(n<0n||d<=0n) throw new EngineError('INVALID_CONFIGURATION','Zigzag order adhesive consumption must be non-negative')
  const ceiling=n===0n?1n:(n+d-1n)/d
  return {numerator:String(ceiling),denominator:'1'}
}

/**
 * Implements Клей+акт!N12/N25/O5/O18 for an order made entirely from supported
 * Zigzag positions. Other system families block the shared factors because their
 * selector-column consumption has not been supplied by a verified family engine.
 */
export function calculateZigzagOrderAdhesiveAllocation(input:{readonly orderId:string;readonly workbook:string;readonly positions:readonly ZigzagAdhesivePosition[]}):ZigzagOrderAllocationResult {
  if(!input.orderId.trim()||!input.workbook) throw new EngineError('INVALID_CONFIGURATION','Zigzag adhesive allocation requires order and workbook identity')
  if(input.positions.length===0) throw new EngineError('MISSING_INPUT','Zigzag adhesive allocation requires at least one order position')
  if(new Set(input.positions.map((position)=>position.id)).size!==input.positions.length) throw new EngineError('INVALID_CONFIGURATION','Zigzag order position ids must be unique')
  let activator=rationalFromDecimal('0'),adhesive=rationalFromDecimal('0')
  const unsupported:string[]=[]
  let hasAllAreas=true,totalWeightedArea=rationalFromDecimal('0')
  for(const position of input.positions) {
    if(BigInt(position.quantity.numerator)<0n) throw new EngineError('INVALID_CONFIGURATION','Order position quantity cannot be negative',{positionId:position.id})
    if(position.family==='OTHER') { unsupported.push(position.id); continue }
    if(!position.activatorPerConstruction||!position.adhesivePerConstruction) throw new EngineError('MISSING_INPUT','Zigzag position requires exact N34 and N35 quantities',{positionId:position.id})
    activator=addRational(activator,multiplyRational(position.activatorPerConstruction,position.quantity))
    adhesive=addRational(adhesive,multiplyRational(position.adhesivePerConstruction,position.quantity))
  }
  for(const position of input.positions) {
    if(position.widthMm===undefined||position.heightMm===undefined) { hasAllAreas=false; continue }
    totalWeightedArea=addRational(totalWeightedArea,multiplyRational(multiplyRational(position.widthMm,position.heightMm),position.quantity))
  }
  const systemAllocations=hasAllAreas&&BigInt(totalWeightedArea.numerator)>0n?Object.freeze(input.positions.map((position)=>Object.freeze({positionId:position.id,W:BigInt(position.quantity.numerator)===0n?rationalFromDecimal('0'):divideRational(multiplyRational(position.widthMm!,position.heightMm!),totalWeightedArea)}))):undefined
  if(unsupported.length) {
    const trace=Object.freeze([
      traceStep({id:'JV.ZIGZAG.ORDER.GLUE.N12',kind:'summary',label:'Known order activator consumption before unsupported-family inputs',inputRefs:input.positions.filter((position)=>position.family!=='OTHER').map((position)=>position.id),ruleId:'JV-ZIGZAG-ORDER-ADHESIVE-2026-11-04-v1',source:{workbook:input.workbook,sheet:'Клей+акт',cell:'N12',formula:'=IF(ROUNDUP(SUM(N5:N11),0)>1,ROUNDUP(SUM(N5:N11),0),1)'},catalogRefs:[],input:{knownActivatorConsumption:activator,unsupportedPositions:unsupported},result:activator,status:'unavailable',errorIds:[],warningIds:['MIXED_FAMILY_CONSUMPTION_UNAVAILABLE']}),
      traceStep({id:'JV.ZIGZAG.ORDER.GLUE.N25',kind:'summary',label:'Known order adhesive consumption before unsupported-family inputs',inputRefs:input.positions.filter((position)=>position.family!=='OTHER').map((position)=>position.id),ruleId:'JV-ZIGZAG-ORDER-ADHESIVE-2026-11-04-v1',source:{workbook:input.workbook,sheet:'Клей+акт',cell:'N25',formula:'=IF(ROUNDUP(SUM(N18:N24),0)>1,ROUNDUP(SUM(N18:N24),0),1)'},catalogRefs:[],input:{knownAdhesiveConsumption:adhesive,unsupportedPositions:unsupported},result:adhesive,status:'unavailable',errorIds:[],warningIds:['MIXED_FAMILY_CONSUMPTION_UNAVAILABLE']}),
    ])
    return Object.freeze({workbook:input.workbook,status:'PARTIAL',totalActivatorConsumption:activator,totalAdhesiveConsumption:adhesive,...(systemAllocations?{systemAllocations}:{}),unsupportedPositions:Object.freeze(unsupported),trace})
  }
  if(BigInt(activator.numerator)===0n||BigInt(adhesive.numerator)===0n) throw new EngineError('DIVISION_BY_ZERO','Excel O5/O18 divides the package minimum by total glue consumption; a zero total is not priceable')
  const inputs={activator,adhesive}
  const rules=[
    {id:'JV.ZIGZAG.ORDER.GLUE.N12',version:'JV-ZIGZAG-ORDER-ADHESIVE-2026-11-04-v1',dependsOn:['activator'],source:{workbook:input.workbook,sheet:'Клей+акт',cell:'N12',formula:'=IF(ROUNDUP(SUM(N5:N11),0)>1,ROUNDUP(SUM(N5:N11),0),1)'},execute:({inputs:values}:any)=>ceilAtLeastOne(values.activator)},
    {id:'JV.ZIGZAG.ORDER.GLUE.N25',version:'JV-ZIGZAG-ORDER-ADHESIVE-2026-11-04-v1',dependsOn:['adhesive'],source:{workbook:input.workbook,sheet:'Клей+акт',cell:'N25',formula:'=IF(ROUNDUP(SUM(N18:N24),0)>1,ROUNDUP(SUM(N18:N24),0),1)'},execute:({inputs:values}:any)=>ceilAtLeastOne(values.adhesive)},
    {id:'JV.ZIGZAG.ORDER.GLUE.O5',version:'JV-ZIGZAG-ORDER-ADHESIVE-2026-11-04-v1',dependsOn:['JV.ZIGZAG.ORDER.GLUE.N12','activator'],source:{workbook:input.workbook,sheet:'Клей+акт',cell:'O5',formula:'=N12/SUM(N5:N11)'},execute:({inputs:values,results}:any)=>divideRational(results['JV.ZIGZAG.ORDER.GLUE.N12'] as ExactRational,values.activator as ExactRational)},
    {id:'JV.ZIGZAG.ORDER.GLUE.O18',version:'JV-ZIGZAG-ORDER-ADHESIVE-2026-11-04-v1',dependsOn:['JV.ZIGZAG.ORDER.GLUE.N25','adhesive'],source:{workbook:input.workbook,sheet:'Клей+акт',cell:'O18',formula:'=N25/SUM(N18:N24)'},execute:({inputs:values,results}:any)=>divideRational(results['JV.ZIGZAG.ORDER.GLUE.N25'] as ExactRational,inputs.adhesive)},
  ]
  const graph=executeGraph(inputs,rules)
  return Object.freeze({workbook:input.workbook,status:'COMPLETE',totalActivatorConsumption:activator,totalAdhesiveConsumption:adhesive,activatorPackages:graph.values['JV.ZIGZAG.ORDER.GLUE.N12'] as ExactRational,adhesivePackages:graph.values['JV.ZIGZAG.ORDER.GLUE.N25'] as ExactRational,adhesiveFactors:Object.freeze({O5:graph.values['JV.ZIGZAG.ORDER.GLUE.O5'] as ExactRational,O18:graph.values['JV.ZIGZAG.ORDER.GLUE.O18'] as ExactRational}),...(systemAllocations?{systemAllocations}:{}),unsupportedPositions:Object.freeze([]),trace:graph.trace})
}
