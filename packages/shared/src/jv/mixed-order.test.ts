import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decimalString } from './decimal.ts'
import { divideRational, multiplyRational, rationalFromDecimal, type ExactRational } from './rational.ts'
import { calculateMixedOrder, type MixedOrderPositionInput } from './mixed-order.ts'
import type { LineEngineInputs, LineEngineSettings } from './line-calculator.ts'
import type { ZigzagPriceSnapshotInput } from './zigzag/pricing.ts'

const captured=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/mixed-order-pr10h-excel.json',import.meta.url),'utf8')) as {cases:any[]}
const lineCommercial=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-full-commercial-excel-golden.json',import.meta.url),'utf8')).cases
const linePrices=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-price-snapshots.json',import.meta.url),'utf8')).sources
const lineGlasses=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-glass-price-snapshots.json',import.meta.url),'utf8')).sources
const linePaints=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-paint-price-snapshots.json',import.meta.url),'utf8')).sources
const zigPrices=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/zigzag-price-snapshots.json',import.meta.url),'utf8')).sources as ZigzagPriceSnapshotInput[]
const zigSettings={P4:'14',P24:'42',P25:'51',P26:'6.5',P27:'5.7',P28:'5',P29:'2.5',L23:'0',D8:'50',P3:'58',D6:'100',L4:'18',L5:'18',L6:false,L7:'0.95',L8:'0.95',P12:'17',P13:'6',P16:'2',P17:'0.5',P21:'1600'}
const zigSwitches={D14:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ'] as const},D15:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ'] as const},D16:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ'] as const},D17:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ'] as const}}

function bool(value:unknown):boolean{return /^(1|true|да)$/i.test(String(value))}
function shown(value:ExactRational,places:number):string{const n=BigInt(value.numerator),d=BigInt(value.denominator),scale=10n**BigInt(places),abs=n<0n?-n:n,scaled=abs*scale;let q=scaled/d;if((scaled%d)*2n>=d)q++;let text=q.toString().padStart(places+1,'0');if(places)text=`${text.slice(0,-places)}.${text.slice(-places)}`;const[whole,fraction='']=text.split('.');return `${n<0n?'-':''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')}${places?`,${fraction}`:''}`}
function normalize(value:unknown):string{return String(value??'').replace(/[\s\u00a0\u202f]/g,'').replace(',','.')}
function places(cell:any):number{return /[.,](0+|#+)/.exec(cell?.numberFormat??'')?.[1].length??(/[.,](\d+)/.exec(cell?.displayedText??'')?.[1].length??0)}
function binary64(value:ExactRational):string{return Buffer.from(new Float64Array([Number(value.numerator)/Number(value.denominator)]).buffer).readBigUInt64LE().toString(16).padStart(16,'0').toUpperCase()}
function matchesDisplay(value:ExactRational,cell:any):boolean{if(cell?.binary64&&binary64(value)===String(cell.binary64).toUpperCase())return true;const expected=cell?.displayedText||shown(rationalFromDecimal(String(cell?.value)),places(cell));return !!cell?.numberFormat&&normalize(shown(value,places(cell)))===normalize(expected)}
function baseline(profile:'COMPLETATION'|'RETAIL'){return lineCommercial.find((x:any)=>x.profile===profile&&x.scenarioId==='line_single_no_park')}

function buildOrder(record:any){
 const profile=record.profile as 'COMPLETATION'|'RETAIL',lineBase=baseline(profile)
 const linePrice=linePrices.find((x:any)=>x.profile===profile),glass=lineGlasses.find((x:any)=>x.profile===profile),paint=linePaints.find((x:any)=>x.profile===profile),zig=zigPrices.find(x=>x.profile===profile)!
 const settings:LineEngineSettings={...lineBase.settings,P19:glass.settings.P19,L17:glass.settings.L17,L18:glass.settings.L18,L21:bool(glass.settings.L21),L22:glass.settings.L22,D32:bool(record.settings.D32.value)}
 const positions:MixedOrderPositionInput[]=record.positions.map((item:any)=>{
  if(item.family==='LINE'){
   const raw=lineBase.input,calc:LineEngineInputs={...Object.fromEntries(Object.entries(raw).filter(([key])=>!['constructionQuantity','widthMm','heightMm','leaves','mainLeavesSelector','sideCount','direction','glassSelectionIndex','finishSelectionIndex','commercialModeIndex','assemblyEnabled','millingEnabled','installationEnabled'].includes(key)).map(([key,value])=>[key,typeof value==='string'&&/^\d/.test(value)?decimalString(value):value])) as any,constructionId:item.id,constructionQuantity:decimalString(String(item.quantity)),widthMm:decimalString(String(item.widthMm)),heightMm:decimalString(String(item.heightMm)),leaves:decimalString(String(item.main.L.value)),mainLeavesSelector:decimalString(String(item.main.L.value)),sideCount:decimalString(String(item.main.K.value)),direction:item.main.J.value==='1'?'НАЛЕВО':item.main.J.value==='2'?'НАПРАВО':'ДВУХСТОР',glassSelectionIndex:Number(item.main.I.value),finishSelectionIndex:Number(item.main.H.value),commercialModeIndex:Number(record.orderSettings.F28.value),profile,workbook:linePrice.workbook,assemblyEnabled:bool(record.settings.D33.value),millingEnabled:bool(record.settings.L3.value),installationEnabled:bool(record.settings.D34.value)}
   return {id:item.id,slot:item.slot,family:'LINE',calculation:calc}
  }
  const geometry={widthMm:String(item.widthMm),heightMm:String(item.heightMm),leafSelector:String(item.main.L.value),openingSelector:Number(item.main.J.value),frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'] as const,settings:zigSettings,switches:zigSwitches}
  return {id:item.id,slot:item.slot,family:'ZIGZAG',quantity:String(item.quantity),geometry,commercial:{c8:String(item.main.H.value),F28:Number(record.orderSettings.F28.value) as 1|2,D32:bool(record.settings.D32.value),D33:bool(record.settings.D33.value),D34:bool(record.settings.D34.value),L3:bool(record.settings.L3.value),glassTypeSelector:Number(item.main.I.value)}}
 })
 const input={orderId:record.scenarioId,positions,lineSettings:settings,linePriceSnapshot:linePrice,glassSnapshot:glass,paintSnapshot:paint,zigzagSnapshot:zig}
 return {record,input,result:calculateMixedOrder(input)}
}

test('mixed Excel fixture rebuilds common glue packs, weighted slot allocation and complete end prices for both profiles',()=>{
 for(const record of captured.cases){
  const {result}=buildOrder(record)
  assert.equal(result.status,'COMPLETE',`${record.profile}/${record.scenarioId}: ${result.diagnostics.join('; ')}`)
  assert.equal(result.positions.length,record.positions.length)
  assert.equal(result.specification.length>0,true)
  assert.ok(result.totalSalePrice)
  assert.ok(matchesDisplay(result.allocation.activatorPackages!,record.glue.N12),`${record.profile}/${record.scenarioId} N12`)
  assert.ok(matchesDisplay(result.allocation.adhesivePackages!,record.glue.N25),`${record.profile}/${record.scenarioId} N25`)
  assert.ok(matchesDisplay(result.allocation.adhesiveFactors!.O5,record.glue.O5),`${record.profile}/${record.scenarioId} O5`)
  assert.ok(matchesDisplay(result.allocation.adhesiveFactors!.O18,record.glue.O18),`${record.profile}/${record.scenarioId} O18`)
  for(const item of record.positions){
   const actual=result.positions.find(x=>x.id===item.id)!,allocation=result.allocation.systemAllocations!.find(x=>x.positionId===item.id)!
   assert.equal(actual.status,'COMPLETE');assert.ok(actual.unitSalePrice);assert.ok(actual.extendedSalePrice)
   const sourceRow=24+item.slot
   assert.ok(matchesDisplay(allocation.W,record.prm[`AB${sourceRow}`]),`${record.profile}/${record.scenarioId} AB${sourceRow}/W`)
   const area=divideRational(multiplyRational(multiplyRational(rationalFromDecimal(String(item.widthMm)),rationalFromDecimal(String(item.heightMm))),rationalFromDecimal(String(item.quantity))),rationalFromDecimal('1000000'))
   const excelArea=rationalFromDecimal(record.prm[`AA${sourceRow}`].value)
   assert.ok(matchesDisplay(area,record.prm[`AA${sourceRow}`]),`${record.profile}/${record.scenarioId} AA${sourceRow}`)
   assert.ok(BigInt(excelArea.numerator)>0n)
   assert.ok(result.trace.some(step=>step.id===`JV.MIXED.ORDER.Y.${item.id}`))
  }
  for(const item of record.positions){
   const actual=result.positions.find(x=>x.id===item.id)!
   if(item.family==='LINE')assert.ok(matchesDisplay(actual.lineCalculation!.commercial.q58 as ExactRational,item.cells.Q58),`${record.profile}/${record.scenarioId} L${item.slot}!Q58`)
   else for(const cell of ['P38','P39','P40','P41','P42','P43','P44'] as const)assert.ok(matchesDisplay(actual.zigzagCalculation!.costs![cell]!,item.cells[cell]),`${record.profile}/${record.scenarioId} Z${item.slot}!${cell}`)
   assert.ok(matchesDisplay(actual.unitSalePrice!,item.main.Y),`${record.profile}/${record.scenarioId} Main!Y${10+item.slot}: engine=${shown(actual.unitSalePrice!,places(item.main.Y))}, Excel=${item.main.Y.displayedText}, base=${JSON.stringify(actual.baseUnitSalePrice)}`)
  }
  assert.ok(matchesDisplay(result.totalSalePrice!,record.orderTotal),`${record.profile}/${record.scenarioId} order aggregate`)
  assert.ok(result.trace.some(step=>step.source?.sheet==='Клей+акт'&&step.source.cell==='N12'&&step.inputRefs.includes('slot-1')&&step.inputRefs.includes('slot-2')))
  assert.equal(JSON.stringify(result.trace).includes('undefined'),false)
 }
})

test('mixed specification preserves family, position provenance, exact counts, units, and catalog versions',()=>{
 const {record,result}=buildOrder(captured.cases.find(x=>x.profile==='COMPLETATION'&&x.scenarioId==='line_plus_zigzag_multiple_instances'))
 assert.equal(result.specification.some(x=>x.family==='LINE'&&x.sourcePositionId==='slot-1'),true)
 assert.equal(result.specification.some(x=>x.family==='ZIGZAG'&&x.sourcePositionId==='slot-2'),true)
 for(const row of result.specification){assert.ok(row.sku);assert.ok(row.description);assert.ok(row.unit);assert.ok(row.catalogVersion);assert.ok(row.traceStepId);assert.equal(row.profile,record.profile);assert.ok(BigInt(row.quantity.numerator)>=0n);assert.ok(row.unitPrice);assert.ok(row.amount)}
 const lineGlue=result.specification.find(x=>x.sourcePositionId==='slot-1'&&x.sku==='AA-110')!
 const zigGlue=result.specification.find(x=>x.sourcePositionId==='slot-2'&&x.sku===result.positions.find(x=>x.id==='slot-2')?.zigzagCalculation?.materialCost?.positions.find(p=>p.bomRow===35)?.sku)
 assert.ok(lineGlue);assert.deepEqual(lineGlue.quantity,rationalFromDecimal('0.712'));assert.ok(zigGlue)
 assert.equal(result.trace.filter(x=>x.id==='JV.ZIGZAG.ORDER.GLUE.N12').length,1)
})

test('mixed orders reject duplicate slots and inconsistent F28, and preserve PARTIAL without a total after a Line Q58 guard failure',()=>{
 const record=captured.cases[0],{input,result}=buildOrder(record)
 assert.equal(result.status,'COMPLETE')
 const duplicate=()=>calculateMixedOrder({...input,positions:[input.positions[0]!,{...input.positions[1]!,slot:input.positions[0]!.slot}]})
 assert.throws(duplicate,/unique Excel slot/)
 const conflict=input.positions.map((position)=>position.family==='ZIGZAG'?{...position,commercial:{...position.commercial,F28:2 as const}}:position)
 assert.throws(()=>calculateMixedOrder({...input,positions:conflict}),/same order-level Главная!F28/)
 const guarded=input.positions.map((position)=>position.family==='LINE'?{...position,calculation:{...position.calculation,sideCount:decimalString('3')}}:position)
 const partial=calculateMixedOrder({...input,positions:guarded})
 assert.equal(partial.status,'PARTIAL');assert.equal(partial.totalSalePrice,undefined)
 assert.equal(partial.positions.find(x=>x.family==='LINE')?.status,'PARTIAL')
})
