import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveMainSystemSelection } from './system-selector.ts'

test('Main F=1 and F=2 map through normalized G to Line and Zigzag catalog columns', () => {
  assert.equal(resolveMainSystemSelection({ rawSelector: 1 }).family, 'LINE')
  assert.equal(resolveMainSystemSelection({ rawSelector: 2 }).family, 'ZIGZAG')
})
test('Main F=4,5,6 normalize to G=3 exactly as Excel IF/OR formula', () => {
  for (const rawSelector of [4, 5, 6]) assert.equal(resolveMainSystemSelection({ rawSelector }).normalizedSelector, 3)
})
test('Main F=7 maps to the seventh R:X header, Front', () => assert.equal(resolveMainSystemSelection({ rawSelector: 7 }).family, 'FRONT'))
test('selector 11 remains explicitly unsupported because Excel maps it to INDEX 10 for a seven-column range', () => {
  assert.throws(() => resolveMainSystemSelection({ rawSelector: 11 }), /outside Главная!R:X/)
})
test('declared family cannot conflict with the Excel selector', () => {
  assert.throws(() => resolveMainSystemSelection({ rawSelector: 2, declaredFamily: 'LINE' }), /conflicting/)
})
