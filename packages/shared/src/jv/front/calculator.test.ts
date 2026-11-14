import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculateFront, type FrontInput } from './calculator.ts'
import { rationalFromDecimal } from '../rational.ts'

const fixture=JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/front-pr12a-excel.json',import.meta.url),'utf8')) as {scenarios:any[]}
export function frontInput(record:any):FrontInput {
 const c=record.front,s=record.settings
 const val=(address:string)=>Number(c[address].value)
 const setting=(address:string)=>String(s[address].value)
 return {workbook:record.workbook,sourceSha256:record.sourceSha256,systemSelector:7,widthMm:String(record.inputs.width),heightMm:String(record.inputs.height),sectionDemand:String(record.main.L11.value),finishSelector:Number(record.main.H11.value),glassSelector:Number(record.main.I11.value),openingSelector:Number(record.main.J11.value) as 1|2|3|4,controls:{C11:val('C11'),C12:val('C12'),C13:val('C13'),C14:val('C14'),C15:val('C15'),C18:val('C18'),C19:val('C19'),C20:val('C20'),C21:val('C21'),C22:val('C22'),C23:val('C23'),C24:val('C24'),D18:String(c.D18.value),D19:String(c.D19.value)},settings:{D8:setting('D8'),S29:setting('S29'),S30:setting('S30'),S31:setting('S31'),S32:setting('S32'),S33:setting('S33'),S34:setting('S34'),L22:setting('L22'),L23:setting('L23'),H38:Number(s.H38.value),H40:Number(s.H40.value),H42:Number(s.H42.value),H44:Number(s.H44.value),I42:Number(s.I42.value),I44:Number(s.I44.value)}}
}

test('Front calculates source-confirmed geometry, cut and all 28 quantity rows from input parameters',()=>{
 for(const record of fixture.scenarios){
  const result=calculateFront(frontInput(record))
  assert.equal(record.calculation,'CalculateFullRebuild')
  assert.equal(record.main.G11.value,7)
  assert.equal(record.front.A3.value,1)
  assert.equal(result.bom.length,28)
  assert.equal(result.selector.priceColumn,'X')
  for(const cell of ['D6','D7','D8','D11','D12','D13','D14','D15','D17','D20','I23'])assert.equal(result.selections[cell],record.front[cell].value,`${record.scenarioId}/${cell}`)
  for(const cell of ['D3','D5','H3','H4','H5','H6','H7','H8','H10','H11','H12','H13','H14']){
   const actual=(result.cut as Record<string,any>)[cell]??result.geometry[cell]
   const excel=record.front[cell]
   const digits=excel.numberFormat.match(/\.(0+)/)?.[1].length??0
   if(!String(excel.value).includes('e')&&BigInt(actual.denominator)===1n)assert.deepEqual(actual,rationalFromDecimal(String(excel.value)),`${record.scenarioId}/${cell}`)
   else assert.ok(Number((Number(actual.numerator)/Number(actual.denominator)).toFixed(digits))===Number(Number(excel.value).toFixed(digits)),`${record.scenarioId}/${cell}/display`)
  }
  for(const line of result.bom){
   const cell=`Q${line.row}`
   assert.equal(line.sourceFormula,String(record.front[cell].formula),`${record.scenarioId}/${cell}/formula`)
   assert.ok(result.trace.some(step=>step.id===line.traceStepId&&step.source?.cell===cell),`${record.scenarioId}/${cell}/trace`)
   assert.deepEqual(line.quantity,rationalFromDecimal(String(record.front[cell].value)),`${record.scenarioId}/${cell}`)
  }
  assert.equal((Number(result.geometry.H9!.numerator)/Number(result.geometry.H9!.denominator)).toFixed(0),Number(record.front.H9.value).toFixed(0))
 }
})

test('Front rejects invalid source controls and the Excel door restriction',()=>{
 const input=frontInput(fixture.scenarios[0])
 assert.throws(()=>calculateFront({...input,systemSelector:6 as 7}),/Fslot=7/)
 assert.throws(()=>calculateFront({...input,sourceSha256:'invalid'}),/SHA-256/)
 assert.throws(()=>calculateFront({...input,widthMm:'-1'}),/positive/)
 assert.throws(()=>calculateFront({...input,sectionDemand:'0'}),/positive/)
 assert.throws(()=>calculateFront({...input,openingSelector:1}),/I23=ОШИБКА/)
 assert.throws(()=>calculateFront({...input,settings:{...input.settings,S33:'0'}}),/spacing/)
})

const caseResult=(id:string)=>calculateFront(frontInput(fixture.scenarios.find(r=>r.scenarioId===`COMPLETATION-${id}`)))
const quantity=(result:ReturnType<typeof calculateFront>,row:number)=>result.bom.find(x=>x.row===row)!.quantity

test('P-shaped profile uses stock ROUNDUP and suppresses clamp quantities',()=>{
 const result=caseResult('p_profile')
 assert.deepEqual(quantity(result,5),rationalFromDecimal('0'))
 assert.deepEqual(quantity(result,12),rationalFromDecimal('9'))
 assert.deepEqual(quantity(result,13),rationalFromDecimal('9'))
 assert.deepEqual(quantity(result,14),rationalFromDecimal('12'))
 assert.deepEqual(quantity(result,15),rationalFromDecimal('5'))
 assert.equal(result.cutPieces.some(x=>x.bomRow===12&&x.lengthCell==='H12'),true)
})

test('one- and two-leaf doors select different working widths and fittings',()=>{
 const one=caseResult('door_one'),two=caseResult('door_two')
 assert.deepEqual(one.cut.H12,rationalFromDecimal('2047'))
 assert.deepEqual(two.cut.H12,rationalFromDecimal('1848'))
 assert.deepEqual(quantity(one,19),rationalFromDecimal('1'))
 assert.deepEqual(quantity(two,19),rationalFromDecimal('2'))
 assert.deepEqual(quantity(one,28),rationalFromDecimal('1'))
 assert.deepEqual(quantity(two,28),rationalFromDecimal('2'))
})

test('fixed door width uses F1!D18 while automatic mode divides the opening',()=>{
 const fixed=caseResult('fixed_door_width'),automatic=caseResult('door_one')
 assert.deepEqual(fixed.geometry.H6,rationalFromDecimal('1000'))
 assert.notDeepEqual(fixed.geometry.H6,automatic.geometry.H6)
 assert.deepEqual(fixed.cut.H12,rationalFromDecimal('2442'))
})

test('transom creates separate glass and conditional fittings',()=>{
 const result=caseResult('transom')
 assert.deepEqual(result.glass.C30,rationalFromDecimal('1'))
 assert.deepEqual(result.glass.E30,rationalFromDecimal('429'))
 assert.deepEqual(quantity(result,22),rationalFromDecimal('1'))
 assert.deepEqual(quantity(result,24),rationalFromDecimal('1'))
})

test('hard-coded Excel zero is marked inapplicable and Front adhesive consumption is zero',()=>{
 const result=caseResult('base')
 const row=result.bom.find(x=>x.row===23)!
 assert.equal(row.status,'NOT_APPLICABLE')
 assert.deepEqual(row.quantity,rationalFromDecimal('0'))
 assert.deepEqual(result.consumables.activatorPerConstruction,rationalFromDecimal('0'))
 assert.deepEqual(result.consumables.adhesivePerConstruction,rationalFromDecimal('0'))
 assert.ok(result.trace.some(x=>x.source?.sheet==='Клей+акт'&&x.source.cell==='L5'))
})

test('fittings switches activate the previously zero conditional BOM rows',()=>{
 const result=caseResult('fittings')
 for(const row of [11,21,27,30])assert.ok(BigInt(quantity(result,row).numerator)>0n,`Q${row} must be active`)
 assert.ok(result.trace.some(x=>x.source?.sheet==='F1'&&x.source.cell==='Q27'))
})

test('raw fractional section demand follows Main M11 CEILING before F1 geometry',()=>{
 const result=caseResult('fractional_sections')
 assert.deepEqual(result.geometry.C5,rationalFromDecimal('3'))
 assert.deepEqual(result.geometry.C8,rationalFromDecimal('3'))
 assert.ok(result.trace.some(x=>x.source?.sheet==='Главная'&&x.source.cell==='M11'))
 assert.ok(result.trace.some(x=>x.source?.sheet==='Главная'&&x.source.cell==='K11'))
 assert.ok(result.trace.some(x=>x.source?.sheet==='Главная'&&x.source.cell==='G11'))
 assert.ok(result.trace.some(x=>x.source?.sheet==='F1'&&x.source.cell==='A3'))
})
