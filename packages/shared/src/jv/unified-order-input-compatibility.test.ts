import test from 'node:test'
import assert from 'node:assert/strict'
import {findUnifiedInputMismatches, type UnifiedPrimaryInputCell} from './unified-order-input-compatibility.ts'

test('all-seven input compatibility reports scenario, family, Excel address, values and provenance', () => {
  const inputs: UnifiedPrimaryInputCell[] = [
    {scenarioId:'pr13e-completion-base',family:'FRONT',sheet:'Главная',address:'Z17',expected:2,actual:2,source:'manifest position quantity'},
    {scenarioId:'pr13e-completion-base',family:'FRONT',sheet:'F7',address:'C22',expected:8,actual:10,source:'front typed controls.C22'}
  ]
  assert.deepEqual(findUnifiedInputMismatches(inputs), [inputs[1]])
  assert.deepEqual(findUnifiedInputMismatches(inputs.map(cell => ({...cell,actual:cell.expected}))), [])
})
