import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { EngineError } from '../errors.ts'
import { addRational, multiplyRational, rationalFromDecimal, rationalToDecimalExact, type ExactRational } from '../rational.ts'
import { calculateZigzagOrder } from './order-calculation.ts'
import type { ZigzagPriceSnapshotInput } from './pricing.ts'

const snapshots=JSON.parse(await readFile(resolve(process.cwd(),'../../docs/jv/fixtures/zigzag-price-snapshots.json'),'utf8')) as {sources:ZigzagPriceSnapshotInput[]}
const excel=JSON.parse(await readFile(resolve(process.cwd(),'../../docs/jv/fixtures/zigzag-order-pr10g-excel.json'),'utf8')) as {cases:any[]}
const settings={P4:'14',P24:'42',P25:'51',P26:'6.5',P27:'5.7',P28:'5',P29:'2.5',L23:'0',D8:'50',P3:'58',D6:'100',L4:'18',L5:'18',L6:false,L7:'0.95',L8:'0.95',P12:'17',P13:'6',P16:'2',P17:'0.5',P21:'1600'}
const switches={D14:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ'] as const},D15:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ'] as const},D16:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ'] as const},D17:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ'] as const}}
function scenario(profile:'COMPLETATION'|'RETAIL',id:string){const source=excel.cases.find((item)=>item.profile===profile&&item.id===id)!;const snapshot=snapshots.sources.find((item)=>item.profile===profile)!;const positions=source.positions.map((record:any)=>({id:`slot${record.slot-10}`,slot:record.slot-10,family:'ZIGZAG' as const,quantity:String(record.inputs.quantity),geometry:{widthMm:String(record.inputs.width),heightMm:String(record.inputs.height),leafSelector:String(record.inputs.leaves),openingSelector:record.inputs.opening,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'] as const,settings,switches},commercial:{c8:String(record.inputs.c8),F28:source.inputs.F28 as 1|2,D32:source.inputs.D32===1,D33:source.inputs.D33===1,D34:source.inputs.D34===1,L3:source.inputs.L3===1,glassTypeSelector:record.inputs.glass,N40:String(record.inputs.n40),N41:String(record.inputs.n41)}}));return {source,snapshot,result:calculateZigzagOrder({orderId:id,snapshot,positions})}}
function shown(value:ExactRational,places:number){const n=BigInt(value.numerator),d=BigInt(value.denominator),scale=10n**BigInt(places),abs=n<0n?-n:n,scaled=abs*scale;let q=scaled/d;if((scaled%d)*2n>=d)q++;let text=q.toString().padStart(places+1,'0');if(places)text=`${text.slice(0,-places)}.${text.slice(-places)}`;const [whole,fraction='']=text.split('.');return `${n<0n?'-':''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')}${places?`,${fraction}`:''}`}
function normalized(text:string){return text.replace(/[\s\u00a0\u202f]/g,'').replace('.',',')}

test('multi-position Zigzag order closes shared packages, weighted W, per-position P44, Sslot and quantity extension for both profiles',()=>{
 for(const profile of ['COMPLETATION','RETAIL'] as const){
  const {source,result}=scenario(profile,'two_zigzag_active_glass_c8_four')
  assert.equal(result.status,'COMPLETE');assert.equal(result.positions.length,2);assert.ok(result.totalSalePrice)
  assert.equal(rationalToDecimalExact(result.allocation.activatorPackages!),source.glue.N12.value)
  assert.equal(rationalToDecimalExact(result.allocation.adhesivePackages!),source.glue.N25.value)
  assert.equal(normalized(shown(result.allocation.adhesiveFactors!.O5,3)),normalized(source.glue.O5.displayedText))
  assert.equal(normalized(shown(result.allocation.adhesiveFactors!.O18,3)),normalized(source.glue.O18.displayedText))
  for(const row of [34,35]){const total=result.positions.reduce((sum,position)=>addRational(sum,multiplyRational(position.materialCost!.positions.find((line)=>line.bomRow===row)!.amount!,position.quantity)),rationalFromDecimal('0'));const price=result.positions[0].materialCost!.positions.find((line)=>line.bomRow===row)!.unitPrice,packages=row===34?result.allocation.activatorPackages!:result.allocation.adhesivePackages!;assert.deepEqual(total,multiplyRational(multiplyRational(price,packages),rationalFromDecimal('1')))}
  for(const position of result.positions){
   const excelPosition=source.positions.find((x:any)=>x.slot===position.slot+10)!,costs=position.costs!
   assert.equal(position.status,'COMPLETE')
   for(const cell of ['P38','P39','P40','P41','P42','P43','P44'] as const){const raw=excelPosition.cells[cell];assert.ok(costs[cell]);assert.equal(normalized(shown(costs[cell]!,2)),normalized(raw.displayedText),`${profile} ${cell} position ${position.slot}`)}
   assert.equal(normalized(shown(position.unitSalePrice!,0)),normalized(Number(source.main[`S${position.slot+10}`].value).toFixed(0)))
   assert.equal(normalized(shown(result.allocation.systemAllocations!.find((x)=>x.positionId===position.id)!.W,3)),normalized(source.positions.find((x:any)=>x.slot===position.slot+10)!.cells.W5.displayedText))
   assert.equal(normalized(shown(position.extendedSalePrice!,0)),normalized(String((Number(source.main[`S${position.slot+10}`].value)*Number(source.main[`Z${position.slot+10}`].value)).toFixed(0))))
   assert.ok(position.trace.some((step)=>step.id==='JV.ZIGZAG.COST.P44'))
   assert.ok(position.trace.filter((step)=>step.catalogRefs.length).every((step)=>step.catalogRefs.some((ref)=>ref.version===result.positions[0].materialCost!.priceSnapshotVersion)))
   assert.doesNotThrow(()=>JSON.stringify(position.trace))
  }
  assert.equal(normalized(shown(result.totalSalePrice,0)),normalized(Number(source.derivedOrderSumCell.value).toFixed(0)))
 }
})

test('minimum and multi-package scenarios allocate shared adhesive once and never charge each construction a separate minimum',()=>{
 for(const profile of ['COMPLETATION','RETAIL'] as const){
  const minimum=scenario(profile,'two_zigzag_minimum_packages'),bulk=scenario(profile,'two_zigzag_multiple_packages')
  assert.equal(minimum.result.status,'COMPLETE');assert.equal(rationalToDecimalExact(minimum.result.allocation.activatorPackages!),minimum.source.glue.N12.value);assert.equal(minimum.source.glue.N12.value,'1')
  assert.equal(bulk.result.status,'COMPLETE');assert.equal(rationalToDecimalExact(bulk.result.allocation.activatorPackages!),bulk.source.glue.N12.value);assert.equal(bulk.source.glue.N12.value,'4')
  const x=bulk.result.positions[0]!,ex=bulk.source.positions.find((p:any)=>p.slot===11)!
  assert.equal(normalized(shown(x.costs!.P38!,2)),normalized(ex.cells.P38.displayedText));assert.equal(normalized(shown(x.costs!.P44!,2)),normalized(ex.cells.P44.displayedText))
  assert.equal(bulk.result.totalSalePrice!==undefined,true)
 }
})

test('C8=4 uses explicit N40/N41 and reproduces U11:U18 and P39 for both source profiles',()=>{
 for(const profile of ['COMPLETATION','RETAIL'] as const){const {source,result}=scenario(profile,'two_zigzag_active_glass_c8_four'),position=result.positions[0]!,raw=source.positions[0].cells
  for(const cell of ['U10','U11','U12','U13','U14','U15','U17','U18','P39'] as const){const trace=position.trace.find((step)=>step.source?.cell===cell);assert.ok(trace,`trace must identify ${cell}`)}
  assert.equal(normalized(shown(position.costs!.P39!,2)),normalized(raw.P39.displayedText));assert.equal(raw.N40.value,'2');assert.equal(raw.N41.value,'3')
 }
})

test('active glass is evaluated and compared with Excel; disabled glass is zero while remaining geometry cells are retained',()=>{
 for(const profile of ['COMPLETATION','RETAIL'] as const){const {source,result}=scenario(profile,'two_zigzag_active_glass_c8_four');const position=result.positions[0]!,raw=source.positions[0].cells
  assert.equal(normalized(shown(position.costs!.P40!,2)),normalized(raw.P40.displayedText));assert.notEqual(raw.H23.value,'ОШИБКА');assert.equal(raw.H29.value!==null,true)
  const disabled=scenario(profile,'two_zigzag_minimum_packages');assert.deepEqual(disabled.result.positions[0].costs!.P40,{numerator:'0',denominator:'1'})
 }
})

test('active glass preserves the Excel H23/C29/H29/P40 failure and blocks P44 instead of returning zero',()=>{
 for(const profile of ['COMPLETATION','RETAIL'] as const){const {source,result}=scenario(profile,'active_glass_guard_error'),position=result.positions[0]!,raw=source.positions[0].cells
  assert.equal(raw.H23.value,'ОШИБКА');assert.equal(raw.C29.value,'ОШИБКА');assert.equal(raw.H29.value,'-2146826273');assert.equal(raw.P40.displayedText,'#ЗНАЧ!')
  assert.equal(result.status,'PARTIAL');assert.equal(position.costs?.P40,undefined);assert.equal(position.costs?.P44,undefined);assert.ok(position.diagnostics.some((x)=>x.includes('Z1!H23="ОШИБКА"')))
 }
})

test('missing manual P39 inputs and unsupported mixed families block full totals with explicit diagnostics',()=>{
 const base=scenario('RETAIL','two_zigzag_active_glass_c8_four'),positions=(base.result.positions)
 assert.equal(positions[0]?.status,'COMPLETE')
 const input=base.source.positions.map((record:any)=>({id:`slot${record.slot-10}`,slot:record.slot-10,family:'ZIGZAG' as const,quantity:String(record.inputs.quantity),geometry:{widthMm:String(record.inputs.width),heightMm:String(record.inputs.height),leafSelector:String(record.inputs.leaves),openingSelector:record.inputs.opening,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'] as const,settings,switches},commercial:{c8:String(record.inputs.c8),F28:2 as const,D32:true,D33:true,D34:true,L3:true,glassTypeSelector:record.inputs.glass}}))
 const noN40=calculateZigzagOrder({orderId:'missing-manual-inputs',snapshot:base.snapshot,positions:input});assert.equal(noN40.status,'PARTIAL');assert.ok(noN40.positions[0].missingDependencies.includes('Z1!N40'))
 const mixed=calculateZigzagOrder({orderId:'mixed-family',snapshot:base.snapshot,positions:[...input,{id:'line',slot:3,family:'OTHER',quantity:'1'}]});assert.equal(mixed.status,'PARTIAL');assert.equal(mixed.totalSalePrice,undefined);assert.ok(mixed.diagnostics.some((x)=>x.includes('other families')))
 const inconsistent=input.map((position,index)=>index===1?{...position,commercial:{...position.commercial,F28:1 as const}}:position)
 assert.throws(()=>calculateZigzagOrder({orderId:'conflicting-global-settings',snapshot:base.snapshot,positions:inconsistent}),(error)=>error instanceof EngineError&&error.code==='INVALID_CONFIGURATION')
})
