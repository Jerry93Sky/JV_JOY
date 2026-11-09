import { EngineError } from './errors.ts'
import { addRational, divideRational, rationalFromDecimal, multiplyRational, rationalToDecimalExact, type ExactRational } from './rational.ts'
import { decimalString } from './decimal.ts'
import type { PriceProfile, TraceStep } from './types.ts'
import { calculateLineConstruction, type LineEngineInputs, type LineEngineSettings, type LineEngineResult, type LineOrderContext } from './line-calculator.ts'
import type { LinePriceSnapshot } from './pricing-line.ts'
import type { LineGlassPriceSnapshot } from './glass-line.ts'
import type { LinePaintPriceSnapshot } from './paint-line.ts'
import { calculateZigzagOrder, type ZigzagOrderPositionInput, type ZigzagOrderPositionResult } from './zigzag/order-calculation.ts'
import type { ZigzagPriceSnapshot, ZigzagPriceSnapshotInput } from './zigzag/pricing.ts'
import { calculateSliderL3Commercial, type SliderL3CommercialInput, type SliderL3CommercialResult } from './slider/pricing.ts'
import { calculateSliderL5Commercial, calculateSliderX3Commercial, calculateSliderX5Commercial, type SliderL5CommercialInput, type SliderL5CommercialResult, type SliderX3CommercialInput, type SliderX3CommercialResult, type SliderX5CommercialInput, type SliderX5CommercialResult } from './slider/l5-pricing.ts'
import { calculateFrontCommercial, type FrontCommercialResult } from './front/commercial.ts'
import type { FrontInput } from './front/calculator.ts'
import type { FrontOrderAreaContext } from './front/commercial-context.ts'
import { calculateMixedOrder, type MixedOrderCalculationResult, type MixedOrderPositionInput } from './mixed-order.ts'
import { calculateLineOrder, type LineOrderResult } from './order-line.ts'
import { calculateZigzagOrderAdhesiveAllocation, type ZigzagOrderAllocationResult, type ZigzagAdhesivePosition } from './zigzag/order-allocation.ts'
import { traceStep } from './trace.ts'

export type UnifiedFamily = 'LINE'|'ZIGZAG'|'SLIDER_L3'|'SLIDER_L5'|'SLIDER_X3'|'SLIDER_X5'|'FRONT'
type LineInvocation = Readonly<{input:LineEngineInputs;settings:LineEngineSettings;priceSnapshot:LinePriceSnapshot;glassSnapshot:LineGlassPriceSnapshot;paintSnapshot:LinePaintPriceSnapshot}>
type ZigzagInvocation = Readonly<{position:Omit<ZigzagOrderPositionInput,'id'|'slot'|'family'|'quantity'> & {geometry:NonNullable<ZigzagOrderPositionInput['geometry']>;commercial:NonNullable<ZigzagOrderPositionInput['commercial']>};snapshot:ZigzagPriceSnapshot|ZigzagPriceSnapshotInput}>
export type UnifiedPositionInput =
 | Readonly<{id:string;slot:number;family:'LINE';quantity:string;calculation:LineInvocation}>
 | Readonly<{id:string;slot:number;family:'ZIGZAG';quantity:string;calculation:ZigzagInvocation}>
 | Readonly<{id:string;slot:number;family:'SLIDER_L3';quantity:string;calculation:SliderL3CommercialInput}>
 | Readonly<{id:string;slot:number;family:'SLIDER_L5';quantity:string;calculation:SliderL5CommercialInput}>
 | Readonly<{id:string;slot:number;family:'SLIDER_X3';quantity:string;calculation:SliderX3CommercialInput}>
 | Readonly<{id:string;slot:number;family:'SLIDER_X5';quantity:string;calculation:SliderX5CommercialInput}>
 | Readonly<{id:string;slot:number;family:'FRONT';quantity:string;calculation:Readonly<{construction:FrontInput;commercial:Omit<Parameters<typeof calculateFrontCommercial>[0],'construction'>}>}>

export type UnifiedCalculation = LineEngineResult|ZigzagOrderPositionResult|SliderL3CommercialResult|SliderL5CommercialResult|SliderX3CommercialResult|SliderX5CommercialResult|FrontCommercialResult
export interface UnifiedBomLine {readonly sku:string;readonly description:string;readonly unit:string;readonly quantity:ExactRational;readonly sourcePositionId:string;readonly family:UnifiedFamily;readonly sourceCell?:string;readonly unitPrice?:ExactRational;readonly amount?:ExactRational;readonly priceSource?:string;readonly traceStepId?:string}
export interface UnifiedPositionResult {readonly id:string;readonly slot:number;readonly family:UnifiedFamily;readonly quantity:ExactRational;readonly status:'COMPLETE'|'PARTIAL';readonly calculation:UnifiedCalculation;readonly bom:readonly UnifiedBomLine[];readonly confirmedUnitAmount?:ExactRational;readonly diagnostics:readonly string[];readonly trace:readonly unknown[]}
export interface UnifiedOrderContext {readonly orderId:string;readonly profile:PriceProfile;readonly workbook:string;readonly workbookSha256:string;readonly positions:readonly Readonly<{id:string;slot:number;family:UnifiedFamily;quantity:ExactRational;widthMm:ExactRational;heightMm:ExactRational;sourceSheet:string;activatorPerConstruction?:ExactRational;adhesivePerConstruction?:ExactRational;consumableSourceCells?:Readonly<{activator:string;adhesive:string}>}>[];readonly sharedResources:ZigzagOrderAllocationResult;readonly trace:readonly TraceStep[]}
export interface UnifiedOrderResult {readonly orderId:string;readonly profile:PriceProfile;readonly status:'COMPLETE'|'PARTIAL';readonly positions:readonly UnifiedPositionResult[];readonly bom:readonly UnifiedBomLine[];readonly orderContext?:UnifiedOrderContext;readonly sharedResources?:ZigzagOrderAllocationResult;readonly totalSalePrice?:ExactRational;readonly trace:readonly unknown[];readonly diagnostics:readonly string[];readonly limitations:readonly string[];readonly confirmedLineZigzagOrder?:MixedOrderCalculationResult;readonly confirmedLineOrder?:LineOrderResult}
export interface UnifiedMainDiscountSnapshot {readonly schemaVersion:'1.0';readonly profile:PriceProfile;readonly workbook:string;readonly workbookSha256:string;readonly capturedWithExcel:'16.0';readonly sourceCell:'Настройки!D19';readonly sourceFormula:string;readonly value:string;readonly positionMarkups?:readonly Readonly<{slot:number;sourceCell:string;sourceFormula:string;value:string}>[];readonly positionDivisors?:readonly Readonly<{family:UnifiedFamily|'SLIDER';sourceCell:string;sourceFormula:string;value:string}>[]}

/** Routes each position through its existing family calculator. No family math is reimplemented here. */
export function calculateJVOrder(input:{readonly orderId:string;readonly profile:PriceProfile;readonly positions:readonly UnifiedPositionInput[];readonly mainDiscount?:UnifiedMainDiscountSnapshot}):UnifiedOrderResult {
 if(!input.orderId.trim())throw new EngineError('INVALID_CONFIGURATION','orderId must not be empty')
 if(!input.positions.length)throw new EngineError('MISSING_INPUT','A JV order requires at least one position')
 if(new Set(input.positions.map(p=>p.id)).size!==input.positions.length)throw new EngineError('INVALID_CONFIGURATION','Order position ids must be unique')
 if(new Set(input.positions.map(p=>p.slot)).size!==input.positions.length||input.positions.some(p=>!Number.isInteger(p.slot)||p.slot<1||p.slot>7))throw new EngineError('INVALID_CONFIGURATION','Each position must use a unique Excel slot 1..7')
 const parsed=input.positions.map(p=>{let quantity:ExactRational;try{quantity=rationalFromDecimal(p.quantity)}catch{throw new EngineError('INVALID_DECIMAL',`Invalid quantity for ${p.id}`,{positionId:p.id})}if(BigInt(quantity.numerator)<=0n||BigInt(quantity.denominator)!==1n)throw new EngineError('INVALID_CONFIGURATION','Position quantity must be a positive integer',{positionId:p.id,quantity:p.quantity});return {position:p,quantity}})
 const families=new Set(parsed.map(x=>x.position.family));const profiles=parsed.map(({position})=>profileOf(position))
 if(profiles.some(p=>p!==input.profile))throw new EngineError('INVALID_CONFIGURATION','All positions and their price snapshots must use the selected order profile')
 const sourceBooks=new Set(parsed.map(({position})=>workbookOf(position))),sourceHashes=new Set(parsed.map(({position})=>workbookShaOf(position)))
 if(sourceBooks.size!==1||sourceHashes.size!==1)throw new EngineError('INVALID_CONFIGURATION','All unified order positions must use one source workbook revision and matching SHA-256')
 const sourceWorkbook=workbookOf(parsed[0]!.position),sourceHash=workbookShaOf(parsed[0]!.position)
 const discount=input.mainDiscount?validateMainDiscount(input.mainDiscount,input.profile,sourceWorkbook,sourceHash):undefined
 const mixed=buildConfirmedLineZigzagOrder(input.orderId,input.positions)
 const lineOnly=!mixed&&input.positions.every(p=>p.family==='LINE')?buildConfirmedLineOrder(input.orderId,input.positions as readonly Extract<UnifiedPositionInput,{family:'LINE'}>[]):undefined
 const mixedById=new Map(mixed?.positions.map(p=>[p.id,p])??[])
 const lineById=new Map(lineOnly?.positions.flatMap(p=>p.calculation?[[p.id,p.calculation] as const]:[])??[])
 const mixedMainPrice=mixed?.status==='COMPLETE'?calculateMixedMainPrice(input.positions,mixed,discount,input.mainDiscount):undefined
 const preliminaryResults=parsed.map(({position,quantity})=>{const familyResult=mixedById.get(position.id);const calculation=familyResult?.lineCalculation??familyResult?.zigzagCalculation??lineById.get(position.id)??dispatch(position);const bom=extractBom(position,calculation,quantity);const complete=familyResult?familyResult.status==='COMPLETE':lineOnly?lineOnly.status==='COMPLETE'&&lineById.has(position.id):calculationStatus(calculation)==='COMPLETE';const diagnostics=familyResult?.diagnostics??calculationDiagnostics(calculation);return Object.freeze({id:position.id,slot:position.slot,family:position.family,quantity,status:complete?'COMPLETE' as const:'PARTIAL' as const,calculation,bom:Object.freeze(bom),diagnostics:Object.freeze(diagnostics),trace:calculationTrace(calculation)})})
 const sharedResources=mixed?.allocation??buildSharedResources(input.orderId,input.positions,preliminaryResults)
 const orderContext=sharedResources?buildUnifiedOrderContext(input.orderId,input.profile,sourceHash,input.positions,preliminaryResults,sharedResources):undefined
 const results=preliminaryResults.map((preliminary,index)=>{const {position,quantity}=parsed[index]!;const familyResult=mixedById.get(position.id);const calculation=familyResult?.lineCalculation??familyResult?.zigzagCalculation??lineById.get(position.id)??(orderContext&&sharedResources?.status==='COMPLETE'?dispatchWithSharedContext(position,input.positions,preliminaryResults,orderContext,sharedResources,input.orderId):preliminary.calculation);const bom=extractBom(position,calculation,quantity);const complete=familyResult?familyResult.status==='COMPLETE':lineOnly?lineOnly.status==='COMPLETE'&&lineById.has(position.id):calculationStatus(calculation)==='COMPLETE';const amount=mixed?mixedMainPrice?.byPosition.get(position.id):undefined;const diagnostics=familyResult?.diagnostics??calculationDiagnostics(calculation);return Object.freeze({id:position.id,slot:position.slot,family:position.family,quantity,status:complete?'COMPLETE' as const:'PARTIAL' as const,calculation,bom:Object.freeze(bom),...(amount?{confirmedUnitAmount:amount}:{}),diagnostics:Object.freeze(diagnostics),trace:calculationTrace(calculation)})})
 const combinedBom=mergeBom(results.flatMap(p=>p.bom));const diagnostics=results.flatMap(p=>p.status==='PARTIAL'?p.diagnostics.map(d=>`${p.id}: ${d}`):[]);const limitations:string[]=[]
 if(mixed&&mixed.status==='PARTIAL'){diagnostics.push(...mixed.diagnostics);limitations.push('The supported Line/Zigzag order coordinator returned PARTIAL; a final order total is therefore withheld.')}
 if(mixed?.status==='COMPLETE'&&!mixedMainPrice)limitations.push(input.mainDiscount?'Captured Main per-slot markup settings Настройки!D21:D27 are required to close the mixed Line/Zigzag Main price transfer; the verified mixed subtotal is retained, but no final order price is published.':'A provenance-matched Main discount and per-slot markup snapshot is required for Главная!Y11:Y17 and AA11:AA17; the verified mixed subtotal is retained, but no final order price is published.')
 const lineMainPrice=lineOnly&&lineOnly.status==='COMPLETE'?calculateLineMainPrice(input.positions as readonly Extract<UnifiedPositionInput,{family:'LINE'}>[],lineOnly,discount,input.mainDiscount):undefined
 if(lineOnly&&!lineMainPrice)limitations.push(input.mainDiscount?'Captured Main per-slot markup settings Настройки!D21:D27 are required to close the Line price transfer; the verified Line order calculation is retained, but no final order price is published.':'A provenance-matched Main discount and per-slot markup snapshot is required for Главная!Y11:AA17; the verified Line order calculation is retained, but no final order price is published.')
 const unifiedMainPrice=!mixed&&!lineOnly&&orderContext?calculateUnifiedMainPrice(results,input.positions,discount,input.mainDiscount):undefined
 if(!mixed&&!lineOnly&&families.size>0&&!unifiedMainPrice)limitations.push('The order-level family calculations completed or retained PARTIAL results, but the provenance-matched Main D11:D14 transfer settings, D19 discount, D21:D27 markups, and all seven selected family source amounts are required to publish AA11:AA18.')
 if(mixed?.status==='COMPLETE'&&!discount)limitations.push('A confirmed Main-sheet discount snapshot Настройки!D19 is required to apply Главная!AA11:AA17; the Line/Zigzag coordinator subtotal is retained but no final order price is published.')
 const chosenPrice=mixedMainPrice??lineMainPrice??unifiedMainPrice
 const allPositionCalculationsComplete=results.every(x=>x.status==='COMPLETE')
 const canPublishTotal=!!chosenPrice&&allPositionCalculationsComplete&&(!orderContext||orderContext.sharedResources.status==='COMPLETE')
 if(!canPublishTotal&&limitations.length===0)limitations.push('At least one required construction, shared-resource, or Main price-transfer dependency is incomplete; no order total is published.')
 diagnostics.push(...limitations)
 const totalSalePrice=canPublishTotal?chosenPrice?.total:undefined
 const reportedResults=results.map(position=>{const amount=chosenPrice?.byPosition.get(position.id);return amount?Object.freeze({...position,confirmedUnitAmount:amount}):position})
 const status=canPublishTotal?'COMPLETE':'PARTIAL'
 const trace=mixed?[...mixed.trace,...(mixedMainPrice?.trace??[])]:lineOnly?[...lineOnly.trace,...(lineMainPrice?.trace??[])]:[...sharedResources?.trace??[],...results.flatMap(p=>p.trace),...(unifiedMainPrice?.trace??[])]
 return Object.freeze({orderId:input.orderId,profile:input.profile,status,positions:Object.freeze(reportedResults),bom:Object.freeze(combinedBom),...(orderContext?{orderContext}:{}),...(sharedResources?{sharedResources}:{}),...(totalSalePrice?{totalSalePrice}:{}),trace:Object.freeze(trace),diagnostics:Object.freeze(diagnostics),limitations:Object.freeze(limitations),...(mixed?{confirmedLineZigzagOrder:mixed}:{}),...(lineOnly?{confirmedLineOrder:lineOnly}:{})})
}

function buildConfirmedLineOrder(orderId:string,positions:readonly Extract<UnifiedPositionInput,{family:'LINE'}>[]):LineOrderResult {
 const first=positions[0]!.calculation,same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
 for(const p of positions)if(!same(p.calculation.settings,first.settings)||!same(p.calculation.priceSnapshot,first.priceSnapshot)||!same(p.calculation.glassSnapshot,first.glassSnapshot)||!same(p.calculation.paintSnapshot,first.paintSnapshot))throw new EngineError('INVALID_CONFIGURATION','Line positions in one order must share identical source settings and price snapshots')
 return calculateLineOrder({orderId,positions:positions.map(p=>({id:p.id,slot:p.slot,family:'LINE' as const,calculation:{...p.calculation.input,constructionId:p.id,excelSlot:p.slot,constructionQuantity:decimalString(p.quantity)}})),settings:first.settings,priceSnapshot:first.priceSnapshot,glassSnapshot:first.glassSnapshot,paintSnapshot:first.paintSnapshot})
}

function calculateLineMainPrice(positions:readonly Extract<UnifiedPositionInput,{family:'LINE'}>[],order:LineOrderResult,discount:ExactRational|undefined,snapshot:UnifiedMainDiscountSnapshot|undefined):{total:ExactRational;byPosition:ReadonlyMap<string,ExactRational>;trace:readonly TraceStep[]}|undefined {
 if(!discount||!snapshot?.positionMarkups)return undefined
 const divisorSource=positions[0]!.calculation.priceSnapshot.settings.D11
 if(!divisorSource)throw new EngineError('MISSING_INPUT','Missing source setting Настройки!D11 for Main Line price transfer')
 let divisor:ExactRational;try{divisor=rationalFromDecimal(divisorSource)}catch{throw new EngineError('INVALID_DECIMAL','Invalid source setting Настройки!D11',{value:divisorSource})}
 if(BigInt(divisor.numerator)<=0n)throw new EngineError('INVALID_CONFIGURATION','Настройки!D11 divisor must be positive')
 const bySlot=new Map(snapshot.positionMarkups.map(x=>[x.slot,x]));if(bySlot.size!==snapshot.positionMarkups.length)throw new EngineError('INVALID_CONFIGURATION','Main markup snapshots must have unique Excel slots')
 const discountFactor=divideRational(addRational(rationalFromDecimal('100'),discount),rationalFromDecimal('100'))
 let total=rationalFromDecimal('0');const trace:TraceStep[]=[],byPosition=new Map<string,ExactRational>()
 for(const position of positions){
  const markup=bySlot.get(position.slot),calc=order.positions.find(x=>x.id===position.id)?.calculation
  if(!calc||!calc.finalPriceAvailable||typeof calc.commercial.q58==='string'||!markup)return undefined
  if(markup.sourceCell!==`Настройки!D${20+position.slot}`||!markup.sourceFormula.trim())throw new EngineError('INVALID_CONFIGURATION','Main markup snapshot provenance does not match the active Excel slot',{slot:position.slot,sourceCell:markup.sourceCell})
  let percent:ExactRational;try{percent=rationalFromDecimal(markup.value)}catch{throw new EngineError('INVALID_DECIMAL','Invalid Main markup setting',{slot:position.slot,value:markup.value})}
  const base=divideRational(calc.commercial.q58,divisor),markupFactor=divideRational(addRational(rationalFromDecimal('100'),percent),rationalFromDecimal('100')),unit=multiplyRational(base,markupFactor),extended=multiplyRational(multiplyRational(unit,rationalFromDecimal(position.quantity)),discountFactor)
  byPosition.set(position.id,multiplyRational(unit,discountFactor))
  total=addRational(total,extended)
  const row=10+position.slot
  trace.push(traceStep({id:`JV.UNIFIED.LINE.MAIN.PRICE.${position.id}`,kind:'pricing',label:`Main price transfer for Line slot ${position.slot}`,inputRefs:[`L${position.slot}!Q58`,'Настройки!D11',markup.sourceCell,`Главная!Z${row}`,'Настройки!D19'],ruleId:'JV.UNIFIED.MAIN.LINE.PRICE-2026-11-08-v1',source:{workbook:position.calculation.input.workbook,sheet:'Главная',cell:`R${row}:AA${row}`,formula:`R${row}='L${position.slot}'!$Q$58/Настройки!$D$11; Y${row}=INDEX(R${row}:X${row},G${row})*(100+Настройки!$D$${20+position.slot})/100; AA${row}=Y${row}*Z${row}*(100+Настройки!$D$19)/100`},catalogRefs:[{id:'JV-MAIN-ORDER-SETTINGS',version:'1.0'}],input:{q58:calc.commercial.q58,divisor,markupPercent:percent,quantity:rationalFromDecimal(position.quantity),discountPercent:discount,markupSourceFormula:markup.sourceFormula},result:{baseUnitPrice:base,unitPriceBeforeOrderDiscount:unit,extendedPrice:extended},status:'ok',errorIds:[],warningIds:[]}))
 }
 return {total,byPosition,trace:Object.freeze(trace)}
}

function calculateMixedMainPrice(positions:readonly UnifiedPositionInput[],order:MixedOrderCalculationResult,discount:ExactRational|undefined,snapshot:UnifiedMainDiscountSnapshot|undefined):{total:ExactRational;byPosition:ReadonlyMap<string,ExactRational>;trace:readonly TraceStep[]}|undefined {
 if(!discount||!snapshot?.positionMarkups)return undefined
 const bySlot=new Map(snapshot.positionMarkups.map(x=>[x.slot,x]));if(bySlot.size!==snapshot.positionMarkups.length)throw new EngineError('INVALID_CONFIGURATION','Main markup snapshots must have unique Excel slots')
 const discountFactor=divideRational(addRational(rationalFromDecimal('100'),discount),rationalFromDecimal('100'))
 const byId=new Map(positions.map(x=>[x.id,x]));let total=rationalFromDecimal('0');const byPosition=new Map<string,ExactRational>(),trace:TraceStep[]=[]
 for(const priced of order.positions){
  const input=byId.get(priced.id),markup=bySlot.get(priced.slot);if(!input||!markup)return undefined
  if(markup.sourceCell!==`Настройки!D${20+priced.slot}`||!markup.sourceFormula.trim())throw new EngineError('INVALID_CONFIGURATION','Main markup snapshot provenance does not match the active Excel slot',{slot:priced.slot,sourceCell:markup.sourceCell})
  let percent:ExactRational;try{percent=rationalFromDecimal(markup.value)}catch{throw new EngineError('INVALID_DECIMAL','Invalid Main markup setting',{slot:priced.slot,value:markup.value})}
  let amount:ExactRational|undefined,divisorSource:string|undefined,baseCell:string|undefined
  if(input.family==='LINE'&&priced.lineCalculation&&typeof priced.lineCalculation.commercial.q58!=='string'){
   divisorSource=input.calculation.priceSnapshot.settings.D11;baseCell=`L${priced.slot}!Q58`;amount=priced.lineCalculation.commercial.q58
  }else if(input.family==='ZIGZAG'&&priced.zigzagCalculation?.costs?.P44){
   divisorSource=input.calculation.snapshot.settings.D12;baseCell=`Z${priced.slot}!P44`;amount=priced.zigzagCalculation.costs.P44
  }else return undefined
  if(!divisorSource)throw new EngineError('MISSING_INPUT',`Missing Main price divisor for ${input.family}`)
  let divisor:ExactRational;try{divisor=rationalFromDecimal(divisorSource)}catch{throw new EngineError('INVALID_DECIMAL','Invalid Main price divisor',{family:input.family,value:divisorSource})}
  if(BigInt(divisor.numerator)<=0n)throw new EngineError('INVALID_CONFIGURATION','Main price divisor must be positive',{family:input.family})
  const base=divideRational(amount,divisor),markupFactor=divideRational(addRational(rationalFromDecimal('100'),percent),rationalFromDecimal('100')),unit=multiplyRational(base,markupFactor),extended=multiplyRational(multiplyRational(unit,priced.quantity),discountFactor),row=10+priced.slot
  byPosition.set(priced.id,multiplyRational(unit,discountFactor));total=addRational(total,extended)
  const column=input.family==='LINE'?'R':'S',sourceSheet=input.family==='LINE'?`L${priced.slot}`:`Z${priced.slot}`
  trace.push(traceStep({id:`JV.UNIFIED.MIXED.MAIN.PRICE.${priced.id}`,kind:'pricing',label:`Main price transfer for ${input.family} slot ${priced.slot}`,inputRefs:[baseCell,'Настройки!D'+(input.family==='LINE'?'11':'12'),markup.sourceCell,`Главная!Z${row}`,'Настройки!D19'],ruleId:'JV.UNIFIED.MAIN.MIXED.PRICE-2026-11-08-v1',source:{workbook:input.family==='LINE'?input.calculation.input.workbook:input.calculation.snapshot.workbook,sheet:'Главная',cell:`${column}${row}:AA${row}`,formula:`${column}${row}='${sourceSheet}'!$${input.family==='LINE'?'Q$58':'P$44'}/Настройки!$D$${input.family==='LINE'?'11':'12'}; Y${row}=INDEX(R${row}:X${row},G${row})*(100+Настройки!$D$${20+priced.slot})/100; AA${row}=Y${row}*Z${row}*(100+Настройки!$D$19)/100`},catalogRefs:[{id:'JV-MAIN-ORDER-SETTINGS',version:'1.0'}],input:{sourceAmount:amount,divisor,markupPercent:percent,quantity:priced.quantity,discountPercent:discount,markupSourceFormula:markup.sourceFormula},result:{baseUnitPrice:base,unitPriceBeforeDiscount:unit,extendedPrice:extended},status:'ok',errorIds:[],warningIds:[]}))
 }
 return {total,byPosition,trace:Object.freeze(trace)}
}

function calculateUnifiedMainPrice(results:readonly UnifiedPositionResult[],inputs:readonly UnifiedPositionInput[],discount:ExactRational|undefined,snapshot:UnifiedMainDiscountSnapshot|undefined):{total:ExactRational;byPosition:ReadonlyMap<string,ExactRational>;trace:readonly TraceStep[]}|undefined {
 if(!discount||!snapshot?.positionMarkups||!snapshot.positionDivisors)return undefined
 const markupBySlot=new Map(snapshot.positionMarkups.map(x=>[x.slot,x])),divisorByFamily=new Map(snapshot.positionDivisors.map(x=>[x.family,x]));if(markupBySlot.size!==snapshot.positionMarkups.length||divisorByFamily.size!==snapshot.positionDivisors.length)return undefined
 const inputById=new Map(inputs.map(x=>[x.id,x])),discountFactor=divideRational(addRational(rationalFromDecimal('100'),discount),rationalFromDecimal('100'));let total=rationalFromDecimal('0');const byPosition=new Map<string,ExactRational>(),trace:TraceStep[]=[]
 for(const position of results){const input=inputById.get(position.id),markup=markupBySlot.get(position.slot),divisorKey=position.family.startsWith('SLIDER_')?'SLIDER':position.family,divisorRecord=divisorByFamily.get(divisorKey);if(!input||!markup||!divisorRecord||position.status!=='COMPLETE')return undefined
  const expectedDivisor=position.family==='LINE'?'Настройки!D11':position.family==='ZIGZAG'?'Настройки!D12':position.family==='FRONT'?'Настройки!D14':'Настройки!D13';if(divisorRecord.sourceCell!==expectedDivisor||!divisorRecord.sourceFormula.trim()||markup.sourceCell!==`Настройки!D${20+position.slot}`||!markup.sourceFormula.trim())return undefined
  let amount:ExactRational|undefined,sourceCell:string|undefined,divisor:ExactRational,markupPercent:ExactRational;try{divisor=rationalFromDecimal(divisorRecord.value);markupPercent=rationalFromDecimal(markup.value)}catch{return undefined}if(BigInt(divisor.numerator)<=0n)return undefined
  const c=position.calculation
  if(position.family==='LINE'&&typeof (c as LineEngineResult).commercial.q58!=='string'){amount=(c as LineEngineResult).commercial.q58 as ExactRational;sourceCell=`L${position.slot}!Q58`}
  else if(position.family==='ZIGZAG'){amount=(c as ZigzagOrderPositionResult).costs?.P44;sourceCell=`Z${position.slot}!P44`}
  else if(position.family.startsWith('SLIDER_')){amount=(c as SliderL3CommercialResult|SliderL5CommercialResult|SliderX3CommercialResult|SliderX5CommercialResult).m53;sourceCell=`S${position.slot}!M53`}
  else{amount=(c as FrontCommercialResult).s38;sourceCell=`F${position.slot}!S38`}
  if(!amount||!sourceCell)return undefined
  const base=divideRational(amount,divisor),markupFactor=divideRational(addRational(rationalFromDecimal('100'),markupPercent),rationalFromDecimal('100')),unit=multiplyRational(base,markupFactor),extended=multiplyRational(multiplyRational(unit,position.quantity),discountFactor),afterDiscount=multiplyRational(unit,discountFactor),row=10+position.slot,column=position.family==='LINE'?'R':position.family==='ZIGZAG'?'S':position.family.startsWith('SLIDER_')?'T':'X',sourceParts=/^(.+)!([A-Z]+)(\d+)$/.exec(sourceCell);if(!sourceParts)return undefined
  byPosition.set(position.id,afterDiscount);total=addRational(total,extended)
  trace.push(traceStep({id:`JV.UNIFIED.MAIN.PRICE.${position.id}`,kind:'pricing',label:`Main price transfer for ${position.family} slot ${position.slot}`,inputRefs:[sourceCell,divisorRecord.sourceCell,markup.sourceCell,`Главная!Z${row}`,'Настройки!D19'],ruleId:'JV.UNIFIED.MAIN.PRICE-2026-11-08-v2',source:{workbook:workbookOf(input),sheet:'Главная',cell:`AA${row}`,formula:`${column}${row}='${sourceParts[1]}'!$${sourceParts[2]}$${sourceParts[3]}/Настройки!$D$${divisorRecord.sourceCell.slice(-2)}; Y${row}=INDEX(R${row}:X${row},G${row})*(100+Настройки!$D$${20+position.slot})/100; AA${row}=Y${row}*Z${row}*(100+Настройки!$D$19)/100`},catalogRefs:[{id:'JV-MAIN-ORDER-SETTINGS',version:'1.0'}],input:{sourceAmount:amount,sourceCell,divisor,markupPercent,quantity:position.quantity,discountPercent:discount},result:{baseUnitPrice:base,unitPriceBeforeDiscount:unit,extendedPrice:extended},status:'ok',errorIds:[],warningIds:[]}))
 }
 trace.push(traceStep({id:'JV.UNIFIED.MAIN.AA18',kind:'summary',label:'Главная!AA18 order total',inputRefs:results.map(x=>`Главная!AA${10+x.slot}`),ruleId:'JV.UNIFIED.MAIN.AA18',source:{workbook:snapshot.workbook,sheet:'Главная',cell:'AA18',formula:'=SUM(AA11:AA17)'},catalogRefs:[{id:'JV-MAIN-ORDER-SETTINGS',version:'1.0'}],input:Object.fromEntries(results.map(x=>[x.id,byPosition.get(x.id)])),result:total,status:'ok',errorIds:[],warningIds:[]}))
 return {total,byPosition,trace:Object.freeze(trace)}
}

function validateMainDiscount(snapshot:UnifiedMainDiscountSnapshot,profile:PriceProfile,workbook:string,workbookSha256:string):ExactRational {
 if(snapshot.schemaVersion!=='1.0'||snapshot.profile!==profile||snapshot.workbook!==workbook||snapshot.workbookSha256!==workbookSha256||snapshot.capturedWithExcel!=='16.0'||snapshot.sourceCell!=='Настройки!D19'||!snapshot.sourceFormula.trim())throw new EngineError('INVALID_CONFIGURATION','Main discount snapshot provenance/profile does not match the order')
 try{return rationalFromDecimal(snapshot.value)}catch{throw new EngineError('INVALID_DECIMAL','Invalid Main discount value',{sourceCell:snapshot.sourceCell,value:snapshot.value})}
}

function buildSharedResources(orderId:string,positions:readonly UnifiedPositionInput[],results:readonly UnifiedPositionResult[]):ZigzagOrderAllocationResult|undefined {
 const byId=new Map(results.map(result=>[result.id,result]))
 const sourceWorkbook=positions[0]&&workbookOf(positions[0]);if(!sourceWorkbook)return undefined
 const inputs:ZigzagAdhesivePosition[]=positions.map(position=>{
  const result=byId.get(position.id)!,calculation=result.calculation
  const quantity=result.quantity
  const dimensions=dimensionsOf(position)
  if(position.family==='LINE'){
   const line=calculation as LineEngineResult
   const activator=line.additionalBom.lines.find(row=>row.sku==='AA-110')?.quantity,glue=line.additionalBom.lines.find(row=>row.sku==='AA-120')?.quantity
   if(!activator||!glue)return{id:position.id,family:'OTHER',quantity}
   return{id:position.id,family:'LINE',quantity,activatorPerConstruction:activator,adhesivePerConstruction:glue,...dimensions,sourceCells:{activator:`L${position.slot}!O49`,adhesive:`L${position.slot}!O50`,orderQuantity:`Главная!Z${10+position.slot}`}}
  }
  if(position.family==='ZIGZAG'){
   const zig=calculation as ZigzagOrderPositionResult
   const activator=zig.materialCost?.positions.find(row=>row.bomRow===34)?.quantity,glue=zig.materialCost?.positions.find(row=>row.bomRow===35)?.quantity
   if(!activator||!glue)return{id:position.id,family:'OTHER',quantity}
   return{id:position.id,family:'ZIGZAG',quantity,activatorPerConstruction:activator,adhesivePerConstruction:glue,...dimensions,sourceCells:{activator:`Z${position.slot}!N34`,adhesive:`Z${position.slot}!N35`,orderQuantity:`Главная!Z${10+position.slot}`}}
  }
  if(position.family.startsWith('SLIDER_')){
   const bom=(calculation as SliderL3CommercialResult|SliderL5CommercialResult|SliderX3CommercialResult|SliderX5CommercialResult).bom
   const activator=bom.positions.find(row=>row.bomRow===40)?.quantity,glue=bom.positions.find(row=>row.bomRow===41)?.quantity
   if(!activator||!glue)return{id:position.id,family:'OTHER',quantity}
   return{id:position.id,family:'SLIDER',quantity,activatorPerConstruction:activator,adhesivePerConstruction:glue,...dimensions,sourceCells:{activator:`S1!K40`,adhesive:`S1!K41`,orderQuantity:`Главная!Z${10+position.slot}`}}
  }
  const front=calculation as FrontCommercialResult
  return{id:position.id,family:'FRONT',quantity,activatorPerConstruction:front.consumables.activatorPerConstruction,adhesivePerConstruction:front.consumables.adhesivePerConstruction,...dimensions,sourceCells:{activator:`Клей+акт!K${4+position.slot} (selector 7 literal zero)`,adhesive:`Клей+акт!K${17+position.slot} (selector 7 literal zero)`,orderQuantity:`Главная!Z${10+position.slot}`}}
 })
 return calculateZigzagOrderAdhesiveAllocation({orderId,workbook:sourceWorkbook,positions:inputs})
}
function buildUnifiedOrderContext(orderId:string,profile:PriceProfile,workbookSha256:string,positions:readonly UnifiedPositionInput[],results:readonly UnifiedPositionResult[],sharedResources:ZigzagOrderAllocationResult):UnifiedOrderContext {
 const byId=new Map(results.map(x=>[x.id,x]))
 const resolved=positions.map(position=>{const result=byId.get(position.id)!,calculation=result.calculation;let activator:ExactRational|undefined,adhesive:ExactRational|undefined,consumableSourceCells:Readonly<{activator:string;adhesive:string}>|undefined
  if(position.family==='LINE'){activator=(calculation as LineEngineResult).additionalBom.lines.find(x=>x.sku==='AA-110')?.quantity;adhesive=(calculation as LineEngineResult).additionalBom.lines.find(x=>x.sku==='AA-120')?.quantity;consumableSourceCells={activator:`L${position.slot}!O49`,adhesive:`L${position.slot}!O50`}}
  else if(position.family==='ZIGZAG'){const c=calculation as ZigzagOrderPositionResult;activator=c.materialCost?.positions.find(x=>x.bomRow===34)?.quantity;adhesive=c.materialCost?.positions.find(x=>x.bomRow===35)?.quantity;consumableSourceCells={activator:`Z${position.slot}!N34`,adhesive:`Z${position.slot}!N35`}}
  else if(position.family.startsWith('SLIDER_')){const c=calculation as SliderL3CommercialResult|SliderL5CommercialResult|SliderX3CommercialResult|SliderX5CommercialResult;activator=c.bom.positions.find(x=>x.bomRow===40)?.quantity;adhesive=c.bom.positions.find(x=>x.bomRow===41)?.quantity;consumableSourceCells={activator:`S${position.slot}!K40`,adhesive:`S${position.slot}!K41`}}
  else{const c=calculation as FrontCommercialResult;activator=c.consumables.activatorPerConstruction;adhesive=c.consumables.adhesivePerConstruction;consumableSourceCells={activator:`Клей+акт!K${4+position.slot}`,adhesive:`Клей+акт!K${17+position.slot}`}}
  const d=dimensionsOf(position);return Object.freeze({id:position.id,slot:position.slot,family:position.family,quantity:result.quantity,widthMm:d.widthMm!,heightMm:d.heightMm!,sourceSheet:sourceSheetOf(position),...(activator?{activatorPerConstruction:activator}:{}),...(adhesive?{adhesivePerConstruction:adhesive}:{}),...(consumableSourceCells?{consumableSourceCells}:{})})
 })
 return Object.freeze({orderId,profile,workbook:workbookOf(positions[0]!),workbookSha256,positions:Object.freeze(resolved),sharedResources,trace:Object.freeze([...sharedResources.trace])})
}
function dispatchWithSharedContext(position:UnifiedPositionInput,allPositions:readonly UnifiedPositionInput[],preliminary:readonly UnifiedPositionResult[],context:UnifiedOrderContext,allocation:ZigzagOrderAllocationResult,orderId:string):UnifiedCalculation {
 if(position.family==='LINE'){
  const factors=allocation.adhesiveFactors,W=allocation.systemAllocations?.find(x=>x.positionId===position.id)?.W
  if(!factors||!W)throw new EngineError('MISSING_INPUT','Unified order context lacks Line glue factors or area share',{positionId:position.id})
  const lineContext:LineOrderContext=Object.freeze({adhesiveFactors:factors,systemAllocationFactor:W,trace:allocation.trace})
  return calculateLineConstruction({...position.calculation.input,constructionId:position.id,excelSlot:position.slot,constructionQuantity:decimalString(position.quantity)},position.calculation.settings,position.calculation.priceSnapshot,position.calculation.glassSnapshot,position.calculation.paintSnapshot,lineContext)
 }
 if(position.family==='ZIGZAG')return calculateZigzagOrder({orderId:`${orderId}:zigzag:${position.id}`,snapshot:position.calculation.snapshot,positions:[{...position.calculation.position,id:position.id,slot:position.slot,family:'ZIGZAG',quantity:position.quantity,geometry:position.calculation.position.geometry,commercial:position.calculation.position.commercial}],sharedAllocation:allocation}).positions[0]!
 if(position.family==='SLIDER_L3'||position.family==='SLIDER_L5'||position.family==='SLIDER_X3'||position.family==='SLIDER_X5'){
  const sliderPositions=buildSliderContextPositions(allPositions,preliminary,context),orderContext={sourceWorkbook:context.workbook,positionMainRow:(10+position.slot) as 11|12|13|14|15|16|17,positions:sliderPositions}
  switch(position.family){case'SLIDER_L3':return calculateSliderL3Commercial({...position.calculation,orderContext});case'SLIDER_L5':return calculateSliderL5Commercial({...position.calculation,orderContext});case'SLIDER_X3':return calculateSliderX3Commercial({...position.calculation,orderContext});case'SLIDER_X5':return calculateSliderX5Commercial({...position.calculation,orderContext})}
 }
 const front=position.calculation,areaPositions=buildFrontAreaPositions(allPositions)
 const order:FrontOrderAreaContext={workbook:context.workbook,sourceSha256:context.workbookSha256,positionMainRow:(10+position.slot) as 11|12|13|14|15|16|17,positions:areaPositions}
 return calculateFrontCommercial({...front.commercial,construction:front.construction,order,mainQuantity:position.quantity})
}
function buildSliderContextPositions(positions:readonly UnifiedPositionInput[],results:readonly UnifiedPositionResult[],context:UnifiedOrderContext):NonNullable<SliderL3CommercialInput['orderContext']>['positions'] {
 const inputs=new Map(positions.map(x=>[x.id,x])),resolved=new Map(context.positions.map(x=>[x.slot,x])),resultById=new Map(results.map(x=>[x.id,x]))
 return Object.freeze(Array.from({length:7},(_,i)=>{const mainRow=(11+i) as 11|12|13|14|15|16|17,ctx=resolved.get(mainRow-10);if(!ctx)return Object.freeze({mainRow,widthMm:'0',heightMm:'0',quantity:'0',systemSelector:0,sourceSheet:''});const sourcePosition=inputs.get(ctx.id)!,sourceResult=resultById.get(ctx.id)!,selector=mainSelector(sourcePosition),family=sourcePosition.family==='LINE'?'LINE':sourcePosition.family==='ZIGZAG'?'ZIGZAG':sourcePosition.family==='FRONT'?'FRONT':'SLIDER';const formula=family==='LINE'?{activator:`='${ctx.sourceSheet}'!$O$49`,glue:`='${ctx.sourceSheet}'!$O$50`}:family==='ZIGZAG'?{activator:`='${ctx.sourceSheet}'!$N$34`,glue:`='${ctx.sourceSheet}'!$N$35`}:family==='FRONT'?{activator:'0',glue:'0'}:{activator:`='${ctx.sourceSheet}'!$K$40`,glue:`='${ctx.sourceSheet}'!$K$41`};const consumable=ctx.activatorPerConstruction&&ctx.adhesivePerConstruction?Object.freeze({activator:ctx.activatorPerConstruction,glue:ctx.adhesivePerConstruction,sourceWorkbook:context.workbook,sourceFormulas:Object.freeze(formula)}):undefined;void sourceResult;return Object.freeze({mainRow,widthMm:rationalText(ctx.widthMm),heightMm:rationalText(ctx.heightMm),quantity:rationalText(ctx.quantity),systemSelector:selector,sourceSheet:ctx.sourceSheet,family,...(consumable?{adhesivePerUnit:consumable}:{})})})) as never
}
function buildFrontAreaPositions(positions:readonly UnifiedPositionInput[]):FrontOrderAreaContext['positions'] {const bySlot=new Map(positions.map(x=>[x.slot,x]));return Object.freeze(Array.from({length:7},(_,i)=>{const mainRow=(11+i) as 11|12|13|14|15|16|17,p=bySlot.get(i+1);return Object.freeze({mainRow,widthMm:p?rationalText(dimensionsOf(p).widthMm!):'0',heightMm:p?rationalText(dimensionsOf(p).heightMm!):'0',quantity:p?p.quantity:'0'})}))}
function mainSelector(position:UnifiedPositionInput):number {switch(position.family){case'LINE':return 1;case'ZIGZAG':return 2;case'SLIDER_L3':return 3;case'SLIDER_L5':return 4;case'SLIDER_X3':return 5;case'SLIDER_X5':return 6;case'FRONT':return 7}}
function sourceSheetOf(position:UnifiedPositionInput):string {switch(position.family){case'LINE':return`L${position.slot}`;case'ZIGZAG':return`Z${position.slot}`;case'SLIDER_L3':case'SLIDER_L5':case'SLIDER_X3':case'SLIDER_X5':return`S${position.slot}`;case'FRONT':return`F${position.slot}`}}
function rationalText(value:ExactRational):string {const out=rationalToDecimalExact(value);if(!out)throw new EngineError('RULE_UNCONFIRMED','Order dimensions and quantities must be finite base-10 decimals');return out}
function dimensionsOf(position:UnifiedPositionInput):Pick<ZigzagAdhesivePosition,'widthMm'|'heightMm'> {
 switch(position.family){
  case'LINE':return{widthMm:rationalFromDecimal(position.calculation.input.widthMm),heightMm:rationalFromDecimal(position.calculation.input.heightMm)}
  case'ZIGZAG':return{widthMm:rationalFromDecimal(position.calculation.position.geometry.widthMm),heightMm:rationalFromDecimal(position.calculation.position.geometry.heightMm)}
  case'SLIDER_L3':case'SLIDER_L5':case'SLIDER_X3':case'SLIDER_X5':return{widthMm:rationalFromDecimal(position.calculation.geometry.widthMm),heightMm:rationalFromDecimal(position.calculation.geometry.heightMm)}
  case'FRONT':return{widthMm:rationalFromDecimal(position.calculation.construction.widthMm),heightMm:rationalFromDecimal(position.calculation.construction.heightMm)}
 }
}
function workbookOf(position:UnifiedPositionInput):string {
 switch(position.family){case'LINE':return position.calculation.input.workbook;case'ZIGZAG':return position.calculation.snapshot.workbook;case'SLIDER_L3':case'SLIDER_L5':case'SLIDER_X3':case'SLIDER_X5':return position.calculation.snapshot.workbook;case'FRONT':return position.calculation.commercial.snapshot.workbook}
}
function workbookShaOf(position:UnifiedPositionInput):string {
 switch(position.family){case'LINE':return position.calculation.priceSnapshot.workbookSha256;case'ZIGZAG':return position.calculation.snapshot.workbookSha256;case'SLIDER_L3':case'SLIDER_L5':case'SLIDER_X3':case'SLIDER_X5':return position.calculation.snapshot.workbookSha256;case'FRONT':return position.calculation.commercial.snapshot.workbookSha256}
}

function buildConfirmedLineZigzagOrder(orderId:string,positions:readonly UnifiedPositionInput[]):MixedOrderCalculationResult|undefined {
 if(!positions.some(p=>p.family==='LINE')||!positions.some(p=>p.family==='ZIGZAG')||positions.some(p=>p.family!=='LINE'&&p.family!=='ZIGZAG'))return undefined
 const linePositions=positions.filter((p):p is Extract<UnifiedPositionInput,{family:'LINE'}>=>p.family==='LINE'),zigPositions=positions.filter((p):p is Extract<UnifiedPositionInput,{family:'ZIGZAG'}>=>p.family==='ZIGZAG'),first=linePositions[0]!,firstZig=zigPositions[0]!
 const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
 if(linePositions.some(p=>!same(p.calculation.settings,first.calculation.settings)||p.calculation.priceSnapshot.workbookSha256!==first.calculation.priceSnapshot.workbookSha256||!same(p.calculation.priceSnapshot,first.calculation.priceSnapshot)||!same(p.calculation.glassSnapshot,first.calculation.glassSnapshot)||!same(p.calculation.paintSnapshot,first.calculation.paintSnapshot)))throw new EngineError('INVALID_CONFIGURATION','Line positions in one order must share identical source settings and snapshots')
 if(zigPositions.some(p=>!same(p.calculation.snapshot,firstZig.calculation.snapshot)))throw new EngineError('INVALID_CONFIGURATION','Zigzag positions in one order must share one identical price snapshot')
 const mixedPositions:MixedOrderPositionInput[]=positions.map(p=>{if(p.family==='LINE')return {id:p.id,slot:p.slot,family:'LINE',calculation:{...p.calculation.input,constructionQuantity:decimalString(p.quantity)}};if(p.family==='ZIGZAG')return {...p.calculation.position,id:p.id,slot:p.slot,family:'ZIGZAG',quantity:p.quantity,geometry:p.calculation.position.geometry,commercial:p.calculation.position.commercial};throw new EngineError('INVALID_CONFIGURATION','Unexpected family in confirmed Line/Zigzag adapter',{family:p.family})})
 return calculateMixedOrder({orderId,positions:mixedPositions,lineSettings:first.calculation.settings,linePriceSnapshot:first.calculation.priceSnapshot,glassSnapshot:first.calculation.glassSnapshot,paintSnapshot:first.calculation.paintSnapshot,zigzagSnapshot:firstZig.calculation.snapshot})
}

function dispatch(p:UnifiedPositionInput):UnifiedCalculation {switch(p.family){case'LINE':return calculateLineAdapter(p);case'ZIGZAG':return calculateZigzagAdapter(p);case'SLIDER_L3':return calculateSliderL3Adapter(p);case'SLIDER_L5':return calculateSliderL5Adapter(p);case'SLIDER_X3':return calculateSliderX3Adapter(p);case'SLIDER_X5':return calculateSliderX5Adapter(p);case'FRONT':return calculateFrontAdapter(p)}}
function calculateLineAdapter(p:Extract<UnifiedPositionInput,{family:'LINE'}>):LineEngineResult {if(p.calculation.input.profile!==p.calculation.priceSnapshot.profile)throw new EngineError('INVALID_CONFIGURATION','Line input and price snapshot profile mismatch',{positionId:p.id});return calculateLineConstruction({...p.calculation.input,excelSlot:p.slot,constructionQuantity:decimalString(p.quantity)},p.calculation.settings,p.calculation.priceSnapshot,p.calculation.glassSnapshot,p.calculation.paintSnapshot)}
function calculateZigzagAdapter(p:Extract<UnifiedPositionInput,{family:'ZIGZAG'}>):ZigzagOrderPositionResult {return calculateZigzagOrder({orderId:`position:${p.id}`,snapshot:p.calculation.snapshot,positions:[{id:p.id,slot:p.slot,family:'ZIGZAG',quantity:p.quantity,geometry:p.calculation.position.geometry,commercial:p.calculation.position.commercial}]}).positions[0]!}
function calculateSliderL3Adapter(p:Extract<UnifiedPositionInput,{family:'SLIDER_L3'}>):SliderL3CommercialResult {return calculateSliderL3Commercial(p.calculation)}
function calculateSliderL5Adapter(p:Extract<UnifiedPositionInput,{family:'SLIDER_L5'}>):SliderL5CommercialResult {return calculateSliderL5Commercial(p.calculation)}
function calculateSliderX3Adapter(p:Extract<UnifiedPositionInput,{family:'SLIDER_X3'}>):SliderX3CommercialResult {return calculateSliderX3Commercial(p.calculation)}
function calculateSliderX5Adapter(p:Extract<UnifiedPositionInput,{family:'SLIDER_X5'}>):SliderX5CommercialResult {return calculateSliderX5Commercial(p.calculation)}
function calculateFrontAdapter(p:Extract<UnifiedPositionInput,{family:'FRONT'}>):FrontCommercialResult {return calculateFrontCommercial({...p.calculation.commercial,construction:p.calculation.construction,mainQuantity:p.quantity})}
function profileOf(p:UnifiedPositionInput):PriceProfile {switch(p.family){case'LINE':return p.calculation.priceSnapshot.profile;case'ZIGZAG':return p.calculation.snapshot.profile;case'SLIDER_L3':case'SLIDER_L5':case'SLIDER_X3':case'SLIDER_X5':return p.calculation.snapshot.profile;case'FRONT':return p.calculation.commercial.snapshot.profile}}
function calculationStatus(c:UnifiedCalculation):'COMPLETE'|'PARTIAL'{return c.status}
function calculationTrace(c:UnifiedCalculation):readonly unknown[]{return c.trace}
function calculationDiagnostics(c:UnifiedCalculation):readonly string[]{return c.diagnostics}
function unitAmount(c:UnifiedCalculation):ExactRational|undefined {if('unitSalePrice'in c)return c.unitSalePrice;return undefined}
function extractBom(p:UnifiedPositionInput,c:UnifiedCalculation,multiplier:ExactRational):UnifiedBomLine[]{const out:UnifiedBomLine[]=[];const add=(sku:string,description:string,unit:string,quantity:ExactRational,sourceCell?:string,traceStepId?:string,unitPrice?:ExactRational,amount?:ExactRational,priceSource?:string)=>out.push(Object.freeze({sku,description,unit,quantity:multiplyRational(quantity,multiplier),sourcePositionId:p.id,family:p.family,...(sourceCell?{sourceCell}:{}),...(traceStepId?{traceStepId}:{}),...(unitPrice?{unitPrice}:{}),...(amount?{amount:multiplyRational(amount,multiplier)}:{}),...(priceSource?{priceSource}:{})}));if(p.family==='LINE'&&'materials'in c){for(const row of c.materials.positions)add(row.sku,row.sku,row.unit,rationalFromDecimal(row.quantity),row.sourceCell,row.traceStepId,row.unitPrice,row.amount,row.sourcePrice.cell);for(const row of c.additionalMaterials.positions)add(row.sku,row.sku,row.unit,typeof row.quantity==='string'?rationalFromDecimal(row.quantity):row.quantity,row.sourceCell,row.traceStepId,row.unitPrice,row.amount)}else if(p.family==='ZIGZAG'&&'materialCost'in c){for(const row of c.materialCost?.positions??[])add(row.sku,row.sku,row.unit,row.quantity,`Z${p.slot}!${row.bomRow}`,row.traceStepId,row.unitPrice,row.amount,row.priceSourceCell)}else if(p.family.startsWith('SLIDER_')&&'materialPositions'in c){for(const row of c.materialPositions)add(row.sku,row.description,row.unit,row.quantity,row.sourceCell,row.traceStepId,row.unitPrice,row.amount,row.priceSourceCell)}else if(p.family==='FRONT'&&'material'in c){for(const row of c.material.positions)if(row.sku&&row.status==='PRICED')add(row.sku,row.sku,row.unit,row.quantity,`F1!S${row.row}`,row.traceStepId,row.unitPrice,row.amount,row.priceSourceCells.join(', '))}return out}
function mergeBom(lines:readonly UnifiedBomLine[]):UnifiedBomLine[]{const merged=new Map<string,UnifiedBomLine>();for(const line of lines){const sourceClass=line.sourceCell?.replace(/^([LZ])\d+!/,'$1*!')??'';const key=`${line.family}\u0000${line.sku}\u0000${line.unit}\u0000${sourceClass}\u0000${line.priceSource??''}`;const prior=merged.get(key);if(!prior){merged.set(key,Object.freeze({...line,sourcePositionId:line.sourcePositionId}));continue}merged.set(key,Object.freeze({...prior,quantity:addRational(prior.quantity,line.quantity),...(prior.amount&&line.amount?{amount:addRational(prior.amount,line.amount)}:{}),sourcePositionId:[...new Set(`${prior.sourcePositionId},${line.sourcePositionId}`.split(','))].join(','),sourceCell:prior.sourceCell===line.sourceCell?prior.sourceCell:`${prior.sourceCell}; ${line.sourceCell}`,...(prior.traceStepId&&line.traceStepId&&prior.traceStepId!==line.traceStepId?{traceStepId:`${prior.traceStepId}; ${line.traceStepId}`}:{})}))}return [...merged.values()]}
