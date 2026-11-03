import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decimalString } from './decimal.ts'
import { multiplyRational, rationalFromDecimal, rationalToDecimalExact } from './rational.ts'
import { calculateLineOrder } from './order-line.ts'
import type { LineEngineInputs, LineEngineSettings } from './line-calculator.ts'

const golden=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-order-excel-golden.json',import.meta.url),'utf8'))
const raw=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-full-commercial-excel-golden.json',import.meta.url),'utf8')).cases
const prices=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-price-snapshots.json',import.meta.url),'utf8')).sources
const glasses=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-glass-price-snapshots.json',import.meta.url),'utf8')).sources
const paints=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-paint-price-snapshots.json',import.meta.url),'utf8')).sources
function display2(value:Exact){const n=BigInt(value.numerator),d=BigInt(value.denominator),a=n<0n?-n:n,s=a*100n;let q=s/d;if((s%d)*2n>=d)q++;const t=q.toString().padStart(3,'0');return `${n<0n?'-':''}${t.slice(0,-2)}.${t.slice(-2)}`}
type Exact={numerator:string;denominator:string}
function build(profile:'COMPLETATION'|'RETAIL',id:string,width:string,height:string,quantity:string,slot:number){
  const base=raw.find((x:any)=>x.profile===profile&&x.scenarioId==='line_single_no_park')
  const selectors=golden.cases.find((x:any)=>x.profile===profile&&x.scenarioId==='line_two_slots_mixed_area').selectors
  const input:LineEngineInputs={...Object.fromEntries(Object.entries(base.input).filter(([k])=>!['constructionQuantity','widthMm','heightMm'].includes(k)).map(([k,v])=>[k,typeof v==='string'&&/^\d/.test(v)?decimalString(v):v])) as any,constructionId:id,constructionQuantity:decimalString(quantity),widthMm:decimalString(width),heightMm:decimalString(height),finishSelectionIndex:Number(selectors.finishIndex),glassSelectionIndex:Number(selectors.glassIndex),commercialModeIndex:Number(selectors.commercialModeIndex),assemblyEnabled:Boolean(selectors.assembly),millingEnabled:Boolean(selectors.milling),installationEnabled:Boolean(selectors.installation),profile,workbook:base.workbook}
  const g=glasses.find((x:any)=>x.profile===profile),settings={...base.settings,P19:g.settings.P19,L17:g.settings.L17,L18:g.settings.L18,L21:/^(true|1)$/i.test(g.settings.L21),L22:g.settings.L22,D32:/^(true|1)$/i.test(g.settings.D32)} as LineEngineSettings
  return {id,slot,family:'LINE' as const,calculation:input,settings,price:prices.find((x:any)=>x.profile===profile),glass:g,paint:paints.find((x:any)=>x.profile===profile)}
}
function run(profile:'COMPLETATION'|'RETAIL',positions:readonly {id:string;slot:number;family:'LINE';calculation:LineEngineInputs;settings:LineEngineSettings;price:any;glass:any;paint:any}[]){const fallback=build(profile,'snapshot-source','3200','2300','1',1),f=positions[0]??fallback;return calculateLineOrder({orderId:`order-${profile}`,positions,settings:f.settings,priceSnapshot:f.price,glassSnapshot:f.glass,paintSnapshot:f.paint})}

test('two JV-Line slots use Excel order-level X5 and shared adhesive factors with aggregated Q52:Q58',()=>{
  for(const profile of ['COMPLETATION','RETAIL'] as const){
    const a=build(profile,'slot-1','3200','2300','2',1),b=build(profile,'slot-2','1800','2100','3',2),result=run(profile,[a,b])
    const excel=golden.cases.find((x:any)=>x.profile===profile&&x.scenarioId==='line_two_slots_mixed_area')
    assert.equal(result.status,'COMPLETE');assert.ok(result.totals)
    assert.equal(result.positions.length,2)
    for(const key of ['Q52','Q53','Q54','Q55','Q56','Q57','Q58'] as const)assert.equal(display2(result.totals![key]),display2(rationalFromDecimal(String(excel.orderTotals[key]))),`${profile} ${key} display`)
    for(let i=0;i<2;i++){const pos=result.positions[i];const engineX=pos.calculation!.glass.systemAllocationFactor;const excelX=excel.positions[i].cells.X5;assert.equal(display2(engineX),display2(rationalFromDecimal(String(excelX))),`${profile} slot ${i+1} X5 display`)}
    assert.equal(result.specification.some(x=>x.sku==='AA-110'),true)
    assert.equal(result.trace.some((x:any)=>x.source?.cell==='AB25'),true)
    assert.equal(result.trace.some((x:any)=>x.source?.cell==='AB26'),true)
    assert.equal(result.trace.some((x:any)=>x.source?.sheet==='Клей+акт'&&x.source?.cell==='O5'),true)
    const slotTwo=result.positions[1].calculation!
    assert.ok(slotTwo.trace.some((x:any)=>x.source?.sheet==='L2'&&x.source?.cell==='X5'&&x.source?.formula.includes('AB$26')))
    assert.ok(slotTwo.bom.lines.every(x=>x.sourceCell.startsWith('L2!')))
    assert.equal(rationalToDecimalExact(multiplyRational(result.sharedRules!.totalActivatorConsumption,result.sharedRules!.adhesiveFactors.O5)),String(excel.glue.N12),`${profile} shared activator pack count`)
    assert.equal(rationalToDecimalExact(multiplyRational(result.sharedRules!.totalAdhesiveConsumption,result.sharedRules!.adhesiveFactors.O18)),String(excel.glue.N25),`${profile} shared adhesive pack count`)
    assert.ok(result.trace.some((x:any)=>x.id==='JV.ORDER.AGGREGATE.Q58'))
  }
})

test('single-slot Excel captures at quantity 1 and 3 are reproduced and deterministic',()=>{
  for(const profile of ['COMPLETATION','RETAIL'] as const)for(const scenarioId of ['line_single_qty1','line_single_qty3']){
    const excel=golden.cases.find((x:any)=>x.profile===profile&&x.scenarioId===scenarioId),source=excel.inputs[0]
    const p=build(profile,`slot-${source.slot}`,String(source.width),String(source.height),String(source.quantity),source.slot)
    const first=run(profile,[p]),second=run(profile,[p])
    assert.deepEqual(first,second,`${profile}/${scenarioId} deterministic result`)
    assert.equal(first.status,'COMPLETE');assert.ok(first.totals)
    for(const key of ['Q52','Q53','Q54','Q55','Q56','Q57','Q58'] as const)assert.equal(display2(first.totals![key]),display2(rationalFromDecimal(String(excel.orderTotals[key]))),`${profile}/${scenarioId}/${key}`)
  }
})

test('mixed-family order remains PARTIAL and never publishes a total',()=>{
  const a=build('COMPLETATION','line-1','3200','2300','1',1)
  const partial=calculateLineOrder({orderId:'mixed',positions:[a,{id:'zigzag-1',slot:2,family:'ZIGZAG',widthMm:'1800',heightMm:'2100',quantity:'1'}],settings:a.settings,priceSnapshot:a.price,glassSnapshot:a.glass,paintSnapshot:a.paint})
  assert.equal(partial.status,'PARTIAL');assert.equal(partial.totals,undefined);assert.ok(partial.diagnostics[0].includes('ZIGZAG'));assert.ok(partial.positions.every(x=>x.pricingScope==='CONSTRUCTION_ONLY_ORDER_RULES_UNAVAILABLE'))
})

test('order adapter rejects duplicate slots and empty orders',()=>{
  const a=build('COMPLETATION','line-1','3200','2300','1',1)
  assert.throws(()=>run('COMPLETATION',[]),/at least one position/)
  assert.throws(()=>run('COMPLETATION',[a,{...a,id:'line-2'}]),/unique/)
})
