import test from 'node:test'
import assert from 'node:assert/strict'
import { compareRationalToExcelValue2 } from './excel-number-parity.ts'

test('Excel Value2 parity distinguishes exact decimal and identical binary numeric values without tolerance',()=>{
  assert.equal(compareRationalToExcelValue2({numerator:'0',denominator:'1'},0),'EXACT')
  assert.equal(compareRationalToExcelValue2({numerator:'1',denominator:'3'},1/3),'NUMERICALLY_EQUIVALENT')
  assert.equal(compareRationalToExcelValue2({numerator:'100000000000000000000000000000000000000000000000000',denominator:'300000000000000000000000000000000000000000000000000'},1/3),'NUMERICALLY_EQUIVALENT')
  assert.equal(compareRationalToExcelValue2({numerator:'250',denominator:'89'},250/89),'NUMERICALLY_EQUIVALENT')
  assert.equal(compareRationalToExcelValue2({numerator:'1',denominator:'3'},1/3+Number.EPSILON),'MISMATCH')
  assert.equal(compareRationalToExcelValue2({numerator:'1',denominator:'3'},'#VALUE!'),'UNVERIFIED')
})
