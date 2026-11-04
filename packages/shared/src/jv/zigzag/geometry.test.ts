import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateZigzagGeometry, type ZigzagGeometryInput } from './geometry.ts'

const settings={P4:'14',P24:'42',P25:'51',P26:'6.5',P27:'5.7',P28:'5',P29:'2.5',L23:'0'}
const sample=(patch:Partial<ZigzagGeometryInput>={}):ZigzagGeometryInput=>({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings,...patch})

test('Z1 confirmed geometry for 3600x2400, four leaves, opening selector 2',()=>{
 const r=calculateZigzagGeometry(sample())
 assert.equal(r.status,'PARTIAL')
 assert.equal(r.outputs.H4.numerator,'7029'); assert.equal(r.outputs.H4.denominator,'2')
 assert.equal(r.outputs.H5.numerator,'7')
 assert.equal(r.outputs.H6.numerator,'7029'); assert.equal(r.outputs.H6.denominator,'14')
 assert.equal(r.outputs.H7.numerator,'75771'); assert.equal(r.outputs.H7.denominator,'140')
 assert.equal(r.outputs.D29.numerator,r.outputs.H7.numerator)
 assert.equal(r.trace.length,16)
 assert.equal(r.trace.find(x=>x.id==='Z1.H6')?.source?.cell,'H6')
})
test('PR_10F review confirms H9 subtracts the full Настройки!P29, not half of it',()=>{
 const result=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:{P4:'14',P24:'42',P25:'51',P26:'6.5',P27:'5.7',P28:'5',P29:'2.5',L23:'0'}})
 assert.deepEqual(result.outputs.D31,{numerator:'139831',denominator:'140'})
 assert.equal(result.trace.find(step=>step.id==='Z1.H9')?.source?.formula,'=2*H6-0.5*Настройки!P27-Настройки!P29')
})

test('geometry responds deterministically to dimensions and opening branch',()=>{
 const r=calculateZigzagGeometry(sample({widthMm:'4200',openingSelector:3}))
 assert.equal(r.inputs.normalizedOpeningCount,2)
 assert.notEqual(r.outputs.D29.numerator,r.outputs.H7.numerator)
 assert.equal(r.outputs.D29.numerator,r.outputs.H16.numerator)
})

test('rejects Excel text-result branches rather than inventing numeric geometry',()=>{
 assert.throws(()=>calculateZigzagGeometry(sample({leafSelector:'1'})),/МАЛО/)
 assert.throws(()=>calculateZigzagGeometry(sample({openingSelector:4})),/НЕТ/)
 assert.throws(()=>calculateZigzagGeometry(sample({widthMm:'NaN'})),/Invalid decimal/)
})
