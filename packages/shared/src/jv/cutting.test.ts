import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decimalString } from './decimal.ts'
import { calculateLineCarrierProfileCuts, calculateLineGeometryAndCuts } from './geometry/cutting.ts'
import { calculateLineSashProfileLengths } from './geometry/sash-cutting.ts'
import { calculateLineParkingComponents } from './geometry/parking-components.ts'
import { buildLineMaterialBom } from './bom-line.ts'
import { calculateLineWorkCosts } from './line-work-cost.ts'
import { rationalToDecimalExact } from './rational.ts'
import type { LineCarrierCuttingInput, LineGeometryAndCutsInput } from './geometry/cutting.ts'

const book='JV-комплектация 08.10.2026.xlsm' as const
const base:LineCarrierCuttingInput={
  openingWidth:{value:decimalString('4000'),unit:'mm'},sideCount:decimalString('1'),
  parkingDepth:{value:decimalString('369'),unit:'mm'},parkingAxisWidth:{value:decimalString('691'),unit:'mm'},
  settings:{carrierProfileWidth:{value:decimalString('44'),unit:'mm'},teeWidth:{value:decimalString('218'),unit:'mm'},teeProjection:{value:decimalString('109'),unit:'mm'},carrierProfileAllowance:{value:decimalString('100'),unit:'mm'}},
  sourceWorkbook:book,
}

test('L1 C28:D32 and O5 execute exact source formulas and retain formula trace',()=>{
  const r=calculateLineCarrierProfileCuts(base)
  assert.deepEqual(r.items.map(x=>[x.cutId,x.quantity.value,x.cutLength.value,x.totalCutLength.value]),[
    ['A','1','391','391'],['B','1','604','604'],['E','1','260','260'],['F','1','3522','3522'],
  ])
  assert.equal(r.totalCutLength.value,'4777')
  assert.equal(r.materialRequirement.catalogCode,'LN-010')
  assert.equal(r.materialRequirement.catalogUnit,'п.м')
  assert.equal(r.materialRequirement.quantity,'4.877')
  assert.deepEqual(r.trace.map(s=>s.source?.cell),['C28','D28','C29','D29','C30','D30','C31','D31','D32','O5'])
  assert.equal(r.trace.find(s=>s.source?.cell==='D31')?.source?.formula,'=$D$3-$D$6*(Настройки!$P$6+$D$30)')
})

test('cut quantities follow D6 and the F cut remains a single piece for two-side parking geometry',()=>{
  const r=calculateLineCarrierProfileCuts({...base,sideCount:decimalString('2'),parkingDepth:{value:decimalString('311'),unit:'mm'},parkingAxisWidth:{value:decimalString('697'),unit:'mm'}})
  assert.deepEqual(r.items.map(x=>[x.quantity.value,x.cutLength.value,x.totalCutLength.value]),[
    ['2','333','666'],['2','610','1220'],['2','202','404'],['1','3160','3160'],
  ])
  assert.equal(r.totalCutLength.value,'5450');assert.equal(r.materialRequirement.quantity,'5.55')
})

test('P2, P6, and P7 affect only their formula-linked cuts with exact decimal halves',()=>{
  const r=calculateLineCarrierProfileCuts({...base,settings:{...base.settings,carrierProfileWidth:{value:decimalString('44.5'),unit:'mm'},teeWidth:{value:decimalString('200'),unit:'mm'},teeProjection:{value:decimalString('110'),unit:'mm'}}})
  assert.deepEqual(r.items.map(x=>x.cutLength.value),['391.25','603.25','269','3531'])
  assert.equal(r.totalCutLength.value,'4794.5');assert.equal(r.materialRequirement.quantity,'4.8945')
})

test('fractional geometry and settings are preserved without universal rounding',()=>{
  const r=calculateLineCarrierProfileCuts({...base,openingWidth:{value:decimalString('4000.75'),unit:'mm'},parkingDepth:{value:decimalString('369.25'),unit:'mm'},parkingAxisWidth:{value:decimalString('691.5'),unit:'mm'},settings:{...base.settings,carrierProfileWidth:{value:decimalString('44.5'),unit:'mm'},teeProjection:{value:decimalString('109.25'),unit:'mm'}}})
  assert.deepEqual(r.items.map(x=>x.cutLength.value),['391.5','604.5','260.25','3522.5'])
  assert.equal(r.totalCutLength.value,'4778.75');assert.equal(r.materialRequirement.quantity,'4.87875')
})

test('zero and negative quantities use the Excel expressions directly, without invented clamps',()=>{
  const zero=calculateLineCarrierProfileCuts({...base,sideCount:decimalString('0')})
  assert.deepEqual(zero.items.map(x=>x.totalCutLength.value),['0','0','0','4000'])
  assert.equal(zero.totalCutLength.value,'4000');assert.equal(zero.materialRequirement.quantity,'4.1')
  const negative=calculateLineCarrierProfileCuts({...base,sideCount:decimalString('-1')})
  assert.deepEqual(negative.items.map(x=>x.totalCutLength.value),['-391','-604','-260','4478'])
  assert.equal(negative.totalCutLength.value,'3223')
})

test('cutting rejects mixed units and malformed decimal inputs',()=>{
  assert.throws(()=>calculateLineCarrierProfileCuts({...base,settings:{...base.settings,teeWidth:{value:decimalString('218'),unit:'m'}}}),(e:any)=>e.code==='UNIT_MISMATCH')
  assert.throws(()=>calculateLineCarrierProfileCuts({...base,settings:{...base.settings,teeProjection:{value:'NaN' as never,unit:'mm'}}}),/Invalid decimal/)
})

const integrated:LineGeometryAndCutsInput={
  opening:{openingWidth:decimalString('4000'),leaves:decimalString('5'),sideCount:decimalString('1'),specialSashEnabled:false,specialSashWidth:decimalString('900'),mountingFrameState:'ДА',unit:'mm',settings:{sideClearance:decimalString('5'),interLeafClearance:decimalString('1'),sideProfileWidth:decimalString('14'),rollerAxisToEdge:decimalString('50')}},
  parking:{parkedDoorSelected:false,settings:{edgeToSwingAxis:decimalString('52'),sashProfileWidth:decimalString('34'),sideLockHandleProjection:decimalString('9'),parkingDepthReserve:decimalString('70'),rollerAxisToEdge:decimalString('50')}},
  cuttingSettings:{carrierProfileWidth:{value:decimalString('44'),unit:'mm'},teeWidth:{value:decimalString('218'),unit:'mm'},teeProjection:{value:decimalString('109'),unit:'mm'},carrierProfileAllowance:{value:decimalString('100'),unit:'mm'}},sourceWorkbook:book,
}
test('integrated JV-Line chain reuses parking and opening geometry and returns one ordered trace',()=>{
  const r=calculateLineGeometryAndCuts(integrated)
  assert.equal(r.openingWidth.I25.value,'791');assert.equal(r.openingWidth.I27.value,'691')
  assert.equal(r.parking.parkingPartCount,'3');assert.equal(r.parking.depth.value,'369')
  assert.equal(r.cutting.totalCutLength.value,'4777');assert.equal(r.cutting.materialRequirement.quantity,'4.877')
  assert.equal(r.trace[0].source?.cell,'I25');assert.equal(r.trace.find(s=>s.source?.cell==='D32')?.result,'4777');assert.equal(r.trace.at(-1)?.source?.cell,'O5')
  assert.deepEqual(calculateLineGeometryAndCuts(integrated),calculateLineGeometryAndCuts(integrated))
})

test('integrated JV-Line chain supports parked-door PD lookup and source trace',()=>{
  const r=calculateLineGeometryAndCuts({...integrated,opening:{...integrated.opening,sideCount:decimalString('2')},parking:{...integrated.parking,parkedDoorSelected:true,parkedDoorPosition:decimalString('2')}})
  assert.equal(r.parking.doorState,'ДА');assert.equal(r.parking.parkingLookup?.sourceCell,'E65')
  assert.equal(r.cutting.totalCutLength.value,'5438');assert.equal(r.cutting.materialRequirement.quantity,'5.538')
  assert.equal(r.trace.find(s=>s.source?.cell==='O15')?.source?.formula?.includes('INDEX(ПД!$D$61:$BA$110,$D$5,$C$24)'),true)
})

test('both workbooks match fresh Excel geometry, full 40-row BOM and traced work-cost snapshots',()=>{
  const golden=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-cutting-excel-golden.json',import.meta.url),'utf8'))
  assert.equal(golden.sourceBooks.length,2);assert.equal(golden.totalCases,20);assert.equal(golden.exactMatches,20);assert.equal(golden.mismatchCount,0)
  assert.equal(golden.parityStatus,'EXACT_MATCH_FOR_LISTED_CASES')
  for(const book of golden.sourceBooks){
    assert.equal(book.macrosForceDisabled,true)
    for(const record of book.cases){
      const {scenario,resolvedFromExcel,sashProfileResolved}=record.input;const s=scenario.settings
      const opening={openingWidth:decimalString(String(scenario.main.width)),leaves:decimalString(resolvedFromExcel.D5),sideCount:decimalString(resolvedFromExcel.D6),specialSashEnabled:scenario.controls.specialSashEnabled,specialSashWidth:decimalString(String(scenario.controls.specialSashWidth)),mountingFrameState:resolvedFromExcel.D15,unit:'mm' as const,settings:{sideClearance:decimalString(String(s.P15)),interLeafClearance:decimalString(String(s.P14)),sideProfileWidth:decimalString(String(s.P4)),rollerAxisToEdge:decimalString(resolvedFromExcel.D22)}}
      const result=calculateLineGeometryAndCuts({opening,parking:{parkedDoorSelected:scenario.controls.parkedDoorSelected,parkedDoorPosition:decimalString(String(scenario.controls.parkedDoorPosition)),settings:{edgeToSwingAxis:decimalString(String(s.P8)),sashProfileWidth:decimalString(String(s.P5)),sideLockHandleProjection:decimalString(String(s.P9)),parkingDepthReserve:decimalString(String(s.P10)),rollerAxisToEdge:decimalString(resolvedFromExcel.D22)}},cuttingSettings:{carrierProfileWidth:{value:decimalString(String(s.P2)),unit:'mm'},teeWidth:{value:decimalString(String(s.P6)),unit:'mm'},teeProjection:{value:decimalString(String(s.P7)),unit:'mm'},carrierProfileAllowance:{value:decimalString(String(s.carrierProfileAllowance)),unit:'mm'}},sourceWorkbook:book.name})
      const actual:Record<string,string>={D5:opening.leaves,D6:opening.sideCount,D8:String(resolvedFromExcel.D8),D19:String(resolvedFromExcel.D19),D20:String(resolvedFromExcel.D20),D23:result.parking.doorState,O15:result.parking.parkingPartCount,I25:result.openingWidth.I25.value,I26:result.parking.depth.value,I27:result.openingWidth.I27.value,C28:result.cutting.items[0].quantity.value,D28:result.cutting.items[0].cutLength.value,C29:result.cutting.items[1].quantity.value,D29:result.cutting.items[1].cutLength.value,C30:result.cutting.items[2].quantity.value,D30:result.cutting.items[2].cutLength.value,C31:result.cutting.items[3].quantity.value,D31:result.cutting.items[3].cutLength.value,D32:result.cutting.totalCutLength.value,D33:String(record.engine.D33),O5:result.cutting.materialRequirement.quantity,L5:result.cutting.materialRequirement.catalogCode,M5:result.cutting.materialRequirement.description,N5:result.cutting.materialRequirement.catalogUnit}
      const sashProfile=calculateLineSashProfileLengths({workbook:book.name,openingWidth:sashProfileResolved.openingWidth,constructionHeight:sashProfileResolved.constructionHeight,leaves:sashProfileResolved.leaves,sides:sashProfileResolved.sides,frameState:sashProfileResolved.frameState,specialSash:sashProfileResolved.specialSash,specialSashWidth:sashProfileResolved.specialSashWidth,parkedDoorSelected:sashProfileResolved.parkedDoorSelected,parkedDoorPosition:sashProfileResolved.parkedDoorPosition,parkedDoorReuseOpening:sashProfileResolved.parkedDoorReuseOpening,parkedDoorWidth:sashProfileResolved.parkedDoorWidth,settings:Object.fromEntries(Object.entries(sashProfileResolved.settings).map(([k,v])=>[k,String(v)]))})
      Object.assign(actual,{F39:sashProfile.profileLengthTotal,O6:sashProfile.upperProfileQuantity,O7:sashProfile.lowerProfileQuantity})
      const parkingComponents=calculateLineParkingComponents({workbook:book.name,leaves:decimalString(resolvedFromExcel.D5),sides:decimalString(resolvedFromExcel.D6),direction:resolvedFromExcel.D7,doorState:result.parking.doorState,doorPosition:decimalString(String(scenario.controls.parkedDoorPosition)),parkingPartCount:result.parking.parkingPartCount,knobState:resolvedFromExcel.D16,latchState:resolvedFromExcel.D17,bottomPivotState:resolvedFromExcel.D20})
      Object.assign(actual,{D24:parkingComponents.D24,O12:parkingComponents.O12,O13:parkingComponents.O13,O14:parkingComponents.O14,O16:parkingComponents.O16,O17:parkingComponents.O17,O18:parkingComponents.O18,O19:parkingComponents.O19,O20:parkingComponents.O20,O26:parkingComponents.O26,O27:parkingComponents.O27})
      const profile=book.name.includes('комплектация')?'COMPLETATION':'RETAIL'
      const workCosts=calculateLineWorkCosts({workbook:book.name,profile,snapshot:JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/line-price-snapshots.json',import.meta.url),'utf8')).sources.find((x:any)=>x.profile===profile),widthMm:String(scenario.main.width),heightMm:String(resolvedFromExcel.D4),leaves:String(resolvedFromExcel.D5),sides:String(resolvedFromExcel.D6),profileCount:String(resolvedFromExcel.D8),parkedDoorSelected:scenario.controls.parkedDoorSelected,parkingPartCount:String(record.excel.O15),assemblyEnabled:Boolean(record.input.settingsControls.D33),millingEnabled:Boolean(record.input.settingsControls.L3),installationEnabled:Boolean(record.input.settingsControls.D34)})
      Object.assign(actual,{Q55:rationalToDecimalExact(workCosts.assemblyAndMilling),Q57:rationalToDecimalExact(workCosts.installation)})
      for(const [cell,expected] of Object.entries(record.excel)){
        assert.equal(actual[cell],String(expected),`${book.name} ${record.id} ${cell}`)
      }
      const bom=buildLineMaterialBom({constructionId:`${record.id}:${book.name}`,cutting:result.cutting,configuration:{leaves:decimalString(resolvedFromExcel.D5),sideCount:decimalString(resolvedFromExcel.D6),direction:resolvedFromExcel.D7,mountingFrameState:resolvedFromExcel.D15,profileCount:decimalString(resolvedFromExcel.D8),floorLockState:resolvedFromExcel.D19,floorCloserState:resolvedFromExcel.D20,constructionHeight:decimalString(resolvedFromExcel.D4),sideProfileHeightAllowance:decimalString(resolvedFromExcel.P3),sideProfileCutAllowance:decimalString(resolvedFromExcel.SettingsD8),sashProfile,brushUnitsPerRoll:decimalString(String(sashProfileResolved.settings.L7)),brushRollLengthMm:decimalString(String(sashProfileResolved.settings.P21)),parkingComponents}})
      assert.equal(record.engine.bomLineCount,40)
      assert.equal(record.engine.bomStatus,'COMPLETE')
      assert.equal(record.engine.unsupportedCount,0)
      assert.equal(record.engine.bomSKU,'LN-010')
      assert.equal(record.engine.bomDescription,'Профиль несущий')
      assert.equal(record.engine.bomUnit,'п.м')
      assert.equal(record.engine.bomSourceCell,'L1!O5')
      assert.deepEqual(bom.lines.map(line=>({sku:line.sku,description:line.description,unit:line.unit,quantity:line.quantity.value,sourceCell:line.sourceCell,sourceExpression:line.sourceExpression})),record.engine.bomPositions)
      assert.equal(bom.unsupported.length,0)
      assert.equal(record.differences.length,0)
      assert.equal(record.engine.bomVerification,'EXCEL_GOLDEN_CASE_SET')
      assert.equal(record.engine.materialCost.positions.length,40)
      assert.equal(record.engine.materialCost.unsupportedPositions.length,0)
      assert.equal(record.engine.additionalBomPositions.length,6)
      assert.equal(record.engine.unsupportedAdditionalBom.length,0)
      assert.equal(record.engine.q52MaterialSubtotal.status,'COMPLETE')
      assert.equal(record.engine.q52MaterialSubtotal.supportedSourceCells.length,46)
      assert.equal(record.engine.q52MaterialSubtotal.unsupportedPositions.length,0)
    }
  }
})
