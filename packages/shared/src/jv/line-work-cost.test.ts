import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateLineWorkCosts } from './line-work-cost.ts'
import { rationalToDecimalExact } from './rational.ts'
import type { LinePriceSnapshot } from './pricing-line.ts'

function snapshot(profile: 'COMPLETATION'|'RETAIL', workbook: string): LinePriceSnapshot {
  return { profile, currency:'RUB', version:`${profile}-work-v1`, workbook, workbookSha256:'test', capturedFrom:'EXCEL_COM_VALUE2', settings:{}, additionalSources:{assemblyInstallPrices:{C5:'1500',C8:'4500',C9:'200',C10:'2000',C11:'500',C12:'5000',C19:'200'}} , entries:[] }
}
const base = { workbook:'JV-комплектация 08.10.2026.xlsm',profile:'COMPLETATION' as const,snapshot:snapshot('COMPLETATION','JV-комплектация 08.10.2026.xlsm'),widthMm:'4000',heightMm:'2500',leaves:'5',sides:'1',profileCount:'2',parkedDoorSelected:true,parkingPartCount:'3',assemblyEnabled:true,millingEnabled:true,installationEnabled:true }

test('Q55 assembly/milling and Q57 installation use source prices without monetary rounding',()=>{
  const result=calculateLineWorkCosts(base)
  assert.equal(rationalToDecimalExact(result.assemblyAndMilling),'6600')
  assert.equal(rationalToDecimalExact(result.installation),'26500')
  assert.deepEqual(result.trace.map(step=>step.source?.cell),['Q55','Q57'])
  assert.equal(result.parity,'EXCEL_PARITY_UNVERIFIED')
})

test('work-cost switches preserve Excel zero branches',()=>{
  const result=calculateLineWorkCosts({...base,assemblyEnabled:false,millingEnabled:false,installationEnabled:false})
  assert.equal(rationalToDecimalExact(result.assemblyAndMilling),'0')
  assert.equal(rationalToDecimalExact(result.installation),'0')
})

test('work-cost calculation rejects a workbook/profile mismatch',()=>{
  assert.throws(()=>calculateLineWorkCosts({...base,profile:'RETAIL'}),(error:any)=>error.code==='INVALID_CONFIGURATION')
})
