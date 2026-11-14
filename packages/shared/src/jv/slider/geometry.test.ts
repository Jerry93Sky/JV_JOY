import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculateSliderL3Geometry, type SliderL3GeometryInput, type SliderL3GeometrySettings } from './geometry.ts'
import { rationalFromDecimal } from '../rational.ts'

const capture=JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/slider-pr11a-selector-capture.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')) as {scenarios:any[]}
function build(record:any,overrides:Partial<SliderL3GeometryInput>={}):SliderL3GeometryInput {
 const settings=record.settings.cells
 const asText=(key:string)=>String(settings[key].value)
 const slider=record.slider.cells
 return {workbook:record.workbook,systemSelector:record.inputs.F11 as 3,widthMm:String(record.inputs.C11),heightMm:String(record.inputs.D11),leafCount:String(record.inputs.M11),openingSelector:record.inputs.J11 as 1|2|3,interlockState:slider.D17.value,meetingSealState:slider.D18.value,settings:{D8:asText('D8'),S2:asText('S2'),S3:asText('S3'),S4:asText('S4'),S6:asText('S6'),S9:asText('S9'),S10:asText('S10'),S11:asText('S11'),S12:asText('S12'),S13:asText('S13'),S14:asText('S14'),S21:asText('S21'),L23:asText('L23'),H25:Boolean(record.settings.cells.H25.value)} as SliderL3GeometrySettings,...overrides}
}
const l3Scenarios=capture.scenarios.filter((row:any)=>row.inputs.F11===3)
const sources=l3Scenarios.filter((row:any)=>row.profile==='COMPLETATION')

test('Slider-L3 geometry matches all captured Excel dimensions for two input scenarios',()=>{
 for(const record of l3Scenarios){
  const result=calculateSliderL3Geometry(build(record))
  assert.equal(result.status,'COMPLETE');assert.equal(result.selector.calculationSheet,'S1');assert.equal(result.selector.priceColumn,'T')
  for(const cell of ['D31','D32','D33','D34','D43','D44','D45'] as const)assert.deepEqual(result.geometry[cell],rationalFromDecimal(String(record.slider.cells[cell].value)),`${record.profile}/${record.scenarioId} S1!${cell}`)
  assert.deepEqual(result.materialQuantities.find(x=>x.bomRow===5)?.quantity,rationalFromDecimal(String(record.slider.cells.K5.value)))
  assert.deepEqual(result.materialQuantities.find(x=>x.bomRow===7)?.quantity,rationalFromDecimal(String(record.slider.cells.K7.value)))
  assert.ok(result.trace.some(step=>step.source?.sheet==='S1'&&step.source.cell==='D43'&&step.source.formula.includes('ROUNDUP')))
 }
})

test('Slider-L3 changes exact geometry for fractional input and alternative two-sided opening',()=>{
 const base=build(sources.find((x:any)=>x.baseScenarioId==='l3_base_left_two_leaves'))
 const fractional=calculateSliderL3Geometry({...base,widthMm:'3000.5'})
 assert.deepEqual(fractional.geometry.D31,rationalFromDecimal('3001'))
 assert.deepEqual(fractional.geometry.D32,rationalFromDecimal('3001'))
 const twoSided=calculateSliderL3Geometry(build(sources.find((x:any)=>x.baseScenarioId==='l3_wider_four_leaves_two_sided')))
 assert.deepEqual(twoSided.geometry.D34,rationalFromDecimal('903'))
 assert.equal(twoSided.inputs.sideCount,2)
})

test('Slider-L3 rejects invalid dimensions, unsupported selectors, fractional leaf counts and missing settings',()=>{
 const base=build(sources[0])
 assert.throws(()=>calculateSliderL3Geometry({...base,widthMm:'0'}),/must be positive/)
 assert.throws(()=>calculateSliderL3Geometry({...base,openingSelector:4 as 1}),/opening selector/)
 assert.throws(()=>calculateSliderL3Geometry({...base,systemSelector:4 as 3}),/Only Главная/)
 assert.throws(()=>calculateSliderL3Geometry({...base,leafCount:'2.5'}),/integer/)
 assert.throws(()=>calculateSliderL3Geometry({...base,settings:{...base.settings,S2:undefined as unknown as string}}),/Missing Slider geometry setting/)
})
