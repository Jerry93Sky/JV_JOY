import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { after, before, test } from 'node:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { calculateJVOrder, multiplyRational, type ExactRational, type UnifiedPositionInput } from '@bms/shared'
import { registerPlugins } from '../../src/plugins'
import { registerRoutes } from '../../src/routes'
import { getJvPriceProviderVersion, JV_ORDER_RULES_VERSION, serializeJvResult } from '../../src/domain/jv/jvCalculationService'

interface ManifestScenario {
  scenarioId: string
  profile: 'COMPLETATION' | 'RETAIL'
  sourceSha256: string
  engineInput: Parameters<typeof calculateJVOrder>[0]
}
interface Manifest { scenarios: readonly ManifestScenario[] }
interface ParityCase { scenarioId: string; profile: string; sourceSha256: string; inputCompatibility: { status: string; checkedCells: number }; validForExcel: boolean; engine: { status: string; orderTotal?: { numerator: string; denominator: string } }; excel: { AA11toAA17: readonly { slot: number; address: string; status: string; engineRational?: { numerator: string; denominator: string } }[]; AA18: { status: string; engineRational?: { numerator: string; denominator: string } } } }
interface ApiResponse { correlationId: string; orderId: string; profile: string; engineVersion: string; versions: { rules: string; provider: string; workbookSha256: string; familyPriceSnapshots: Record<string, string> }; status: string; calculation: Record<string, unknown> & { status: string; totalSalePrice?: ExactRational; positions: readonly { id: string; slot: number; family: string; quantity: ExactRational; confirmedUnitAmount?: ExactRational; status: string }[]; bom: readonly unknown[]; trace: readonly unknown[] } }

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), '../../docs/jv/fixtures/unified-order-all-seven-inputs.json'), 'utf8')) as Manifest
const parity = JSON.parse(readFileSync(resolve(process.cwd(), '../../docs/jv/UNIFIED_ORDER_ALL_SEVEN_PARITY.json'), 'utf8')) as { cases: readonly ParityCase[] }
const scenarios = manifest.scenarios
let app: FastifyInstance
let adminToken: string
let userToken: string

before(async () => {
  process.env.JWT_SECRET = 'pr14a-test-jwt-secret-not-for-production'
  app = Fastify({ logger: false })
  await registerPlugins(app)
  await registerRoutes(app)
  await app.ready()
  adminToken = app.jwt.sign({ id: 'test-admin', role: 'ADMIN' })
  userToken = app.jwt.sign({ id: 'test-user', role: 'USER' })
})

after(async () => { await app.close() })

function requestFor(scenario: ManifestScenario) {
  return {
    orderId: scenario.engineInput.orderId,
    profile: scenario.profile,
    rulesVersion: JV_ORDER_RULES_VERSION,
    priceSnapshotVersion: getJvPriceProviderVersion(scenario.profile),
    positions: scenario.engineInput.positions.map((position) => ({
      id: position.id,
      slot: position.slot,
      family: position.family,
      quantity: position.quantity,
      calculation: removeServerSnapshots(position),
    })),
  }
}

function removeServerSnapshots(position: UnifiedPositionInput): Record<string, unknown> {
  const calculation = structuredClone(position.calculation) as unknown as Record<string, unknown>
  if (position.family === 'LINE') {
    delete calculation.priceSnapshot
    delete calculation.glassSnapshot
    delete calculation.paintSnapshot
  } else if (position.family === 'FRONT') {
    const commercial = calculation.commercial as Record<string, unknown>
    delete commercial.snapshot
  } else delete calculation.snapshot
  return calculation
}

async function post(body: unknown, token = adminToken) {
  return app.inject({ method: 'POST', url: '/api/jv/orders/calculate-preview', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, payload: JSON.stringify(body) })
}

test('real registered JV route is present and uses the authenticated BMS role policy', async () => {
  assert.equal(app.hasRoute({ method: 'POST', url: '/api/jv/orders/calculate-preview' }), true)
  assert.equal((await post(requestFor(scenarios[0]!), '')).statusCode, 401)
  assert.equal((await post(requestFor(scenarios[0]!), userToken)).statusCode, 403)
  const legacy = await app.inject({ method: 'POST', url: '/api/systems/nonexistent/calculate', headers: { 'content-type': 'application/json' }, payload: '{}' })
  assert.equal(legacy.statusCode, 401)
})

test('all 12 PR_13E Excel cases run through the HTTP endpoint and preserve engine and golden values', async () => {
  assert.equal(scenarios.length, 12)
  assert.equal(parity.cases.length, 12)
  for (const scenario of scenarios) {
    const golden = parity.cases.find((entry) => entry.scenarioId === scenario.scenarioId)
    assert.ok(golden, `missing Excel parity case ${scenario.scenarioId}`)
    assert.equal(golden.inputCompatibility.status, 'MATCH')
    assert.equal(golden.validForExcel, true)
    assert.equal(golden.sourceSha256, scenario.sourceSha256)
    assert.ok([...golden.excel.AA11toAA17, golden.excel.AA18].every((cell) => cell.status !== 'MISMATCH' && cell.status !== 'UNVERIFIED'))

    const response = await post(requestFor(scenario))
    assert.equal(response.statusCode, 200, `${scenario.scenarioId}: ${response.body}`)
    const actual = response.json<ApiResponse>()
    const expected = calculateJVOrder(scenario.engineInput)
    assert.equal(actual.profile, scenario.profile)
    assert.equal(actual.status, expected.status)
    assert.equal(actual.calculation.status, expected.status)
    assert.equal(actual.versions.workbookSha256, scenario.sourceSha256)
    assert.equal(actual.versions.rules, JV_ORDER_RULES_VERSION)
    assert.equal(actual.calculation.totalSalePrice?.numerator, expected.totalSalePrice?.numerator)
    assert.equal(actual.calculation.totalSalePrice?.denominator, expected.totalSalePrice?.denominator)
    assert.deepEqual(actual.calculation, JSON.parse(JSON.stringify(serializeJvResult(expected))))
    assert.equal(actual.calculation.positions.length, 7)
    assert.equal(actual.calculation.positions[6]?.family, 'FRONT')
    assert.equal(actual.calculation.positions[6]?.slot, 7)
    for (const excelRow of golden.excel.AA11toAA17) {
      const position = actual.calculation.positions.find((entry) => entry.slot === excelRow.slot)
      assert.ok(position?.confirmedUnitAmount, `missing confirmed Main amount for ${scenario.scenarioId}/${excelRow.address}`)
      assert.deepEqual(multiplyRational(position.confirmedUnitAmount, position.quantity), excelRow.engineRational)
    }
    assert.ok(actual.calculation.bom.length > 0)
    assert.ok(actual.calculation.trace.length > 0)
    assert.deepEqual(actual.calculation.totalSalePrice, golden.excel.AA18.engineRational)
  }
})

test('each of the seven family variants dispatches through HTTP using server-selected snapshots', async () => {
  const scenario = scenarios.find((entry) => entry.profile === 'COMPLETATION')!
  for (const position of scenario.engineInput.positions) {
    const response = await post({ ...requestFor(scenario), positions: requestFor(scenario).positions.filter((item) => item.family === position.family) })
    assert.equal(response.statusCode, 200, `${position.family}: ${response.body}`)
    const body = response.json<ApiResponse>()
    assert.equal(body.calculation.positions.length, 1)
    assert.equal(body.calculation.positions[0]?.family, position.family)
    assert.ok(body.versions.familyPriceSnapshots[position.family])
    assert.ok(body.calculation.bom.length > 0)
  }
})

test('PARTIAL order returns BOM and diagnostics but no order total', async () => {
  const scenario = scenarios.find((entry) => entry.profile === 'COMPLETATION')!
  const body = requestFor(scenario)
  body.positions = body.positions.filter((position) => position.family === 'FRONT')
  const front = body.positions[0]!.calculation.commercial as Record<string, unknown>
  front.glassEnabled = false
  front.finishingEnabled = false
  const response = await post(body)
  assert.equal(response.statusCode, 200)
  const result = response.json<ApiResponse>()
  assert.equal(result.status, 'PARTIAL')
  assert.equal(result.calculation.totalSalePrice, undefined)
  assert.ok(result.calculation.bom.length > 0)
  assert.ok(result.calculation.trace.length > 0)
})

test('runtime validation rejects malformed decimals, quantities, unknown families and price tampering', async () => {
  const scenario = scenarios.find((entry) => entry.profile === 'COMPLETATION')!
  const base = requestFor(scenario)
  const wrongDecimal = structuredClone(base) as typeof base
  ;(wrongDecimal.positions[0]!.calculation.input as Record<string, unknown>).widthMm = '1+1'
  assert.equal((await post(wrongDecimal)).statusCode, 400)

  const zeroDimension = structuredClone(base) as typeof base
  ;(zeroDimension.positions[0]!.calculation.input as Record<string, unknown>).widthMm = '0'
  assert.equal((await post(zeroDimension)).statusCode, 400)

  const wrongQuantity = structuredClone(base) as typeof base
  wrongQuantity.positions[0]!.quantity = '1.5'
  assert.equal((await post(wrongQuantity)).statusCode, 400)

  const wrongFamily = structuredClone(base) as typeof base
  ;(wrongFamily.positions[0] as { family: string }).family = 'UNKNOWN'
  assert.equal((await post(wrongFamily)).statusCode, 400)

  const priceTampering = structuredClone(base) as typeof base
  priceTampering.positions[0]!.calculation.priceSnapshot = { entries: [{ value: '0' }] }
  assert.equal((await post(priceTampering)).statusCode, 400)

  const frontContextTampering = structuredClone(base) as typeof base
  const frontPosition = frontContextTampering.positions.find((position) => position.family === 'FRONT')!
  const frontCommercial = frontPosition.calculation.commercial as Record<string, unknown>
  frontCommercial.markupPercent = '999'
  frontCommercial.discountPercent = '999'
  frontCommercial.retailDivisor = '999'
  frontCommercial.mainQuantity = '999'
  const suppliedOrder = frontCommercial.order as { positions: { widthMm: string }[] }
  suppliedOrder.positions[0]!.widthMm = '1'
  const secured = await post(frontContextTampering)
  assert.equal(secured.statusCode, 200)
  assert.equal(secured.json<ApiResponse>().calculation.totalSalePrice?.numerator, goldenFor(scenarios[0]!).engine.orderTotal?.numerator)

  assert.equal((await post({ ...base, priceSnapshotVersion: 'RETAIL' })).statusCode, 409)
  assert.equal((await post({ ...base, rulesVersion: 'unreleased' })).statusCode, 409)
})

function goldenFor(scenario: ManifestScenario): ParityCase { return parity.cases.find((entry) => entry.scenarioId === scenario.scenarioId)! }

test('repeated preview with identical order input is deterministic', async () => {
  const body = requestFor(scenarios[0]!)
  const first = await post(body)
  const second = await post(body)
  assert.equal(first.statusCode, 200)
  assert.equal(second.statusCode, 200)
  const a = first.json<ApiResponse>()
  const b = second.json<ApiResponse>()
  assert.notEqual(a.correlationId, b.correlationId)
  assert.deepEqual(a.calculation, b.calculation)
})
