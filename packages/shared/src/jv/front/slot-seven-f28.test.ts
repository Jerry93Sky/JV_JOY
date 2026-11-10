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
