import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {calculateJVOrder} from './unified-order.ts'
import {findUnifiedInputMismatches} from './unified-order-input-compatibility.ts'
import {addRational,rationalFromDecimal} from './rational.ts'

const manifest=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/unified-order-all-seven-inputs.json',import.meta.url),'utf8'))
const parity=JSON.parse(readFileSync(new URL('../../../../docs/jv/UNIFIED_ORDER_ALL_SEVEN_PARITY.json',import.meta.url),'utf8'))
const excelCaptures=JSON.parse(readFileSync(new URL('../../../../docs/jv/fixtures/unified-order-all-seven-excel-pr13e.json',import.meta.url),'utf8'))

test('PR_13E canonical all-seven scenarios are input-compatible and retain Front slot 7 provenance',()=>{
 assert.equal(manifest.scenarios.length,12)
 assert.equal(parity.scenarioCount,12)
 assert.equal(parity.comparisonCount,96)
 assert.equal(parity.inputCompatibleScenarioCount,12)
 const expectedFamilies=['LINE','ZIGZAG','SLIDER_L3','SLIDER_L5','SLIDER_X3','SLIDER_X5','FRONT']
 for(const scenario of manifest.scenarios){
  const result=calculateJVOrder(scenario.engineInput)
  assert.equal(result.status,'COMPLETE',scenario.scenarioId)
  assert.deepEqual(result.positions.map(x=>x.family),expectedFamilies,scenario.scenarioId)
  assert.deepEqual(result.positions.map(x=>x.slot),[1,2,3,4,5,6,7],scenario.scenarioId)
  const front=result.positions[6]!.calculation as {readonly trace:readonly {readonly id:string;readonly source?:{readonly sheet:string;readonly cell:string;readonly formula:string}}[]}
  assert.ok(front.trace.some(x=>x.id==='JV.FRONT.F7.Y5'&&x.source?.sheet==='F7'&&x.source.cell==='Y5'&&x.source.formula==='=ПРМ!$AB$31'))
  assert.ok(result.trace.some(x=>x.ruleId==='JV.UNIFIED.MAIN.PRICE-2026-11-08-v2'&&x.source?.cell==='AA17'&&x.input.sourceCell==='F7!S38'))
  const rowAmounts=result.trace.filter(x=>x.ruleId==='JV.UNIFIED.MAIN.PRICE-2026-11-08-v2').map(x=>x.result.extendedPrice)
  assert.equal(rowAmounts.length,7)
  const sum=rowAmounts.reduce(addRational,rationalFromDecimal('0'))
  assert.ok(result.totalSalePrice)
  assert.equal(BigInt(sum.numerator)*BigInt(result.totalSalePrice!.denominator),BigInt(result.totalSalePrice!.numerator)*BigInt(sum.denominator),`${scenario.scenarioId}: AA18 must sum the seven transferred position rows`)
  const recorded=parity.cases.find(x=>x.scenarioId===scenario.scenarioId)
  assert.equal(recorded.inputCompatibility.status,'MATCH',scenario.scenarioId)
  const captured=excelCaptures.find(x=>x.scenarioId===scenario.scenarioId)
  const mismatches=findUnifiedInputMismatches(captured.inputCells.map(cell=>({scenarioId:scenario.scenarioId,family:cell.family??'ORDER',sheet:cell.sheet,address:cell.address,expected:cell.expected,actual:cell.actual,source:cell.source})))
  assert.deepEqual(mismatches,[])
 }
 assert.equal(parity.comparisonCounts.MISMATCH,0)
 assert.equal(parity.comparisonCounts.UNVERIFIED,0)
 assert.equal(parity.aa18Counts.MISMATCH,0)
 assert.equal(parity.aa18Counts.UNVERIFIED,0)
})

test('PR_13E status ledger keeps numeric and display-only equality distinct',()=>{
 assert.equal(parity.comparisonCounts.EXACT,1)
 assert.equal(parity.comparisonCounts.NUMERICALLY_EQUIVALENT,38)
 assert.equal(parity.comparisonCounts.DISPLAY_MATCH,45)
 assert.equal(parity.aa18Counts.NUMERICALLY_EQUIVALENT,3)
 assert.equal(parity.aa18Counts.DISPLAY_MATCH,9)
 assert.equal(parity.intermediateComparisonCount,216)
 assert.equal(parity.intermediateComparisonCounts.MISMATCH,0)
 assert.equal(parity.intermediateComparisonCounts.UNVERIFIED,0)
})
