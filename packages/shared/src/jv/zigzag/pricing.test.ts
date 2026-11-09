import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { EngineError } from '../errors.ts'
import { divideRational, multiplyRational, rationalFromDecimal, roundRationalAwayFromZero } from '../rational.ts'
import { calculateZigzagGeometry } from './geometry.ts'
import { calculateZigzagBaseMaterialQuantities } from './material-quantities.ts'
import { calculateZigzagOrderAdhesiveAllocation } from './order-allocation.ts'
import { calculateZigzagP39, calculateZigzagP40, calculateZigzagP41, calculateZigzagP43, calculateZigzagCommercialPrice } from './commercial-cost.ts'
import { buildZigzagPriceSnapshot, calculateZigzagMaterialCost, type ZigzagPriceSnapshotInput } from './pricing.ts'

const fixture=JSON.parse(await readFile(resolve(process.cwd(),'../../docs/jv/fixtures/zigzag-price-snapshots.json'),'utf8')) as {sources:ZigzagPriceSnapshotInput[]}
const excelPriceFixture=JSON.parse(await readFile(resolve(process.cwd(),'../../docs/jv/fixtures/zigzag-pricing-excel.json'),'utf8')) as {cases:Array<any>}
const excelGeometryFixture=JSON.parse(await readFile(resolve(process.cwd(),'../../docs/jv/fixtures/zigzag-geometry-excel.json'),'utf8')) as {cases:Array<any>}
const geometrySettings={P4:'14',P24:'42',P25:'51',P26:'6.5',P27:'5.7',P28:'5',P29:'2.5',L23:'0',D8:'50',P3:'58',D6:'100',L4:'18',L5:'18',L6:false,L7:'0.95',L8:'0.95',P12:'17',P13:'6',P16:'2',P17:'0.5',P21:'1600'}
const switches={D14:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ'] as const},D15:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ'] as const},D16:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ'] as const},D17:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ'] as const}}
function bom(width='3600',height='2400',leaves='4',opening=2){
 const geometry=calculateZigzagGeometry({widthMm:width,heightMm:height,leafSelector:leaves,openingSelector:opening,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:geometrySettings,switches})
 return calculateZigzagBaseMaterialQuantities(geometry)
}
function snapshot(profile:'COMPLETATION'|'RETAIL'){return buildZigzagPriceSnapshot(fixture.sources.find((item)=>item.profile===profile)!)}
function allocation(materialBom:ReturnType<typeof bom>,priceSnapshot:ReturnType<typeof snapshot>,quantity='1'){
 return calculateZigzagOrderAdhesiveAllocation({orderId:'test-zigzag-order',workbook:priceSnapshot.workbook,positions:[{id:'z1',family:'ZIGZAG',quantity:rationalFromDecimal(quantity),activatorPerConstruction:materialBom.exactQuantities[34],adhesivePerConstruction:materialBom.exactQuantities[35],widthMm:rationalFromDecimal(materialBom.exactQuantities[5].numerator==='0'?'1':'3600'),heightMm:rationalFromDecimal('2400')}]})
}
function formatRational(value:{numerator:string;denominator:string},places:number){const n=BigInt(value.numerator),d=BigInt(value.denominator),scale=10n**BigInt(places),abs=n<0n?-n:n,scaled=abs*scale;let q=scaled/d;if((scaled%d)*2n>=d)q++;let text=q.toString().padStart(places+1,'0');if(places)text=`${text.slice(0,-places)}.${text.slice(-places)}`;const [whole,fraction='']=text.split('.');return `${n<0n?'-':''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')}${places?`,${fraction}`:''}`}

test('COM and RETAIL use separate verified raw-price snapshots for all 31 Zigzag catalog positions',()=>{
 for(const profile of ['COMPLETATION','RETAIL'] as const){
  const price=snapshot(profile),materialBom=bom(),order=allocation(materialBom,price)
  const result=calculateZigzagMaterialCost({bom:materialBom,snapshot:price,profile,orderAllocation:order})
  assert.equal(price.entries.length,31);assert.equal(result.positions.length,31);assert.equal(result.status,'COMPLETE');assert.ok(result.p38)
  assert.equal(price.entries[0].sourceCell,"'Прайс-Line'!E5")
  assert.equal(result.positions.find((line)=>line.bomRow===9)?.sku,'LN-060')
  const row31=result.positions.find((line)=>line.bomRow===31)!
  assert.deepEqual(row31.quantity,materialBom.exactQuantities[31])
  assert.deepEqual(row31.amount,multiplyRational(materialBom.exactQuantities[31],divideRational(rationalFromDecimal(price.entries.find((entry)=>entry.bomRow===31)!.price),rationalFromDecimal('0.95'))))
  assert.ok(result.trace.find((step)=>step.id==='JV.ZIGZAG.COST.P31'))
 }
 assert.notEqual(snapshot('COMPLETATION').entries[0].price,snapshot('RETAIL').entries[0].price)
})

test('Zigzag cost never converts missing price or adhesive order factors to zero or publishes an incomplete P38',()=>{
 const profile='COMPLETATION',full=snapshot(profile),materialBom=bom()
 const noGlue=calculateZigzagMaterialCost({bom:materialBom,snapshot:full,profile})
 assert.equal(noGlue.status,'PARTIAL');assert.equal(noGlue.p38,undefined)
 assert.ok(noGlue.unsupportedPositions.some((position)=>position.reason==='ORDER_FACTOR_REQUIRED'&&position.bomRow===34))
 const noPrice=buildZigzagPriceSnapshot({...fixture.sources[0]!,entries:fixture.sources[0]!.entries.filter((entry)=>entry.bomRow!==31)})
 const partial=calculateZigzagMaterialCost({bom:materialBom,snapshot:noPrice,profile,orderAllocation:allocation(materialBom,full)})
 assert.equal(partial.status,'PARTIAL');assert.equal(partial.p38,undefined)
 assert.ok(partial.unsupportedPositions.some((position)=>position.reason==='PRICE_NOT_FOUND'&&position.bomRow===31))
})

test('Zigzag snapshot rejects bad catalog units, formula mapping, and the wrong price profile',()=>{
 const source=fixture.sources[0]!
 assert.throws(()=>buildZigzagPriceSnapshot({...source,entries:source.entries.map((entry)=>entry.bomRow===5?{...entry,excelUnit:'шт.'}:entry)}),(error)=>error instanceof EngineError&&error.code==='UNIT_MISMATCH')
 assert.throws(()=>buildZigzagPriceSnapshot({...source,entries:source.entries.map((entry)=>entry.bomRow===5?{...entry,sourceCell:"'Прайс-Line'!E6"}:entry)}),(error)=>error instanceof EngineError&&error.code==='RULE_UNCONFIRMED')
 const complete=snapshot('COMPLETATION'),materialBom=bom()
 assert.throws(()=>calculateZigzagMaterialCost({bom:materialBom,snapshot:complete,profile:'RETAIL'}),(error)=>error instanceof EngineError&&error.code==='INVALID_CONFIGURATION')
})

test('Zigzag order adhesive package minima apply once across one or several constructions and mixed orders remain partial',()=>{
 const price=snapshot('COMPLETATION'),one=bom()
 const single=allocation(one,price)
 assert.deepEqual(single.activatorPackages,{numerator:'1',denominator:'1'})
 assert.deepEqual(single.adhesiveFactors?.O5,{numerator:'5',denominator:'2'})
 const multiple=calculateZigzagOrderAdhesiveAllocation({orderId:'multi',workbook:price.workbook,positions:[1,2].map((x)=>({id:`z${x}`,family:'ZIGZAG' as const,quantity:rationalFromDecimal('1'),activatorPerConstruction:one.exactQuantities[34],adhesivePerConstruction:one.exactQuantities[35]}))})
 assert.deepEqual(multiple.totalActivatorConsumption,{numerator:'4',denominator:'5'})
 assert.deepEqual(multiple.adhesiveFactors?.O18,{numerator:'5',denominator:'4'})
 const mixed=calculateZigzagOrderAdhesiveAllocation({orderId:'mixed',workbook:price.workbook,positions:[{id:'z1',family:'ZIGZAG',quantity:rationalFromDecimal('1'),activatorPerConstruction:one.exactQuantities[34],adhesivePerConstruction:one.exactQuantities[35]},{id:'other',family:'OTHER',quantity:rationalFromDecimal('1')}]})
 assert.equal(mixed.status,'PARTIAL');assert.equal(mixed.adhesiveFactors,undefined);assert.deepEqual(mixed.unsupportedPositions,['other'])
})

test('single-construction Excel-rebuild scenario closes P39:P44 without importing cached outputs',()=>{
 for(const profile of ['COMPLETATION','RETAIL'] as const){
  const excel=excelPriceFixture.cases.find((item)=>item.profile===profile&&item.id==='single_3600x2400_4leaf')!
  const geometryCase=excelGeometryFixture.cases.find((item)=>item.profile===profile&&item.id==='zigzag_yes_3600x2400_4leaf')!
  const price=snapshot(profile),calculatedGeometry=calculateZigzagGeometry({...geometryCase.inputs,settings:geometryCase.settings,switches:geometryCase.inputs.switches})
  const materialBom=calculateZigzagBaseMaterialQuantities(calculatedGeometry)
  const order=calculateZigzagOrderAdhesiveAllocation({orderId:'parity-single',workbook:price.workbook,positions:[{id:'slot1',family:'ZIGZAG',quantity:rationalFromDecimal('1'),activatorPerConstruction:materialBom.exactQuantities[34],adhesivePerConstruction:materialBom.exactQuantities[35],widthMm:rationalFromDecimal('3600'),heightMm:rationalFromDecimal('2400')}]})
  const material=calculateZigzagMaterialCost({bom:materialBom,snapshot:price,profile,orderAllocation:order})
  const p39=calculateZigzagP39({workbook:price.workbook,geometry:calculatedGeometry,bom:materialBom,snapshot:price,allocation:order,slotId:'slot1',c8:excel.cells.C8.value,N40:'0',N41:'0'})
  const p40=calculateZigzagP40({workbook:price.workbook,enabled:excel.sources.settings.D32.value==='1',geometry:calculatedGeometry,snapshot:price,allocation:order,slotId:'slot1',glassTypeSelector:Number(excel.sources.main.I11.value)})
  const p41=calculateZigzagP41({workbook:price.workbook,assemblyEnabled:excel.sources.settings.D33.value==='1',l3Enabled:excel.sources.settings.L3.value==='1',widthMm:'3600',exactN10:materialBom.exactQuantities[10],snapshot:price})
  const p43=calculateZigzagP43({workbook:price.workbook,enabled:excel.sources.settings.D34.value==='1',widthMm:'3600',heightMm:'2400',leafCount:4,snapshot:price})
  assert.equal(p39.value!==undefined,true);assert.equal(p40.value!==undefined,true)
  const commercial=calculateZigzagCommercialPrice({workbook:price.workbook,materialCost:material,p39:p39.value,p40:p40.value,p41:p41.value,p43:p43.value,F28:Number(excel.sources.main.F28.value) as 1|2,snapshot:price,allocation:order,slotId:'slot1'})
  assert.equal(commercial.status,'COMPLETE');assert.ok(commercial.p44)
  for(const [cell,value] of [['P38',material.p38!],['P39',p39.value!],['P40',p40.value!],['P41',p41.value!],['P42',commercial.p42!],['P43',p43.value],['P44',commercial.p44!]] as const){
   const displayed=formatRational(value,2)
   assert.equal(displayed.replaceAll(' ',''),excel.cells[cell].displayedText.replace(/[\s\u00a0\u202f]/g,'').replace('.',','),`${profile} ${cell} should match Excel display`)
  }
 }
})

test('mixed-size Zigzag positions share one order adhesive package factor and allocate W by area',()=>{
 for(const profile of ['COMPLETATION','RETAIL'] as const){
  const excel=excelPriceFixture.cases.find((item)=>item.profile===profile&&item.id==='two_positions_4200x2500_5leaf')!
  const price=snapshot(profile),firstGeometryCase=excelGeometryFixture.cases.find((item)=>item.profile===profile&&item.id==='zigzag_yes_4200x2500_5leaf')!,secondGeometryCase=excelGeometryFixture.cases.find((item)=>item.profile===profile&&item.id==='zigzag_yes_3600x2400_4leaf')!
  const firstGeometry=calculateZigzagGeometry({...firstGeometryCase.inputs,settings:firstGeometryCase.settings,switches:firstGeometryCase.inputs.switches}),secondGeometry=calculateZigzagGeometry({...secondGeometryCase.inputs,settings:secondGeometryCase.settings,switches:secondGeometryCase.inputs.switches})
  const firstBom=calculateZigzagBaseMaterialQuantities(firstGeometry),secondBom=calculateZigzagBaseMaterialQuantities(secondGeometry)
  const order=calculateZigzagOrderAdhesiveAllocation({orderId:'two-zigzag',workbook:price.workbook,positions:[{id:'slot1',family:'ZIGZAG',quantity:rationalFromDecimal('1'),activatorPerConstruction:firstBom.exactQuantities[34],adhesivePerConstruction:firstBom.exactQuantities[35],widthMm:rationalFromDecimal('4200'),heightMm:rationalFromDecimal('2500')},{id:'slot2',family:'ZIGZAG',quantity:rationalFromDecimal('2'),activatorPerConstruction:secondBom.exactQuantities[34],adhesivePerConstruction:secondBom.exactQuantities[35],widthMm:rationalFromDecimal('3600'),heightMm:rationalFromDecimal('2400')}]})
  assert.deepEqual(order.totalActivatorConsumption,{numerator:'1267',denominator:'1000'});assert.deepEqual(order.activatorPackages,{numerator:'2',denominator:'1'});assert.deepEqual(order.adhesiveFactors?.O5,{numerator:'2000',denominator:'1267'})
  assert.deepEqual(order.systemAllocations?.map((item)=>item.W),[{numerator:'175',denominator:'463'},{numerator:'144',denominator:'463'}])
  assert.equal(roundRationalAwayFromZero(order.adhesiveFactors!.O5,3).replace('.',','),excel.sources.glue.O5.displayedText)
  const firstCost=calculateZigzagMaterialCost({bom:firstBom,snapshot:price,profile,orderAllocation:order}),secondCost=calculateZigzagMaterialCost({bom:secondBom,snapshot:price,profile,orderAllocation:order})
  for(const [line,cell] of [[firstCost.positions.find((item)=>item.bomRow===34)!,excel.cells.P34],[firstCost.positions.find((item)=>item.bomRow===35)!,excel.cells.P35],[secondCost.positions.find((item)=>item.bomRow===34)!,excel.slot2Cells.P34],[secondCost.positions.find((item)=>item.bomRow===35)!,excel.slot2Cells.P35]]){
   const displayed=formatRational(line.amount!,2)
   assert.equal(displayed.replaceAll(' ',''),cell.displayedText.replace(/[\s\u00a0\u202f]/g,'').replace('.',','),`${profile} ${line.sourceCell} must match Excel's displayed price`)
  }
 }
})

test('P39 lazy zero branch and C8=4 multiplier are explicit; blank N40/N41 are not silently invented',()=>{
 const price=snapshot('RETAIL'),materialBom=bom(),order=allocation(materialBom,price)
 const zero=calculateZigzagP39({workbook:price.workbook,geometry:calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:geometrySettings,switches}),bom:materialBom,snapshot:price,allocation:order,slotId:'z1',c8:'1'})
 assert.deepEqual(zero.value,{numerator:'0',denominator:'1'})
 const missing=calculateZigzagP39({workbook:price.workbook,geometry:calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:geometrySettings,switches}),bom:materialBom,snapshot:price,allocation:order,slotId:'z1',c8:'4'})
 assert.equal(missing.value,undefined);assert.deepEqual(missing.missingDependencies,['Z1!N40','Z1!N41'])
 const geometry=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:geometrySettings,switches})
 const regular=calculateZigzagP39({workbook:price.workbook,geometry,bom:materialBom,snapshot:price,allocation:order,slotId:'z1',c8:'4',N40:'0',N41:'0'})
 const adjustedSnapshot=buildZigzagPriceSnapshot({...fixture.sources.find(x=>x.profile==='RETAIL')!,settings:{...fixture.sources.find(x=>x.profile==='RETAIL')!.settings,L11:'2'}})
 const adjusted=calculateZigzagP39({workbook:price.workbook,geometry,bom:materialBom,snapshot:adjustedSnapshot,allocation:order,slotId:'z1',c8:'4',N40:'0',N41:'0'})
 assert.ok(regular.value);assert.ok(adjusted.value);assert.notDeepEqual(regular.value,adjusted.value)
})

test('P40, P41, and P43 preserve their independent switch branches and P44 requires a complete P38',()=>{
 const profile='COMPLETATION',price=snapshot(profile),materialBom=bom(),geometry=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:geometrySettings,switches}),order=allocation(materialBom,price)
 const off=calculateZigzagP40({workbook:price.workbook,enabled:false,geometry,snapshot:price,allocation:order,slotId:'z1'})
 assert.deepEqual(off.value,{numerator:'0',denominator:'1'})
 assert.equal(calculateZigzagP41({workbook:price.workbook,assemblyEnabled:true,l3Enabled:false,widthMm:'3600',exactN10:materialBom.exactQuantities[10],snapshot:price}).value.numerator,'5400')
 assert.equal(calculateZigzagP41({workbook:price.workbook,assemblyEnabled:false,l3Enabled:true,widthMm:'3600',exactN10:materialBom.exactQuantities[10],snapshot:price}).value.numerator,'800')
 assert.equal(calculateZigzagP41({workbook:price.workbook,assemblyEnabled:false,l3Enabled:false,widthMm:'3600',exactN10:materialBom.exactQuantities[10],snapshot:price}).value.numerator,'0')
 assert.equal(calculateZigzagP43({workbook:price.workbook,enabled:false,widthMm:'3600',heightMm:'2400',leafCount:4,snapshot:price}).value.numerator,'0')
 const material=calculateZigzagMaterialCost({bom:materialBom,snapshot:price,profile,orderAllocation:order})
 const blocked=calculateZigzagCommercialPrice({workbook:price.workbook,materialCost:{...material,p38:undefined,status:'PARTIAL'},p39:rationalFromDecimal('0'),p40:rationalFromDecimal('0'),p41:rationalFromDecimal('0'),p43:rationalFromDecimal('0'),F28:1,snapshot:price,allocation:order,slotId:'z1'})
 assert.equal(blocked.status,'PARTIAL');assert.equal(blocked.p44,undefined);assert.ok(blocked.missingDependencies.includes('Z1!P38 (all P5:P35 must be complete)'))
})
