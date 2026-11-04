import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateZigzagGeometry } from './geometry.ts'
import { calculateZigzagBaseMaterialQuantities } from './material-quantities.ts'

const settings={P4:'14',P24:'42',P25:'51',P26:'6.5',P27:'5.7',P28:'5',P29:'2.5',L23:'0',D8:'50',P3:'58'}
test('Z1 N9,N10,N13,N14 calculate source BOM quantities and trace catalog provenance',()=>{
 const geometry=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings})
 const bom=calculateZigzagBaseMaterialQuantities(geometry)
 assert.deepEqual(bom.specification.map(x=>[x.catalogId,x.quantity?.value,x.quantity?.unit]),[['LN-010','3.65','m'],['LN-070-A','3','piece'],['LN-080','4','piece'],['LN-120','1','set'],['LN-130','1','set'],['LN-150','1','piece'],['LN-180','3','piece'],['LN-TL','0','piece'],['LN-TR','0','piece'],['LN-TF','0','piece'],['LN-210','3','piece'],['LN-220','3','piece'],['AA-050','3','piece'],['AA-070','2','piece'],['LN-040','4.734','m']])
 assert.equal(bom.trace.length,15);assert.equal(bom.trace[0].source?.cell,'N5')
})
test('Zigzag D13 is derived from raw selector and #1 choices, both branches affect geometry',()=>{
 const yes=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings})
 const no=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:2,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings})
 assert.equal(yes.inputs.framePresent,true);assert.equal(no.inputs.framePresent,false)
 assert.notDeepEqual(yes.outputs.H4,no.outputs.H4)
})
