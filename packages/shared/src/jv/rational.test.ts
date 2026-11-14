import test from 'node:test'
import assert from 'node:assert/strict'
import { addRational, deserializeRational, divideRational, multiplyRational, rationalFromDecimal, rationalFromFraction, serializeRational } from './rational.ts'

test('PR_10F exact rational preserves N31 6017/475 and reduces persisted fractions',()=>{
  const n31=rationalFromFraction('12034','950')
  assert.deepEqual(n31,{numerator:'6017',denominator:'475'})
  assert.deepEqual(deserializeRational(serializeRational(n31)),n31)
})
test('PR_10F exact rational supports negative values and rejects division by zero',()=>{
  assert.deepEqual(rationalFromFraction('2','-6'),{numerator:'-1',denominator:'3'})
  assert.throws(()=>divideRational(rationalFromDecimal('1'),rationalFromDecimal('0')),RangeError)
})
test('PR_10F exact money multiplication and sum never convert through Number',()=>{
  const line=multiplyRational(rationalFromFraction('6017','475'),rationalFromDecimal('52.1186440677966'))
  const sum=addRational(line,rationalFromDecimal('0.01'))
  assert.deepEqual(sum,addRational(line,{numerator:'1',denominator:'100'}))
  const huge=rationalFromFraction('9007199254740993123456789','3')
  assert.equal(serializeRational(huge),'{"numerator":"3002399751580331041152263","denominator":"1"}')
  assert.throws(()=>rationalFromFraction('9007199254740993123456789.1','3'),TypeError)
  assert.throws(()=>deserializeRational('{"numerator":9007199254740992,"denominator":"1"}'),TypeError)
})
