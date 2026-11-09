import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {calculateSliderL5Geometry} from './l5-geometry.ts'
import {calculateSliderL5FullBom} from './l5-bom.ts'
import {rationalFromDecimal,roundRationalAwayFromZero} from '../rational.ts'

const selectors=JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/slider-pr11a-selector-capture.json',import.meta.url),'utf8')) as any
const captures=JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/slider-pr11e-bom-capture.json',import.meta.url),'utf8')) as any[]

function calculate(record:any){
 const base=selectors.scenarios.find((x:any)=>x.profile===record.profile&&x.inputs.F11===4),sv=base.settings.cells
 const geometry=calculateSliderL5Geometry({workbook:record.workbook,systemSelector:4,widthMm:String(record.inputs.width),heightMm:String(record.inputs.height),leafCount:String(record.inputs.leaves),openingSelector:record.inputs.opening,interlockState:record.cells.D17,meetingSealState:record.cells.D18,settings:{D8:String(sv.D8.value),S2:String(sv.S2.value),S3:String(sv.S3.value),S4:String(sv.S4.value),S6:String(sv.S6.value),S9:String(sv.S9.value),S10:String(sv.S10.value),S11:String(sv.S11.value),S12:String(sv.S12.value),S13:String(sv.S13.value),S14:String(sv.S14.value),S21:String(sv.S21.value),S22:String(sv.S22.value),L23:String(sv.L23.value),H25:Boolean(record.settings.H25)}})
 const bom=calculateSliderL5FullBom(geometry,{interlockEnabled:Boolean(record.settings.H21),fittingUpgradeEnabled:Boolean(record.settings.H23),jointPairSelection:record.cells.D22,selectorControls:record.selectorControls},{D6:String(record.settings.D6),D8:String(record.settings.D8),S7:String(record.settings.S7),S17:String(sv.S17.value),L4:String(record.settings.L4),L5:String(record.settings.L5),L6:Boolean(record.settings.L6),H19:Number(record.settings.H19) as 1|2,H25:Boolean(record.settings.H25),H27:Boolean(record.settings.H27)})
 return {geometry,bom}
}

test('Slider-L5 computes geometry and all applicable material quantities from inputs for both Excel profiles',()=>{
 for(const record of captures){
  assert.equal(record.recalc,'CalculateFullRebuild')
  const {geometry,bom}=calculate(record)
  assert.equal(geometry.track.combinedCode,15)
  assert.equal(bom.positions.length,42)
  assert.equal(bom.supportedRows.length,28)
  for(const cell of ['D31','D32','D33','D34']){
   const actual=geometry.geometry[cell as keyof typeof geometry.geometry]
   assert.deepEqual(actual,rationalFromDecimal(String(record.cells[cell])),`${record.profile}/${record.scenarioId}/${cell}`)
  }
  for(const position of bom.positions){
   const excel=record.quantities[`K${position.bomRow}`]
   assert.equal(position.sourceFormula,excel.formula,`${record.profile}/${record.scenarioId}/K${position.bomRow} formula`)
   if(position.status==='NOT_APPLICABLE'){assert.equal(excel.value,0);continue}
   assert.ok(position.quantity)
   const digits=excel.format.match(/[.,](0+)/)?.[1].length??0
   assert.equal(Number(roundRationalAwayFromZero(position.quantity!,digits)),Number(Number(excel.value).toFixed(digits)),`${record.profile}/${record.scenarioId}/K${position.bomRow}`)
  }
 }
})

test('Slider-L5 rejects a wrong selector, missing S22 and missing five-track BOM setting S17',()=>{
 const record=captures[0],base=selectors.scenarios.find((x:any)=>x.profile===record.profile&&x.inputs.F11===4),sv=base.settings.cells
 const input={workbook:record.workbook,systemSelector:4 as const,widthMm:'3000',heightMm:'2200',leafCount:'2',openingSelector:1 as const,interlockState:record.cells.D17,meetingSealState:record.cells.D18,settings:{D8:String(sv.D8.value),S2:String(sv.S2.value),S3:String(sv.S3.value),S4:String(sv.S4.value),S6:String(sv.S6.value),S9:String(sv.S9.value),S10:String(sv.S10.value),S11:String(sv.S11.value),S12:String(sv.S12.value),S13:String(sv.S13.value),S14:String(sv.S14.value),S21:String(sv.S21.value),S22:String(sv.S22.value),L23:String(sv.L23.value),H25:true}}
 assert.throws(()=>calculateSliderL5Geometry({...input,systemSelector:3 as 4}),/Fslot=4/)
 assert.throws(()=>calculateSliderL5Geometry({...input,settings:{...input.settings,S22:undefined as any}}),/S22/)
 const geometry=calculateSliderL5Geometry(input)
 assert.throws(()=>calculateSliderL5FullBom(geometry,{interlockEnabled:true,fittingUpgradeEnabled:true,jointPairSelection:record.cells.D22,selectorControls:record.selectorControls},{D6:'100',D8:'50',S7:'4',S17:undefined as any,L4:'18',L5:'18',L6:false,H19:1,H25:true,H27:false}),/S17/)
})
