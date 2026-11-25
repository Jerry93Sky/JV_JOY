import assert from 'node:assert/strict'
import {test} from 'node:test'
import {displayProposalMoney} from '../src/modules/jv-order/proposalMoney.ts'
test('proposal display rounds exact rationals to kopecks without changing input',()=>{
 const original={numerator:'101620683641016173256743137',denominator:'423046875000000000000'}
 assert.deepEqual(displayProposalMoney({numerator:'1',denominator:'8'}),{text:'0,13',rounded:true})
 assert.deepEqual(displayProposalMoney({numerator:'-1',denominator:'8'}),{text:'-0,13',rounded:true})
 assert.deepEqual(displayProposalMoney({numerator:'123',denominator:'100'}),{text:'1,23',rounded:false})
 assert.equal(displayProposalMoney({numerator:'1',denominator:'0'}),null)
 assert.ok(displayProposalMoney(original)?.rounded);assert.equal(original.numerator,'101620683641016173256743137')
})
