import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculateSliderX3Commercial, buildSliderX3PriceSnapshot, type SliderX3CommercialInput, type SliderX3PriceSnapshot } from './l5-pricing.ts'
import { calculateSliderX3Geometry, type SliderX3GeometryInput } from './x3-geometry.ts'
import { rationalFromDecimal } from '../rational.ts'

const commercialCapture=JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/slider-pr11h-commercial-capture.json',import.meta.url),'utf8')) as any[]
const snapshotFile=JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/slider-x3-price-snapshots.json',import.meta.url),'utf8')) as {sources:any[]}
const selectorCapture=JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/slider-pr11a-selector-capture.json',import.meta.url),'utf8')) as any
const parityCapture=JSON.parse(readFileSync(new URL('../../../../../docs/jv/SLIDER_X3_PRICE_PARITY.json',import.meta.url),'utf8')) as any
const snapshots=new Map<string,SliderX3PriceSnapshot>(snapshotFile.sources.map(raw=>[raw.profile,buildSliderX3PriceSnapshot(raw)]))

function buildInput(record:any,includeOrder=true):SliderX3CommercialInput {
 assert.equal(record.cells.C12.formula,'=Главная!$I$11')
 assert.match(String(record.main.I11.formula),/^\d+$/)
 assert.equal(record.cells.C11.formula,'=Главная!$H$11')
 assert.match(String(record.main.H11.formula),/^\d+$/)
 const profile=record.profile,base=selectorCapture.scenarios.find((x:any)=>x.profile===profile&&x.inputs.F11===5),sv=base.settings.cells
 const geometry:SliderX3GeometryInput={workbook:record.workbook,systemSelector:5,widthMm:String(record.requestedInputs.C11),heightMm:String(record.requestedInputs.D11),leafCount:String(record.requestedInputs.M11),openingSelector:record.requestedInputs.J11,interlockState:record.cells.D17.value,meetingSealState:record.cells.D18.value,settings:{D8:String(sv.D8.value),S2:String(sv.S2.value),S3:String(sv.S3.value),S4:String(sv.S4.value),S6:String(sv.S6.value),S9:String(sv.S9.value),S10:String(sv.S10.value),S11:String(sv.S11.value),S12:String(sv.S12.value),S13:String(sv.S13.value),S14:String(sv.S14.value),S21:String(sv.S21.value),S23:String(sv.S23.value),L23:String(sv.L23.value),H25:Boolean(sv.H25.value)}}
 const orderPositions=[]
 for(let row=25;row<=31;row++){
  const mainRow=row-14,cell=record.prm
  assert.equal(cell[`U${row}`].formula,`=Главная!C${mainRow}`)
  assert.equal(cell[`V${row}`].formula,`=Главная!D${mainRow}`)
  assert.equal(cell[`W${row}`].formula,`=Главная!Z${mainRow}`)
  const source=record.mainOrderInputs,systemSelector=Number(source[`F${mainRow}`].formula)
  for(const column of ['C','D','F','Z'])assert.match(String(source[`${column}${mainRow}`].formula),/^[-+]?\d+(?:\.\d+)?$/)
  const sourceSheetBySelector:Record<number,'L1'|'L2'|'S1'|'S2'|'S3'|'S4'|'F1'>={1:'L1',2:'L2',3:'S1',4:'S1',5:'S1',6:'S1',7:'F1'}
  orderPositions.push({mainRow,widthMm:String(source[`C${mainRow}`].formula),heightMm:String(source[`D${mainRow}`].formula),quantity:String(source[`Z${mainRow}`].formula),systemSelector,sourceSheet:sourceSheetBySelector[systemSelector]})
 }
 return {geometry,bomOptions:{interlockEnabled:Boolean(record.settings.H21.value),fittingUpgradeEnabled:Boolean(record.settings.H23.value),jointPairSelection:record.cells.D22.value,selectorControls:{I25:Number(record.settings.I25.value),C20:Number(record.cells.C20.value),I29:Number(record.settings.I29.value),C24:Number(record.cells.C24.value),I31:Number(record.settings.I31.value),C26:Number(record.cells.C26.value)}},bomSettings:{D6:String(record.settings.D6.value),D8:String(record.settings.D8.value),S7:String(record.settings.S7.value),S18:String(sv.S18.value),L4:String(record.settings.L4.value),L5:String(record.settings.L5.value),L6:Boolean(record.settings.L6.value),H19:Number(record.settings.H19.value) as 1|2,H25:Boolean(record.settings.H25.value),H27:Boolean(record.settings.H27.value)},snapshot:snapshots.get(profile)!,controls:{priceMode:Number(record.main.H11.formula) as 1|2|3|4,mainSurchargeSelector:Number(record.main.F28.formula) as 1|2,glassSelector:Number(record.main.I11.formula),additionalWorkEnabled:Boolean(record.settings.D32.value),widthServiceEnabled:Boolean(record.settings.D33.value),l3SpecificLatchChargeEnabled:Boolean(record.settings.L3.value),installationEnabled:Boolean(record.settings.D34.value)},...(includeOrder?{orderContext:{positions:orderPositions,sourceWorkbook:record.workbook}}:{})}
}

test('Slider-X3 profile snapshots are separate, source-literal, versioned price catalogs',()=>{
 assert.equal(snapshots.size,2)
 assert.notEqual(snapshots.get('COMPLETATION')?.version,snapshots.get('RETAIL')?.version)
 assert.notEqual(snapshots.get('COMPLETATION')?.materialPrices[5].value,snapshots.get('RETAIL')?.materialPrices[5].value)
 assert.equal(snapshots.get('COMPLETATION')?.glassRates[1].sourceCell,'Прайс-Стекло!D5')
 assert.throws(()=>buildSliderX3PriceSnapshot({...snapshotFile.sources[0],profile:'RETAIL'} as any),/provenance\/profile/i)
})

test('Slider-X3 material cost matches Excel M47, retains X fasteners without charging M43:M46',()=>{
 for(const record of commercialCapture){
  const result=calculateSliderX3Commercial(buildInput(record))
  assert.equal(result.status,'COMPLETE',`${record.profile}/${record.scenarioId}`)
  assert.ok(result.materialSubtotal)
  assert.equal(display2(result.materialSubtotal!),Number(record.cells.M47.value).toFixed(2),`${record.profile}/${record.scenarioId}/M47`)
  assert.equal(result.materialPositions.length,26)
  for(const position of result.materialPositions){
   const row=Number(position.sourceCell.slice(4))
   assert.equal(position.priceSourceCell,`Прайс-Slider!E${row===40?41:row===41?42:row===42?43:row}`)
   assert.ok(result.trace.some(step=>step.id===`JV.SLIDER.X3.L${row}`&&step.source?.cell===`L${row}`))
  }
  for(const row of [43,44,46])assert.ok(result.bom.positions.some(x=>x.bomRow===row&&x.status==='CALCULATED'))
  for(const row of [43,44,45,46]){
   assert.equal(record.materials[`M${row}`].value,null)
   assert.match(String(record.materials[`L${row}`].value),/учтено/)
   assert.ok(!result.materialPositions.some(x=>x.sourceCell===`S1!M${row}`))
  }
  assert.ok(result.materialPositions.filter(x=>x.bomRow===18).length<=1)
  assert.equal(result.trace.some(x=>x.source?.cell==='M47'),true)
 }
})

function fromExcel(result:ReturnType<typeof calculateSliderX3Commercial>,record:any,cell:string){
 const source=record.cells[cell];assert.ok(source?.formula,`Excel formula missing ${cell}`)
 const step=result.trace.find(x=>x.source?.sheet==='S1'&&x.source.cell===cell)
 assert.ok(step,`engine trace missing ${cell}`)
 if(cell==='M47')return result.materialSubtotal!
 return step.result as any
}

test('Slider-X3 commercial chains reproduce captured Excel formulas and all ten M53 cases',()=>{
 for(const record of commercialCapture){
  assert.equal(record.recalc,'CalculateFullRebuild')
  const result=calculateSliderX3Commercial(buildInput(record))
  assert.equal(result.status,'COMPLETE',`${record.profile}/${record.scenarioId}: ${result.diagnostics.join(';')}`)
  assert.ok(result.m53)
  assert.ok(result.mainTransfer)
  assert.equal(display2(result.mainTransfer!.T11),Number(record.main.T11.value).toFixed(2))
  assert.equal(display2(result.mainTransfer!.Y11),Number(record.main.Y11.value).toFixed(2))
  for(const cell of ['D47','D48','D49','D50','D53','R22','R23','R24','R26','R27','M47','M48','M49','M50','M51','M52','M53']){
   const excel=record.cells[cell]
   if(!excel?.formula||typeof excel.value!=='number')continue
   assert.ok(result.trace.some(x=>x.source?.sheet==='S1'&&x.source.cell===cell),`trace ${cell}`)
   assert.equal(excel.formula.length>0,true)
  }
  for(const cell of ['M47','M48','M49','M50','M51','M52','M53']){
   const actual=cell==='M53'?result.m53:cell==='M47'?result.materialSubtotal:result.trace.find(x=>x.source?.sheet==='S1'&&x.source.cell===cell)?.result
   assert.ok(actual,`engine output ${cell}`)
   assert.equal(display2(actual as any),Number(record.cells[cell].value).toFixed(2),`${record.profile}/${record.scenarioId}/${cell}`)
  }
 }
})

test('Slider-X3 refuses to publish M53 when order-scoped price branches need absent order context',()=>{
 const record=commercialCapture.find(x=>x.profile==='RETAIL'&&x.scenarioId==='four_leaf_two_side')
 assert.ok(record)
 const input=buildInput(record,false),result=calculateSliderX3Commercial(input)
 assert.equal(result.status,'PARTIAL')
 assert.equal(result.materialSubtotal,undefined)
 assert.equal(result.m53,undefined)
 assert.equal(result.mainTransfer,undefined)
 assert.ok(result.diagnostics.some(x=>x.startsWith('ORDER_CONTEXT_REQUIRED')))
 assert.ok(result.diagnostics.some(x=>x.startsWith('ADDITIONAL_WORK_UNVERIFIED')))
})

test('Slider-X3 requires explicit order context for adhesive allocation, then respects closed commercial branches',()=>{
 const record=commercialCapture.find(x=>x.profile==='COMPLETATION'&&x.scenarioId==='two_leaf_glass')
 assert.ok(record)
 const input=buildInput(record,false)
 const incomplete=calculateSliderX3Commercial({...input,controls:{...input.controls,priceMode:1,mainSurchargeSelector:1,additionalWorkEnabled:false,widthServiceEnabled:false,installationEnabled:false}})
 assert.equal(incomplete.status,'PARTIAL')
 assert.equal(incomplete.m53,undefined)
 assert.equal(incomplete.materialSubtotal,undefined)
 assert.ok(incomplete.diagnostics.some(x=>x.startsWith('ADHESIVE_ORDER_CONTEXT_REQUIRED')))
 const withOrder=buildInput(record)
 const result=calculateSliderX3Commercial({...withOrder,controls:{...withOrder.controls,priceMode:1,mainSurchargeSelector:1,additionalWorkEnabled:false,widthServiceEnabled:false,installationEnabled:false}})
 assert.equal(result.status,'COMPLETE')
 assert.ok(result.m53)
 assert.ok(result.orderFactor)
 assert.deepEqual(result.trace.find(x=>x.source?.cell==='M48')?.result,rationalFromDecimal('0'))
 assert.deepEqual(calculateSliderX3Commercial({...withOrder,controls:{...withOrder.controls,priceMode:1,mainSurchargeSelector:1,additionalWorkEnabled:false,widthServiceEnabled:false,installationEnabled:false}}).m53,result.m53)
})

test('Slider-X3 rejects a price snapshot from the other workbook profile',()=>{
 const record=commercialCapture[0],input=buildInput(record)
 assert.throws(()=>calculateSliderX3Commercial({...input,snapshot:snapshots.get('RETAIL')!}),/same source workbook/i)
})

test('Slider-X3 keeps a mixed order partial until other nonzero family adhesive quantities are traced',()=>{
 const input=buildInput(commercialCapture[0])
 const positions=input.orderContext!.positions.map(position=>position.mainRow===12?{...position,quantity:'1',systemSelector:2,sourceSheet:'L2' as const}:position)
 const result=calculateSliderX3Commercial({...input,orderContext:{...input.orderContext!,positions}})
 assert.equal(result.status,'PARTIAL')
 assert.equal(result.materialSubtotal,undefined)
 assert.equal(result.m53,undefined)
 assert.equal(result.mainTransfer,undefined)
 assert.ok(result.diagnostics.some(x=>x.startsWith('ADHESIVE_UPSTREAM_QUANTITIES_REQUIRED')))
})

test('Slider-X3 requires nonzero, source-literal transfer settings',()=>{
 const source=snapshotFile.sources[0]
 assert.throws(()=>buildSliderX3PriceSnapshot({...source,settings:{...source.settings,D13:undefined}}),/D13/)
 assert.throws(()=>buildSliderX3PriceSnapshot({...source,settings:{...source.settings,D13:{...source.settings.D13,value:'0',sourceFormula:'0'}}}),/cannot be zero/)
})

test('Slider-X3 M53 parity fixture covers both profiles without display mismatches',()=>{
 const totals=parityCapture.scenarios.map((scenario:any)=>scenario.comparisons.find((entry:any)=>entry.excelAddress==='S1!M53'))
 assert.equal(totals.length,10)
 assert.ok(totals.every((entry:any)=>entry&&entry.status!=='MISMATCH'&&entry.status!=='UNVERIFIED'))
 assert.equal(parityCapture.scenarios.filter((scenario:any)=>scenario.status==='COMPLETE').length,10)
 assert.equal(parityCapture.counts.MISMATCH??0,0)
})

function display2(value:{numerator:string;denominator:string}):string {
 const n=BigInt(value.numerator),d=BigInt(value.denominator),scaled=n*100n
 const q=scaled/d,r=scaled%d,rounded=q+(r===0n||r*2n<d?0n:(scaled<0n?-1n:1n)),negative=rounded<0n,absolute=negative?-rounded:rounded
 return `${negative?'-':''}${absolute/100n}.${String(absolute%100n).padStart(2,'0')}`
}
