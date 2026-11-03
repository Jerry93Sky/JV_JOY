import test from 'node:test'
import assert from 'node:assert/strict'
import { decimalString } from '../decimal.ts'
import { calculateLineParkingComponents } from './parking-components.ts'
import { buildLineMaterialBom } from '../bom-line.ts'
import { calculateLineGeometryAndCuts } from './cutting.ts'
import { calculateLineSashProfileLengths } from './sash-cutting.ts'

const book='JV-комплектация 08.10.2026.xlsm'
const source=JSON.parse((await import('node:fs')).readFileSync(new URL('../../../../../docs/jv/fixtures/line-cutting-excel-golden.json',import.meta.url),'utf8'))
const caseFor=(id:string)=>source.sourceBooks[0].cases.find((x:any)=>x.id===id)

function calc(id:string){
  const record=caseFor(id),input=record.input,scenario=input.scenario,resolved=input.resolvedFromExcel,s=scenario.settings
  const geometry=calculateLineGeometryAndCuts({opening:{openingWidth:decimalString(String(scenario.main.width)),leaves:decimalString(resolved.D5),sideCount:decimalString(resolved.D6),specialSashEnabled:scenario.controls.specialSashEnabled,specialSashWidth:decimalString(String(scenario.controls.specialSashWidth)),mountingFrameState:resolved.D15,unit:'mm',settings:{sideClearance:decimalString(String(s.P15)),interLeafClearance:decimalString(String(s.P14)),sideProfileWidth:decimalString(String(s.P4)),rollerAxisToEdge:decimalString(resolved.D22)}},parking:{parkedDoorSelected:scenario.controls.parkedDoorSelected,parkedDoorPosition:decimalString(String(scenario.controls.parkedDoorPosition)),settings:{edgeToSwingAxis:decimalString(String(s.P8)),sashProfileWidth:decimalString(String(s.P5)),sideLockHandleProjection:decimalString(String(s.P9)),parkingDepthReserve:decimalString(String(s.P10)),rollerAxisToEdge:decimalString(resolved.D22)}},cuttingSettings:{carrierProfileWidth:{value:decimalString(String(s.P2)),unit:'mm'},teeWidth:{value:decimalString(String(s.P6)),unit:'mm'},teeProjection:{value:decimalString(String(s.P7)),unit:'mm'},carrierProfileAllowance:{value:decimalString(String(s.carrierProfileAllowance)),unit:'mm'}},sourceWorkbook:book})
  return calculateLineParkingComponents({workbook:book,leaves:decimalString(resolved.D5),sides:decimalString(resolved.D6),direction:resolved.D7,doorState:geometry.parking.doorState,doorPosition:decimalString(String(scenario.controls.parkedDoorPosition)),parkingPartCount:geometry.parking.parkingPartCount,knobState:resolved.D16,latchState:resolved.D17,bottomPivotState:resolved.D20})
}

test('unparked O12:O20 follow source formulas and trace each derived component',()=>{
  const r=calc('line_single_no_park')
  assert.deepEqual([r.D24,r.O12,r.O13,r.O14,r.O15,r.O16,r.O17,r.O18,r.O19,r.O20,r.O26,r.O27],['- - -','4','0','0','3','3','7','1','1','1','0','0'])
  assert.equal(r.trace.find(x=>x.source?.cell==='O16')?.source?.formula?.includes('ПД!D117:BA166'),true)
})

test('parked single and double directions use the matching longitudinal PD matrix',()=>{
  const one=calc('line_single_with_park'),two=calc('line_double_with_park')
  assert.deepEqual([one.D24,one.O12,one.O13,one.O14,one.O15,one.O16,one.O17],['OK','0','1','3','5','2','8'])
  assert.equal(one.longitudinalLookup?.sourceCell,'E121')
  assert.deepEqual([two.D24,two.O12,two.O13,two.O14,two.O15,two.O16,two.O17],['OK','0','1','2','6','1','9'])
  assert.equal(two.longitudinalLookup?.sourceCell,'E177')
})

test('full parking results enable the remaining eleven catalog BOM rows without hiding formula errors',()=>{
  const r=calc('line_single_with_park')
  const rec=caseFor('line_single_with_park')
  const sash=calculateLineSashProfileLengths({...rec.input.sashProfileResolved,workbook:book,settings:Object.fromEntries(Object.entries(rec.input.sashProfileResolved.settings).map(([k,v])=>[k,String(v)]))} as any)
  const config={leaves:decimalString('5'),sideCount:decimalString('1'),direction:'НАЛЕВО',mountingFrameState:'ДА',profileCount:decimalString('1'),floorLockState:'НЕТ',floorCloserState:'НЕТ',constructionHeight:decimalString('2500'),sideProfileHeightAllowance:decimalString('20'),sideProfileCutAllowance:decimalString('20'),sashProfile:sash,brushUnitsPerRoll:decimalString('1'),brushRollLengthMm:decimalString('1000'),parkingComponents:r}
  const geometry=calculateLineGeometryAndCuts({opening:{openingWidth:decimalString('4000'),leaves:decimalString('5'),sideCount:decimalString('1'),specialSashEnabled:false,specialSashWidth:decimalString('900'),mountingFrameState:'ДА',unit:'mm',settings:{sideClearance:decimalString('5'),interLeafClearance:decimalString('1'),sideProfileWidth:decimalString('14'),rollerAxisToEdge:decimalString('50')}},parking:{parkedDoorSelected:true,parkedDoorPosition:decimalString('2'),settings:{edgeToSwingAxis:decimalString('52'),sashProfileWidth:decimalString('34'),sideLockHandleProjection:decimalString('9'),parkingDepthReserve:decimalString('70'),rollerAxisToEdge:decimalString('50')}},cuttingSettings:{carrierProfileWidth:{value:decimalString('44'),unit:'mm'},teeWidth:{value:decimalString('218'),unit:'mm'},teeProjection:{value:decimalString('109'),unit:'mm'},carrierProfileAllowance:{value:decimalString('100'),unit:'mm'}},sourceWorkbook:book})
  const bom=buildLineMaterialBom({constructionId:'parking-full',cutting:geometry.cutting,configuration:config})
  assert.equal(bom.status,'COMPLETE');assert.equal(bom.lines.length,40);assert.equal(bom.unsupported.length,0)
  assert.deepEqual(['LN-070-A','LN-070-B','LN-070-C','LN-080','LN-090','LN-100','LN-110','LN-120','LN-130','LN-190','LN-200'].map(sku=>bom.lines.find(x=>x.sku===sku)?.quantity.value),['0','1','3','5','2','8','1','1','1','1','1'])
})
