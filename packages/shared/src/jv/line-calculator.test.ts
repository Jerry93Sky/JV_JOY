import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decimalString } from './decimal.ts'
import { rationalFromDecimal, rationalToDecimalExact } from './rational.ts'
import { calculateLineConstruction, type LineEngineInputs, type LineEngineSettings } from './line-calculator.ts'

const priceGolden=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-price-excel-golden.json',import.meta.url),'utf8'))
const snapshots=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-price-snapshots.json',import.meta.url),'utf8')).sources
const glueGolden=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-glue-single-system-excel.json',import.meta.url),'utf8'))
const glassSnapshots=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-glass-price-snapshots.json',import.meta.url),'utf8')).sources
const glassGolden=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-glass-single-system-excel.json',import.meta.url),'utf8'))
const paintSnapshots=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-paint-price-snapshots.json',import.meta.url),'utf8')).sources
const paintGolden=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-paint-single-system-excel.json',import.meta.url),'utf8'))
const extendedCommercialGolden=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-full-commercial-excel-golden.json',import.meta.url),'utf8'))
const mode2Golden=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-mode2-excel-golden.json',import.meta.url),'utf8'))
function display2(value:{numerator:string;denominator:string}){const n=BigInt(value.numerator),d=BigInt(value.denominator),a=n<0n?-n:n,s=a*100n;let q=s/d;if((s%d)*2n>=d)q++;const digits=q.toString().padStart(3,'0');return `${n<0n?'-':''}${digits.slice(0,-2)}.${digits.slice(-2)}`}
function caseData(profile:'COMPLETATION'|'RETAIL',scenarioId='line_single_with_park',finishIndex=1){
  const workbook=profile==='COMPLETATION'?'JV-комплектация 08.10.2026.xlsm':'JV-розница 08.10.2026.xlsm'
  const c=priceGolden.cases.find((x:any)=>x.workbook===workbook&&x.scenarioId===scenarioId)
  const v=c.sourceInputs,settingsValues=c.settingsInputs
  const input:LineEngineInputs={constructionId:`adapter-${profile}`,constructionQuantity:decimalString('1'),commercialModeIndex:profile==='RETAIL'?3:1,glassSelectionIndex:9,finishSelectionIndex:finishIndex,profile,workbook,widthMm:decimalString(v.D3.value),heightMm:decimalString(v.D4.value),leaves:decimalString(v.D5.value),sideCount:decimalString(v.D6.value),direction:v.D7.value,profileCount:decimalString(v.D8.value),connectorAngle:decimalString(v.D9.value),frameState:v.D15.value,knobState:v.D16.value,latchState:v.D17.value,weatherSealState:v.D18.value,floorLockState:v.D19.value,bottomPivotState:v.D20.value,specialSashEnabled:Boolean(v.C21.value),specialSashWidthMm:decimalString(v.D21.value),rollerAxisToEdgeMm:decimalString(v.D22.value),parkedDoorSelected:Boolean(v.C23.value),parkedDoorPosition:decimalString(v.C24.value),parkedDoorReuseOpening:Boolean(v.C25.value),parkedDoorWidthMm:decimalString(v.D25.value),assemblyEnabled:Boolean(settingsValues.D33.value),millingEnabled:Boolean(settingsValues.L3.value),installationEnabled:Boolean(settingsValues.D34.value)}
  const keys=['P2','P3','P4','P5','P6','P7','P8','P9','P10','P12','P13','P14','P15','P16','P17','L23','D6','D7','D8','L4','L5','L7','L8','P21']
  const values=Object.fromEntries(keys.map(k=>[k,String(settingsValues[k].value)]))
  const glassSnapshot=glassSnapshots.find((s:any)=>s.profile===profile)
  const settings={...values,P19:glassSnapshot.settings.P19,L17:glassSnapshot.settings.L17,L18:glassSnapshot.settings.L18,L22:glassSnapshot.settings.L22,L6:/^(true|1)$/i.test(String(settingsValues.L6.value)),L21:/^(true|1)$/i.test(String(glassSnapshot.settings.L21)),D32:/^(true|1)$/i.test(String(glassSnapshot.settings.D32))} as LineEngineSettings
  return {input,settings,snapshot:snapshots.find((s:any)=>s.profile===profile),glassSnapshot,paintSnapshot:paintSnapshots.find((s:any)=>s.profile===profile)}
}

test('public line adapter calculates Q52 material subtotal but never exposes it as a final price',()=>{
  for(const profile of ['COMPLETATION','RETAIL'] as const){
    const {input,settings,snapshot,glassSnapshot,paintSnapshot}=caseData(profile),r=calculateLineConstruction(input,settings,snapshot,glassSnapshot,paintSnapshot)
    assert.equal(r.bom.status,'COMPLETE');assert.equal(r.bom.lines.length,40)
    assert.equal(r.additionalBom.lines.length,6);assert.equal(r.additionalMaterials.completeness,'COMPLETE_SUPPORTED_POSITIONS')
    assert.equal(r.materialSubtotal.status,'COMPLETE');assert.equal(r.finalPriceAvailable,true);assert.equal(r.status,'COMPLETE')
    assert.ok(!r.diagnostics.some(x=>x.includes('AA-110')));assert.ok(r.trace.some(x=>(x as any).source?.cell==='O16'))
    assert.ok(r.trace.some(x=>(x as any).source?.sheet==='Клей+акт'&&(x as any).source?.cell==='O5'))
    assert.ok(r.trace.some(x=>(x as any).source?.sheet==='Прайс-Стекло'&&(x as any).source?.cell==='D13'))
  }
})

test('public line adapter rejects a profile/workbook/price snapshot mismatch',()=>{
  const {input,settings,snapshot,glassSnapshot,paintSnapshot}=caseData('COMPLETATION')
  assert.throws(()=>calculateLineConstruction({...input,profile:'RETAIL'},settings,snapshot,glassSnapshot,paintSnapshot),(e:any)=>e.code==='INVALID_CONFIGURATION')
})

test('adhesive quantities and Q49:Q50 amounts match independent single-system Excel full rebuilds',()=>{
  for(const profile of ['COMPLETATION','RETAIL'] as const){
    const source=glueGolden.sources.find((x:any)=>x.profile===profile)
    const {input,settings,snapshot,glassSnapshot,paintSnapshot}=caseData(profile,'line_single_no_park')
    const result=calculateLineConstruction(input,settings,snapshot,glassSnapshot,paintSnapshot)
    assert.deepEqual(result.adhesiveFactors.O5,{numerator:'200',denominator:'89'})
    assert.deepEqual(result.adhesiveFactors.O18,{numerator:'200',denominator:'89'})
    for(const [sku,cell] of [['AA-110','L1!Q49'],['AA-120','L1!Q50']] as const){
      const actual=result.additionalMaterials.positions.find(x=>x.sku===sku)
      assert.ok(actual)
      assert.equal(rationalToDecimalExact(actual.amount),source.observed[cell].value2,`${profile} ${cell}`)
    }
  }
})

test('selected glass, exact pane area pricing and Q54 enable switch match the two price profiles',()=>{
  for(const profile of ['COMPLETATION','RETAIL'] as const){
    const {input,settings,snapshot,glassSnapshot,paintSnapshot}=caseData(profile,'line_single_no_park')
    const result=calculateLineConstruction(input,settings,snapshot,glassSnapshot,paintSnapshot)
    const excel=glassGolden.cases.find((x:any)=>x.workbook===input.workbook)
    assert.equal(result.glass.selection.name,glassSnapshot.glassChoices.find((x:any)=>x.index===9).name)
    assert.equal(result.glass.panes.length,6)
    assert.equal(result.glass.panes[0].heightMm,'2352')
    assert.ok(result.trace.some(x=>(x as any).source?.cell==='X5'))
    for(const [engine,cell] of [[result.glass.glassTotal,'G49'],[result.glass.preCharge,'D54'],[result.glass.surcharge,'Q54']] as const){
      const exactText=rationalToDecimalExact(engine)
      assert.equal(display2(engine),display2(rationalFromDecimal(String(excel.values[cell].value2))),`${profile} ${cell} display to two decimals`)
      if(exactText!==excel.values[cell].value2)assert.notEqual(excel.values[cell].numberFormat,'General',`${cell} requires documented display-only comparison`)
    }
  }
})

test('paint prices, minimum charges, finish switch and Q53 match eight Excel full-rebuild cases',()=>{
  for(const profile of ['COMPLETATION','RETAIL'] as const)for(const finishIndex of [1,2,3,4]){
    const {input,settings,snapshot,glassSnapshot,paintSnapshot}=caseData(profile,'line_single_no_park',finishIndex)
    const result=calculateLineConstruction(input,settings,snapshot,glassSnapshot,paintSnapshot)
    const excel=paintGolden.cases.find((x:any)=>x.workbook===input.workbook&&x.finishIndex===finishIndex)
    assert.equal(rationalToDecimalExact(result.paint.q53),excel.results.Q53.value2,`${profile} finish ${finishIndex} Q53`)
    assert.equal(display2(result.paint.indexedPaintSubtotal),display2(rationalFromDecimal(excel.results.V13.value2)),`${profile} finish ${finishIndex} V13 display`)
    assert.equal(result.paint.finishName,excel.finishName)
    assert.equal(result.paint.itemCosts.length,8)
    assert.ok(result.trace.some(x=>(x as any).source?.cell==='Q53'))
  }
})

test('ten varied raw-input Excel commercial rebuilds per workbook cover full Q52:Q58',()=>{
  for(const record of extendedCommercialGolden.cases){
    const glassSnapshot=glassSnapshots.find((x:any)=>x.profile===record.profile)
    const paintSnapshot=paintSnapshots.find((x:any)=>x.profile===record.profile)
    const priceSnapshot=snapshots.find((x:any)=>x.profile===record.profile)
    const input:LineEngineInputs={constructionId:record.scenarioId,profile:record.profile,workbook:record.workbook,...Object.fromEntries(['constructionQuantity','widthMm','heightMm','leaves','sideCount','profileCount','connectorAngle','specialSashWidthMm','rollerAxisToEdgeMm','parkedDoorPosition','parkedDoorWidthMm'].map(k=>[k,decimalString(record.input[k])])) as any,mainLeavesSelector:decimalString(record.input.mainLeavesSelector),direction:record.input.direction,frameState:record.input.frameState,knobState:record.input.knobState,latchState:record.input.latchState,weatherSealState:record.input.weatherSealState,floorLockState:record.input.floorLockState,bottomPivotState:record.input.bottomPivotState,specialSashEnabled:record.input.specialSashEnabled,parkedDoorSelected:record.input.parkedDoorSelected,parkedDoorReuseOpening:record.input.parkedDoorReuseOpening,glassSelectionIndex:record.input.glassSelectionIndex,finishSelectionIndex:record.input.finishSelectionIndex,commercialModeIndex:record.input.commercialModeIndex,assemblyEnabled:record.input.assemblyEnabled,millingEnabled:record.input.millingEnabled,installationEnabled:record.input.installationEnabled}
    const settings={...record.settings,P19:glassSnapshot.settings.P19,L17:glassSnapshot.settings.L17,L18:glassSnapshot.settings.L18,L22:glassSnapshot.settings.L22,L6:/^(true|1)$/i.test(record.settings.L6),L21:/^(true|1)$/i.test(glassSnapshot.settings.L21),D32:/^(true|1)$/i.test(glassSnapshot.settings.D32)} as LineEngineSettings
    const result=calculateLineConstruction(input,settings,priceSnapshot,glassSnapshot,paintSnapshot)
    assert.equal(result.finalPriceAvailable,true,`${record.workbook} ${record.scenarioId}`)
    const actual={Q52:result.materialSubtotal.supportedSubtotal,Q53:result.paint.q53,Q54:result.glass.surcharge,Q55:result.work.assemblyAndMilling,Q56:result.commercial.q56,Q57:result.work.installation,Q58:result.commercial.q58}
    for(const cell of Object.keys(actual) as (keyof typeof actual)[]){
      assert.notEqual(typeof actual[cell],'string',`${record.workbook} ${record.scenarioId} ${cell}`)
      assert.equal(display2(actual[cell] as {numerator:string;denominator:string}),display2(rationalFromDecimal(record.expected[cell].value)),`${record.workbook} ${record.scenarioId} ${cell}`)
    }
  }
})

test('Q56 selector F28=2 and Q58 match a dedicated fresh Excel rebuild in both price profiles',()=>{
  for(const record of mode2Golden.cases){
    const glassSnapshot=glassSnapshots.find((x:any)=>x.profile===record.profile)
    const paintSnapshot=paintSnapshots.find((x:any)=>x.profile===record.profile)
    const priceSnapshot=snapshots.find((x:any)=>x.profile===record.profile)
    const i=record.input
    const input:LineEngineInputs={constructionId:record.scenarioId,profile:record.profile,workbook:record.workbook,...Object.fromEntries(['constructionQuantity','widthMm','heightMm','leaves','sideCount','profileCount','connectorAngle','specialSashWidthMm','rollerAxisToEdgeMm','parkedDoorPosition','parkedDoorWidthMm'].map(k=>[k,decimalString(i[k])])) as any,mainLeavesSelector:decimalString(i.mainLeavesSelector),direction:i.direction,frameState:i.frameState,knobState:i.knobState,latchState:i.latchState,weatherSealState:i.weatherSealState,floorLockState:i.floorLockState,bottomPivotState:i.bottomPivotState,specialSashEnabled:i.specialSashEnabled,parkedDoorSelected:i.parkedDoorSelected,parkedDoorReuseOpening:i.parkedDoorReuseOpening,glassSelectionIndex:i.glassSelectionIndex,finishSelectionIndex:i.finishSelectionIndex,commercialModeIndex:i.commercialModeIndex,assemblyEnabled:i.assemblyEnabled,millingEnabled:i.millingEnabled,installationEnabled:i.installationEnabled}
    const settings={...record.settings,P19:glassSnapshot.settings.P19,L17:glassSnapshot.settings.L17,L18:glassSnapshot.settings.L18,L22:glassSnapshot.settings.L22,L6:/^(true|1)$/i.test(record.settings.L6),L21:/^(true|1)$/i.test(glassSnapshot.settings.L21),D32:/^(true|1)$/i.test(glassSnapshot.settings.D32)} as LineEngineSettings
    const result=calculateLineConstruction(input,settings,priceSnapshot,glassSnapshot,paintSnapshot)
    const actual={Q52:result.materialSubtotal.supportedSubtotal,Q53:result.paint.q53,Q54:result.glass.surcharge,Q55:result.work.assemblyAndMilling,Q56:result.commercial.q56,Q57:result.work.installation,Q58:result.commercial.q58}
    assert.equal(result.finalPriceAvailable,true)
    for(const [cell,value] of Object.entries(actual))assert.equal(display2(value as any),display2(rationalFromDecimal(record.expected[cell].value)),`${record.profile} ${cell}`)
  }
})

test('Main!L11 leaf selector follows Excel CEILING(L11,1) before JV-Line calculations',()=>{
  const {input,settings,snapshot,glassSnapshot,paintSnapshot}=caseData('COMPLETATION','line_single_no_park')
  const result=calculateLineConstruction({...input,leaves:decimalString('5'),mainLeavesSelector:decimalString('4.5')},settings,snapshot,glassSnapshot,paintSnapshot)
  assert.ok(result.trace.some(x=>(x as any).ruleId==='JV.LINE.MAIN_LEAVES_CEILING'&&(x as any).result==='5'))
})
