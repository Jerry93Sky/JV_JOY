import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculateJVOrder } from '../unified-order.ts'

test('Front slot 7 and F28=2 cannot publish a total without the independent B26 source', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/unified-order-all-seven-f28-2-inputs.json', import.meta.url), 'utf8'))
  for (const scenario of manifest.scenarios) {
    assert.throws(() => calculateJVOrder(scenario.engineInput), /Front slot 7 with F28=2.*B26/)
  }
})

test('Front slot 7 uses independent provenance-bound B26 and records the actual Excel formula', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../../../docs/jv/fixtures/unified-order-all-seven-f28-2-inputs.json', import.meta.url), 'utf8'))
  for (const scenario of manifest.scenarios.filter((s: {scenarioId:string}) => s.scenarioId.includes('-base-'))) {
    const source = {schemaVersion:'1.0',sourceCell:'Главная!B26',workbook:scenario.workbook,workbookSha256:scenario.sourceSha256,value:1,version:'test-b26',sourceScenarioId:scenario.scenarioId}
    const one = calculateJVOrder({...scenario.engineInput,frontSlot7B26:source} as any)
    const two = calculateJVOrder({...scenario.engineInput,frontSlot7B26:{...source,value:2}} as any)
    assert.equal(one.status,'COMPLETE'); assert.equal(two.status,'COMPLETE')
    assert.notDeepEqual(one.totalSalePrice,two.totalSalePrice)
    const front=one.positions.find(p=>p.family==='FRONT')!
    const trace=front.trace.find((t:any)=>t.ruleId==='JV.FRONT.COMMERCIAL.S36') as any
    assert.equal(trace.source.sheet,'F7'); assert.match(trace.source.formula,/\$B\$26/); assert.equal(trace.input.selectorValue,1)
    assert.throws(()=>calculateJVOrder({...scenario.engineInput,frontSlot7B26:{...source,workbookSha256:'0'.repeat(64)}} as any),/Invalid source-bound/)
  }
})
