import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculateSliderL3Geometry, type SliderL3GeometryInput } from './geometry.ts'
import { calculateSliderL3Bom, calculateSliderL3FullBom } from './bom.ts'
import { rationalFromDecimal, roundRationalAwayFromZero } from '../rational.ts'

const geometryCapture=JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/slider-pr11a-selector-capture.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')) as {scenarios:any[]}
const bomCapture=JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/slider-pr11b-bom-capture.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')) as any[]
const bookScenarios=bomCapture
const pr11cCapture=JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/slider-pr11c-bom-capture.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')) as any[]
const normalizeDisplayed=(value:string)=>value.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'')

function buildGeometry(record:any,openingSelector?:1|2|3):SliderL3GeometryInput {
 const base=geometryCapture.scenarios.find((r:any)=>r.profile===record.profile&&r.inputs.F11===3&&r.inputs.C11===record.inputs.C11&&r.inputs.M11===record.inputs.M11)??geometryCapture.scenarios.find((r:any)=>r.profile===record.profile&&r.inputs.F11===3)
 const settings=base.settings.cells,slider=base.slider.cells,setting=(key:string)=>String(settings[key].value)
 return {workbook:record.workbook,systemSelector:3,widthMm:String(record.inputs.C11),heightMm:String(record.inputs.D11),leafCount:String(record.inputs.M11),openingSelector:openingSelector??record.inputs.J11,interlockState:slider.D17.value,meetingSealState:slider.D18.value,settings:{D8:setting('D8'),S2:setting('S2'),S3:setting('S3'),S4:setting('S4'),S6:setting('S6'),S9:setting('S9'),S10:setting('S10'),S11:setting('S11'),S12:setting('S12'),S13:setting('S13'),S14:setting('S14'),S21:setting('S21'),L23:setting('L23'),H25:Boolean(settings.H25.value)}}
}

test('Slider-L3 BOM quantity rules match recalculated Excel in both workbooks and all captured branches',()=>{
 const expectedRows=[14,15,16,17,22,23,29,30,43,45]
 for(const record of bookScenarios){
  assert.equal(record.recalc,'CalculateFullRebuild')
  const geometry=calculateSliderL3Geometry(buildGeometry(record))
  const options={interlockEnabled:Boolean(record.settings.H21),fittingUpgradeEnabled:Boolean(record.settings.H23),jointPairSelection:record.selectors.D22}
  const bom=calculateSliderL3Bom(geometry,options)
  assert.deepEqual(calculateSliderL3Bom(geometry,options).lines,bom.lines,`${record.profile}/${record.scenarioId} deterministic BOM`)
  assert.equal(bom.status,'PARTIAL')
  assert.deepEqual(bom.lines.map((line:any)=>line.bomRow),expectedRows)
  for(const row of expectedRows){
   const expected=record.rows.find((r:any)=>r.row===row)
   assert.ok(expected?.quantityFormula,`missing source formula K${row}`)
   assert.equal(bom.lines.find((line:any)=>line.bomRow===row)?.formula,expected.quantityFormula,`source formula K${row}`)
   assert.equal(bom.lines.find((line:any)=>line.bomRow===row)?.description,expected.item.G.value,`catalog description K${row}`)
   assert.deepEqual(bom.lines.find((line:any)=>line.bomRow===row)?.quantity,rationalFromDecimal(String(expected.quantity)),`${record.profile}/${record.scenarioId}/S1!K${row}`)
  }
  assert.ok(bom.trace.some((step:any)=>step.source?.cell==='K29'&&step.inputRefs.includes('JV.SLIDER.L3.K30')))
  assert.ok(bom.trace.some((step:any)=>step.source?.cell==='K43'&&step.ruleId?.endsWith('K43')))
  assert.ok(bom.trace.some((step:any)=>step.source?.cell==='J14'&&step.ruleId?.endsWith('J14')))
 }
})

test('Slider-L3 BOM toggles direction and H21/H23 with exact rational quantities',()=>{
 const left=bookScenarios.find((r:any)=>r.scenarioId==='two_leaves_left')
 const two=calculateSliderL3Geometry(buildGeometry(left))
 const leftBom=calculateSliderL3Bom(two,{interlockEnabled:true,fittingUpgradeEnabled:false,jointPairSelection:'2 / 4'})
 assert.deepEqual(leftBom.lines.find(x=>x.bomRow===14)?.quantity,rationalFromDecimal('2'))
 assert.deepEqual(leftBom.lines.find(x=>x.bomRow===16)?.quantity,rationalFromDecimal('2'))
 assert.deepEqual(leftBom.lines.find(x=>x.bomRow===17)?.quantity,rationalFromDecimal('0'))
 assert.deepEqual(leftBom.lines.find(x=>x.bomRow===29)?.quantity,rationalFromDecimal('2'))
 const off=calculateSliderL3Bom(two,{interlockEnabled:false,fittingUpgradeEnabled:false,jointPairSelection:'2 / 4'})
 assert.deepEqual(off.lines.find(x=>x.bomRow===15)?.quantity,rationalFromDecimal('2'))
 assert.deepEqual(off.lines.find(x=>x.bomRow===16)?.quantity,rationalFromDecimal('0'))
 assert.deepEqual(off.lines.find(x=>x.bomRow===17)?.quantity,rationalFromDecimal('0'))
 const right=calculateSliderL3Geometry(buildGeometry(left,2))
 const rightBom=calculateSliderL3Bom(right,{interlockEnabled:true,fittingUpgradeEnabled:true,jointPairSelection:'2 / 4'})
 assert.deepEqual(rightBom.lines.find(x=>x.bomRow===16)?.quantity,rationalFromDecimal('0'))
 assert.deepEqual(rightBom.lines.find(x=>x.bomRow===17)?.quantity,rationalFromDecimal('2'))
 assert.deepEqual(rightBom.lines.find(x=>x.bomRow===30)?.quantity,rationalFromDecimal('1'))
})

test('Slider-L3 BOM rejects unresolved switches and does not claim complete coverage',()=>{
 const record=bookScenarios[0],geometry=calculateSliderL3Geometry(buildGeometry(record))
 assert.throws(()=>calculateSliderL3Bom(geometry,{interlockEnabled:undefined as any,fittingUpgradeEnabled:false,jointPairSelection:'2 / 4'}),/Missing Настройки!H21/)
 assert.throws(()=>calculateSliderL3Bom(geometry,{interlockEnabled:true,fittingUpgradeEnabled:undefined as any,jointPairSelection:'2 / 4'}),/Missing Настройки!H23/)
 assert.throws(()=>calculateSliderL3Bom(geometry,{interlockEnabled:true,fittingUpgradeEnabled:false,jointPairSelection:'?' as any}),/must be resolved/)
 assert.equal(calculateSliderL3Bom(geometry,{interlockEnabled:true,fittingUpgradeEnabled:false,jointPairSelection:'2 / 4'}).status,'PARTIAL')
})

test('Slider-L3 preserves the source negative latch quantity when D22 is нет and H23 is enabled',()=>{
 const record=bookScenarios.find((r:any)=>r.scenarioId==='two_leaves_left'),geometry=calculateSliderL3Geometry(buildGeometry(record))
 const result=calculateSliderL3Bom(geometry,{interlockEnabled:true,fittingUpgradeEnabled:true,jointPairSelection:'НЕТ'})
 assert.deepEqual(result.lines.find(x=>x.bomRow===29)?.quantity,rationalFromDecimal('-1'))
})

test('Slider-L3 full BOM returns all 42 lines and exact captured Excel quantities in both profiles',()=>{
 for(const record of bookScenarios){
  const geometry=calculateSliderL3Geometry(buildGeometry(record))
  const result=calculateSliderL3FullBom(geometry,{
   interlockEnabled:Boolean(record.settings.H21),fittingUpgradeEnabled:Boolean(record.settings.H23),jointPairSelection:record.selectors.D22,
   selectorControls:{I25:2,C20:2,I29:3,C24:3,I31:2,C26:2},
  },{D6:String(record.settings.D6),D8:String(record.settings.D8),S7:String(record.settings.S7),S16:'55.4',L4:String(record.settings.L4),L5:String(record.settings.L5),L6:Boolean(record.settings.L6),H19:Number(record.settings.H19) as 1|2,H25:Boolean(record.settings.H25),H27:Boolean(record.settings.H27)})
  assert.equal(result.positions.length,42)
  assert.equal(result.supportedRows.length,28)
  assert.equal(result.notApplicableRows.length,14)
  assert.ok(result.trace.some(step=>step.id==='JV.SLIDER.L3.D20'&&step.inputRefs.includes('I25')&&step.inputRefs.includes('C20')))
  assert.ok(result.trace.some(step=>step.id==='JV.SLIDER.L3.D24'&&step.inputRefs.includes('I29')&&step.inputRefs.includes('C24')))
  assert.ok(result.trace.some(step=>step.id==='JV.SLIDER.L3.D26'&&step.inputRefs.includes('I31')&&step.inputRefs.includes('C26')))
  assert.ok(result.trace.some(step=>step.id==='JV.SLIDER.L3.K25'&&step.inputRefs.includes('JV.SLIDER.L3.J25')))
  for(const position of result.positions){
   assert.ok(result.trace.some(step=>step.id===position.traceStepId),`missing trace K${position.bomRow}`)
   const excel=record.rows.find((x:any)=>x.row===position.bomRow)
   assert.equal(position.sourceFormula,excel.quantityFormula,`${record.profile}/${record.scenarioId}/K${position.bomRow} source formula`)
   if(position.status==='NOT_APPLICABLE')continue
   assert.ok(position.quantity,`missing quantity K${position.bomRow}`)
   const direct=rationalFromDecimal(String(excel.quantity))
   if(position.quantity.numerator===direct.numerator&&position.quantity.denominator===direct.denominator)continue
   const decimals=(excel.quantityFormat.match(/[.,](0+)/)?.[1].length??0)
   assert.equal(normalizeDisplayed(roundRationalAwayFromZero(position.quantity,decimals)),normalizeDisplayed(Number(excel.quantity).toFixed(decimals)),`${record.profile}/${record.scenarioId}/K${position.bomRow} displayed parity`)
  }
 }
})

test('Slider-L3 full BOM preserves actual selector zeros and rejects missing/invalid consumable settings',()=>{
 const record=bookScenarios[0],geometry=calculateSliderL3Geometry(buildGeometry(record))
 const options={interlockEnabled:true,fittingUpgradeEnabled:true,jointPairSelection:'НЕТ' as const,selectorControls:{I25:2,C20:2,I29:3,C24:3,I31:2,C26:2}}
 const settings={D6:'100',D8:'50',S7:'4',S16:'55.4',L4:'18',L5:'18',L6:false,H19:1 as const,H25:true,H27:false}
 const result=calculateSliderL3FullBom(geometry,options,settings)
 assert.equal(result.positions.find(x=>x.bomRow===13)?.status,'NOT_APPLICABLE')
 assert.deepEqual(result.positions.find(x=>x.bomRow===33)?.quantity,rationalFromDecimal('18'))
 assert.deepEqual(result.positions.find(x=>x.bomRow===40)?.quantity,rationalFromDecimal('0.167'))
 assert.deepEqual(result.positions.find(x=>x.bomRow===29)?.quantity,rationalFromDecimal('-1'))
 assert.throws(()=>calculateSliderL3FullBom(geometry,options,{...settings,L4:'0'}),/must be positive/)
 assert.throws(()=>calculateSliderL3FullBom(geometry,options,{...settings,S16:undefined as any}),/Missing Slider BOM setting/)
 assert.throws(()=>calculateSliderL3FullBom(geometry,{...options,selectorControls:{...options.selectorControls,I25:0}},settings),/outside the source table/)
})

test('Slider-L3 lock selector labels from #1 tables preserve non-counting indexed branch',()=>{
 const record=bookScenarios[0]
 const geometryTwoSided=calculateSliderL3Geometry(buildGeometry(record,3))
 const result=calculateSliderL3FullBom(geometryTwoSided,{interlockEnabled:true,fittingUpgradeEnabled:true,jointPairSelection:'2 / 4',selectorControls:{I25:4,C20:2,I29:4,C24:4,I31:3,C26:3}},{D6:'100',D8:'50',S7:'4',S16:'55.4',L4:'18',L5:'18',L6:false,H19:1,H25:true,H27:false})
 assert.deepEqual(result.positions.find(x=>x.bomRow===27)?.quantity,rationalFromDecimal('0'))
 assert.deepEqual(result.positions.find(x=>x.bomRow===28)?.quantity,rationalFromDecimal('0'))
})

test('Slider-L3 full BOM covers Excel 16 CalculateFullRebuild selector branches in both price profiles',()=>{
 for(const record of pr11cCapture){
  assert.equal(record.recalc,'CalculateFullRebuild')
  const base=geometryCapture.scenarios.find((x:any)=>x.profile===record.profile&&x.inputs.F11===3)
  const sv=base.settings.cells
  const geometry=calculateSliderL3Geometry({workbook:record.workbook,systemSelector:3,widthMm:String(record.inputs.width),heightMm:String(record.inputs.height),leafCount:String(record.inputs.leaves),openingSelector:record.inputs.opening,interlockState:record.cells.D17,meetingSealState:record.cells.D18,settings:{D8:String(sv.D8.value),S2:String(sv.S2.value),S3:String(sv.S3.value),S4:String(sv.S4.value),S6:String(sv.S6.value),S9:String(sv.S9.value),S10:String(sv.S10.value),S11:String(sv.S11.value),S12:String(sv.S12.value),S13:String(sv.S13.value),S14:String(sv.S14.value),S21:String(sv.S21.value),L23:String(sv.L23.value),H25:Boolean(record.settings.H25)}})
  const result=calculateSliderL3FullBom(geometry,{interlockEnabled:Boolean(sv.H21.value),fittingUpgradeEnabled:Boolean(sv.H23.value),jointPairSelection:record.cells.D22,selectorControls:record.selectorControls},{D6:String(record.settings.D6),D8:String(record.settings.D8),S7:String(record.settings.S7),S16:String(record.settings.S16),L4:String(record.settings.L4),L5:String(record.settings.L5),L6:Boolean(record.settings.L6),H19:Number(record.settings.H19) as 1|2,H25:Boolean(record.settings.H25),H27:Boolean(record.settings.H27)})
  for(const position of result.positions){const excel=record.quantities[`K${position.bomRow}`];assert.equal(position.sourceFormula,excel.formula,`${record.profile}/${record.scenarioId}/formula K${position.bomRow}`);if(position.status==='NOT_APPLICABLE'){assert.equal(excel.value,0,`${record.profile}/${record.scenarioId}/inactive selector K${position.bomRow}`);continue}assert.ok(position.quantity);const direct=rationalFromDecimal(String(excel.value));if(position.quantity.numerator===direct.numerator&&position.quantity.denominator===direct.denominator)continue;const decimals=(excel.format.match(/[.,](0+)/)?.[1].length??0);assert.equal(normalizeDisplayed(roundRationalAwayFromZero(position.quantity,decimals)),normalizeDisplayed(Number(excel.value).toFixed(decimals)),`${record.profile}/${record.scenarioId}/K${position.bomRow}`)}
 }
})
