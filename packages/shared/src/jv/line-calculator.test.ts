import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decimalString } from './decimal.ts'
import { calculateLineConstruction, type LineEngineInputs, type LineEngineSettings } from './line-calculator.ts'

const priceGolden=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-price-excel-golden.json',import.meta.url),'utf8'))
const snapshots=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-price-snapshots.json',import.meta.url),'utf8')).sources
function caseData(profile:'COMPLETATION'|'RETAIL'){
  const workbook=profile==='COMPLETATION'?'JV-комплектация 08.10.2026.xlsm':'JV-розница 08.10.2026.xlsm'
  const c=priceGolden.cases.find((x:any)=>x.workbook===workbook&&x.scenarioId==='line_single_with_park')
  const v=c.sourceInputs,settingsValues=c.settingsInputs
  const input:LineEngineInputs={constructionId:`adapter-${profile}`,profile,workbook,widthMm:decimalString(v.D3.value),heightMm:decimalString(v.D4.value),leaves:decimalString(v.D5.value),sideCount:decimalString(v.D6.value),direction:v.D7.value,profileCount:decimalString(v.D8.value),connectorAngle:decimalString(v.D9.value),frameState:v.D15.value,knobState:v.D16.value,latchState:v.D17.value,weatherSealState:v.D18.value,floorLockState:v.D19.value,bottomPivotState:v.D20.value,specialSashEnabled:Boolean(v.C21.value),specialSashWidthMm:decimalString(v.D21.value),rollerAxisToEdgeMm:decimalString(v.D22.value),parkedDoorSelected:Boolean(v.C23.value),parkedDoorPosition:decimalString(v.C24.value),parkedDoorReuseOpening:Boolean(v.C25.value),parkedDoorWidthMm:decimalString(v.D25.value),assemblyEnabled:Boolean(settingsValues.D33.value),millingEnabled:Boolean(settingsValues.L3.value),installationEnabled:Boolean(settingsValues.D34.value)}
  const keys=['P2','P3','P4','P5','P6','P7','P8','P9','P10','P12','P13','P14','P15','P16','P17','L23','D6','D7','D8','L4','L5','L7','L8','P21']
  const values=Object.fromEntries(keys.map(k=>[k,String(settingsValues[k].value)]))
  const settings={...values,L6:Boolean(settingsValues.L6.value)} as LineEngineSettings
  return {input,settings,snapshot:snapshots.find((s:any)=>s.profile===profile)}
}

test('public line adapter returns traced partial results and never exposes partial Q52 as a final price',()=>{
  for(const profile of ['COMPLETATION','RETAIL'] as const){
    const {input,settings,snapshot}=caseData(profile),r=calculateLineConstruction(input,settings,snapshot)
    assert.equal(r.bom.status,'COMPLETE');assert.equal(r.bom.lines.length,40)
    assert.equal(r.additionalBom.lines.length,6);assert.equal(r.additionalMaterials.completeness,'PARTIAL_SUPPORTED_POSITIONS')
    assert.equal(r.materialSubtotal.status,'PARTIAL_SUPPORTED_POSITIONS');assert.equal(r.finalPriceAvailable,false);assert.equal(r.status,'PARTIAL')
    assert.ok(r.diagnostics.some(x=>x.includes('AA-110')));assert.ok(r.trace.some(x=>(x as any).source?.cell==='O16'))
  }
})

test('public line adapter rejects a profile/workbook/price snapshot mismatch',()=>{
  const {input,settings,snapshot}=caseData('COMPLETATION')
  assert.throws(()=>calculateLineConstruction({...input,profile:'RETAIL'},settings,snapshot),(e:any)=>e.code==='INVALID_CONFIGURATION')
})
