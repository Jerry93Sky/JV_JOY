import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateZigzagGeometry } from './geometry.ts'
import { calculateZigzagBaseMaterialQuantities } from './material-quantities.ts'

const settings={P4:'14',P24:'42',P25:'51',P26:'6.5',P27:'5.7',P28:'5',P29:'2.5',L23:'0',D8:'50',P3:'58',D6:'100',L4:'18',L5:'18',L6:false,L7:'0.95',L8:'0.95',P12:'17',P13:'6',P16:'2',P17:'0.5',P21:'1600'}
const switches={D14:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ'] as const},D15:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ'] as const},D16:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ'] as const},D17:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ'] as const}}
test('Z1 N9,N10,N13,N14 calculate source BOM quantities and trace catalog provenance',()=>{
 const geometry=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings,switches})
 const bom=calculateZigzagBaseMaterialQuantities(geometry)
 assert.equal(bom.specification.length,31);assert.equal(bom.trace.length,31)
 assert.equal(bom.specification.find(x=>x.catalogId==='LN-010')?.quantity?.value,'3.65')
 assert.equal(bom.specification.find(x=>x.catalogId==='LN-070-A')?.quantity?.value,'3')
 assert.equal(bom.specification.find(x=>x.catalogId==='LN-230')?.quantity?.value,'0')
 assert.equal(bom.trace[0].source?.cell,'N5')
})
test('Zigzag D13 is derived from raw selector and #1 choices, both branches affect geometry',()=>{
 const yes=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings,switches})
 const no=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:2,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings,switches})
 assert.equal(yes.inputs.framePresent,true);assert.equal(no.inputs.framePresent,false)
 assert.notDeepEqual(yes.outputs.H4,no.outputs.H4)
})

test('PR_10E N6/N7 derive exact sash profile lengths through D22/D23 and Zigzag geometry',()=>{
 const geometry=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings,switches})
 const bom=calculateZigzagBaseMaterialQuantities(geometry)
 assert.equal(bom.exactQuantities[6].numerator,'71951');assert.equal(bom.exactQuantities[6].denominator,'20000')
 assert.deepEqual(bom.exactQuantities[7],bom.exactQuantities[6])
 assert.deepEqual(bom.trace.find(x=>x.source?.cell==='N6')?.inputRefs,['Z1.D5','Z1.D6','Z1.D29','Z1.D30','Настройки.D6','Настройки.P12','Настройки.P13','Настройки.P16','Настройки.P17','Настройки.L23'])
})

test('PR_10E accessory table uses opening selector, sash parity and #3 lookup constants, with frame branch',()=>{
 const yes=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings,switches})
 const no=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:2,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings,switches})
 const yesBom=calculateZigzagBaseMaterialQuantities(yes),noBom=calculateZigzagBaseMaterialQuantities(no)
 assert.deepEqual([20,21,22,23,24,25,26].map(row=>yesBom.exactQuantities[row].numerator),['1','1','0','0','0','1','1'])
 assert.deepEqual([20,21,22,23,24,25,26].map(row=>noBom.exactQuantities[row].numerator),['0','0','0','0','2','0','0'])
 assert.equal(yesBom.trace.find(x=>x.source?.cell==='N20')?.source?.formula,'=IF($D$13="ДА",1,0)*$G$40')
 assert.ok(yesBom.trace.find(x=>x.source?.cell==='N20')?.inputRefs.includes('#3.O5:O10'))
})

test('PR_10E MATCH/INDEX selects all confirmed #3 rows from opening selector and sash parity',()=>{
 const expected=new Map([[11,['2','0']],[12,['1','1']],[21,['0','2']],[22,['1','1']],[31,['1','1']],[32,['1','1']]])
 for(const openingSelector of [1,2,3])for(const leafCount of [4,5]){
  const key=openingSelector*10+(leafCount%2===0?2:1),geometry=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:String(leafCount),openingSelector,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings,switches})
  const bom=calculateZigzagBaseMaterialQuantities(geometry)
  assert.deepEqual([bom.exactQuantities[20].numerator,bom.exactQuantities[21].numerator],expected.get(key))
 }
})

test('PR_10E brush and seal quantities apply ROUNDUP exactly and retain non-terminating seal rational',()=>{
 const geometry=calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings,switches})
 const bom=calculateZigzagBaseMaterialQuantities(geometry)
 assert.equal(bom.exactQuantities[30].numerator,'5');assert.equal(bom.exactQuantities[30].denominator,'1')
 assert.equal(bom.exactQuantities[31].numerator,'6017');assert.equal(bom.exactQuantities[31].denominator,'475')
 assert.equal(bom.specification.find(x=>x.catalogId==='AA-020')?.quantity,undefined)
 assert.equal(bom.trace.find(x=>x.source?.cell==='N31')?.status,'ok')
 assert.deepEqual(bom.trace.find(x=>x.source?.cell==='N31')?.warningIds,['NON_TERMINATING_DECIMAL_SERIALIZATION'])
})

test('PR_10E adhesive and activator lines remain per-construction consumption with Excel precision switch',()=>{
 const build=(L6:boolean)=>calculateZigzagBaseMaterialQuantities(calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:{...settings,L6},switches}))
 const decimal=build(false),whole=build(true)
 assert.equal(decimal.exactQuantities[34].numerator,'2');assert.equal(decimal.exactQuantities[34].denominator,'5')
 assert.equal(decimal.exactQuantities[35].numerator,'2');assert.equal(whole.exactQuantities[34].numerator,'1');assert.equal(whole.exactQuantities[34].denominator,'1')
 assert.deepEqual(decimal.trace.find(x=>x.source?.cell==='N34')?.inputRefs,['Z1.D3','Настройки.L4','Настройки.L6'])
})

test('PR_10E N31 includes the separate D16 branch using N6 only when selected',()=>{
 const geometry=(D16:boolean)=>calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings,switches:{...switches,D16:{settingIndex:D16?1:2,overrideIndex:1,choices:['ДА','НЕТ']}}})
 const noLock=calculateZigzagBaseMaterialQuantities(geometry(false)).exactQuantities[31]
 const lock=calculateZigzagBaseMaterialQuantities(geometry(true)).exactQuantities[31]
 assert.deepEqual(noLock,{numerator:'6017',denominator:'475'})
 assert.deepEqual(lock,{numerator:'192291',denominator:'9500'})
})

test('PR_10E missing consumable settings and zero denominators remain typed errors',()=>{
 const geometry=(overrides:Partial<typeof settings>)=>calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:{...settings,...overrides},switches})
 const withoutL6={...settings};delete withoutL6.L6
 assert.throws(()=>calculateZigzagBaseMaterialQuantities(calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:withoutL6,switches})),(error:any)=>error.code==='MISSING_INPUT')
 assert.throws(()=>calculateZigzagBaseMaterialQuantities(geometry({L7:'0'})),(error:any)=>error.code==='DIVISION_BY_ZERO')
 const withoutL4={...settings};delete withoutL4.L4
 assert.throws(()=>calculateZigzagBaseMaterialQuantities(calculateZigzagGeometry({widthMm:'3600',heightMm:'2400',leafSelector:'4',openingSelector:2,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:withoutL4,switches})),(error:any)=>error.code==='MISSING_INPUT')
})
