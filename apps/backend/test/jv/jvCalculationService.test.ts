import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { after, before, test } from 'node:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { calculateJVOrder, multiplyRational, type ExactRational, type UnifiedPositionInput } from '@bms/shared'
import { registerPlugins } from '../../src/plugins'
import { registerRoutes } from '../../src/routes'
import { getJvPriceProviderVersion, JV_ORDER_RULES_VERSION, serializeJvResult } from '../../src/domain/jv/jvCalculationService'
import { getUiDefaults, JV_UI_SCHEMA_VERSION } from '../../src/domain/jv/jvUiInputs'
import { toPrismaJsonInput } from '../../src/lib/prismaJson'
import { FINANCE_EXCLUDED_STAGES } from '../../src/routes/finance'

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

test('versioned UI input contract supplies non-price fields and hydrates all seven families on the server', async () => {
  type Config = { schemaVersion: string; rulesVersion: string; profile: string; families: Record<string, Record<string, unknown>> }
  const families = ['LINE', 'ZIGZAG', 'SLIDER_L3', 'SLIDER_L5', 'SLIDER_X3', 'SLIDER_X5', 'FRONT']
  const configRequest = (profile: string, token?: string) => app.inject({ method: 'GET', url: `/api/jv/orders/form-config?profile=${profile}`, headers: token ? { authorization: `Bearer ${token}` } : {} })
  assert.equal((await configRequest('COMPLETATION')).statusCode, 401)
  assert.equal((await configRequest('COMPLETATION', userToken)).statusCode, 403)
  for (const profile of ['COMPLETATION', 'RETAIL']) {
    const response = await configRequest(profile, adminToken)
    assert.equal(response.statusCode, 200, response.body)
    const config = response.json<Config>()
    assert.equal(config.profile, profile)
    assert.equal(config.schemaVersion, 'JV-UI-INPUTS-2')
    assert.deepEqual(Object.keys(config.families).sort(), [...families].sort())
    const serialized = JSON.stringify(config)
    assert.doesNotMatch(serialized, /priceSnapshot|glassSnapshot|paintSnapshot|bomSettings|sourceSha256|unitPrice/)
    const positions = families.map((family, index) => ({ id: `ui-${index}`, slot: index + 1, family, quantity: index === 1 ? '2' : '1', calculation: config.families[family] }))
    const payload = { orderId: 'ui-contract-comparison', profile, rulesVersion: config.rulesVersion, uiSchemaVersion: config.schemaVersion, positions }
    const result = await post(payload)
    assert.equal(result.statusCode, 200, `${profile}: ${result.body}`)
    assert.equal(result.json<ApiResponse>().calculation.positions.length, 7)
    const catalogFile = profile === 'COMPLETATION' ? 'completation-pr13e.json' : 'retail-pr13e.json'
    const catalog = JSON.parse(readFileSync(resolve(process.cwd(), 'src/domain/jv/catalogs', catalogFile), 'utf8')) as { families: Record<string, { requestShape: Record<string, unknown> }> }
    const legacyPositions = positions.map(position => ({ ...position, calculation: catalog.families[position.family]!.requestShape }))
    const legacy = await post({ orderId: payload.orderId, profile, rulesVersion: config.rulesVersion, positions: legacyPositions })
    assert.equal(legacy.statusCode, 200, legacy.body)
    assert.deepEqual(result.json<ApiResponse>().calculation, legacy.json<ApiResponse>().calculation)
    for (const position of positions) {
      const single = await post({ ...payload, positions: [position] })
      assert.equal(single.statusCode, 200, `${profile}/${position.family}: ${single.body}`)
      assert.equal(single.json<ApiResponse>().calculation.positions[0]?.family, position.family)
    }
    const tampered = structuredClone(payload)
    ;(tampered.positions[0]!.calculation as Record<string, unknown>)['settings.P2'] = '0'
    assert.equal((await post(tampered)).statusCode, 400)
    const selectorTampering = structuredClone(payload)
    ;(selectorTampering.positions[2]!.calculation as Record<string, unknown>)['bomOptions.selectorControls.I25'] = 3
    assert.equal((await post(selectorTampering)).statusCode, 400)
    const unsupported = structuredClone(payload)
    ;(unsupported.positions[0]!.calculation as Record<string, unknown>)['input.commercialModeIndex'] = 3
    assert.equal((await post(unsupported)).statusCode, 422)
    const unsupportedFront = structuredClone(payload)
    ;(unsupportedFront.positions[6]!.calculation as Record<string, unknown>)['construction.openingSelector'] = 1
    assert.equal((await post(unsupportedFront)).statusCode, 422)
    assert.equal((await post({ ...unsupportedFront, uiSchemaVersion: 'JV-UI-INPUTS-1' })).statusCode, 422)
    const unavailableDoorControl = structuredClone(payload)
    ;(unavailableDoorControl.positions[6]!.calculation as Record<string, unknown>)['construction.controls.C18'] = 2
    assert.equal((await post(unavailableDoorControl)).statusCode, 422)
    assert.equal((await post({ ...unavailableDoorControl, uiSchemaVersion: 'JV-UI-INPUTS-1' })).statusCode, 422)
    const unavailableHardware = structuredClone(payload)
    ;(unavailableHardware.positions[6]!.calculation as Record<string, unknown>)['construction.controls.C22'] = 2
    assert.equal((await post({ ...unavailableHardware, uiSchemaVersion: 'JV-UI-INPUTS-1' })).statusCode, 422)
    const inconsistent = structuredClone(payload)
    ;(inconsistent.positions[0]!.calculation as Record<string, unknown>)['input.commercialModeIndex'] = 2
    assert.equal((await post(inconsistent)).statusCode, 400)
    assert.equal((await post({ ...inconsistent, uiSchemaVersion: 'JV-UI-INPUTS-1' })).statusCode, 400)
    const legacyUnsupported = structuredClone(legacyPositions)
    ;((legacyUnsupported[6]!.calculation as Record<string, unknown>).construction as Record<string, unknown>).openingSelector = 1
    assert.equal((await post({ ...payload, uiSchemaVersion: undefined, positions: legacyUnsupported })).statusCode, 422)
    const legacyHardware = structuredClone(legacyPositions)
    ;((((legacyHardware[6]!.calculation as Record<string, unknown>).construction as Record<string, unknown>).controls) as Record<string, unknown>).C22 = 2
    assert.equal((await post({ ...payload, uiSchemaVersion: undefined, positions: legacyHardware })).statusCode, 422)
    const legacyInconsistent = structuredClone(legacyPositions)
    ;((legacyInconsistent[0]!.calculation as Record<string, unknown>).input as Record<string, unknown>).commercialModeIndex = 2
    assert.equal((await post({ ...payload, uiSchemaVersion: undefined, positions: legacyInconsistent })).statusCode, 400)
    const mode2 = structuredClone(payload)
    for (const position of mode2.positions) {
      const path = position.family === 'LINE' ? 'input.commercialModeIndex' : position.family === 'ZIGZAG' ? 'position.commercial.F28' : position.family === 'FRONT' ? 'commercial.mainSurchargeSelector' : 'controls.mainSurchargeSelector'
      ;(position.calculation as Record<string, unknown>)[path] = 2
    }
    const mode2Response = await post(mode2)
    assert.equal(mode2Response.statusCode, 200, `${profile}/F28=2 with Front slot 7: ${mode2Response.body}`)
    assert.equal(mode2Response.json<ApiResponse>().status, 'COMPLETE')
    assert.equal((await post({ ...mode2, uiSchemaVersion: 'JV-UI-INPUTS-1' })).statusCode, 200)
    assert.equal((await post({ ...mode2, frontSlot7B26: {value: 2} })).statusCode, 400)
    const injectedB26 = structuredClone(mode2)
    ;(injectedB26.positions[6]!.calculation as Record<string, unknown>)['commercial.order.frontSlot7B26'] = 2
    assert.equal((await post(injectedB26)).statusCode, 400)
    const legacyMode2 = structuredClone(legacyPositions)
    for (const position of legacyMode2) {
      const c = position.calculation as Record<string, any>
      if (position.family === 'LINE') c.input.commercialModeIndex = 2
      else if (position.family === 'ZIGZAG') c.position.commercial.F28 = 2
      else if (position.family === 'FRONT') c.commercial.mainSurchargeSelector = 2
      else c.controls.mainSurchargeSelector = 2
    }
    assert.equal((await post({ ...mode2, uiSchemaVersion: undefined, positions: legacyMode2 })).statusCode, 200)
    assert.equal((await post({ ...payload, uiSchemaVersion: 'JV-UI-INPUTS-1' })).statusCode, 200)
    assert.equal((await post({ ...payload, uiSchemaVersion: 'future' })).statusCode, 409)
  }
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
    const sourceFile = scenario.profile === 'COMPLETATION' ? 'completation-pr13e.json' : 'retail-pr13e.json'
    const catalog = JSON.parse(readFileSync(resolve(process.cwd(), 'src/domain/jv/catalogs', sourceFile), 'utf8'))
    const expected = calculateJVOrder({...scenario.engineInput, frontSlot7B26:catalog.frontSlot7B26})
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

test('UI input contract reproduces the 12 source-backed all-seven API scenarios', async () => {
  for (const scenario of scenarios) {
    const legacy = requestFor(scenario)
    const compact = { ...legacy, uiSchemaVersion: JV_UI_SCHEMA_VERSION, positions: legacy.positions.map(position => ({ ...position, calculation: getUiDefaults(position.family, position.calculation) })) }
    const [fullResponse, uiResponse] = await Promise.all([post(legacy), post(compact)])
    assert.equal(fullResponse.statusCode, 200, `${scenario.scenarioId}: ${fullResponse.body}`)
    assert.equal(uiResponse.statusCode, 200, `${scenario.scenarioId}: ${uiResponse.body}`)
    assert.deepEqual(uiResponse.json<ApiResponse>().calculation, fullResponse.json<ApiResponse>().calculation, scenario.scenarioId)
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

test('Prisma JSON inputs preserve SQL-null, omitted and structured-value semantics', () => {
  assert.equal(toPrismaJsonInput(undefined), undefined)
  assert.equal(toPrismaJsonInput(null), Prisma.DbNull)
  assert.deepEqual(toPrismaJsonInput({ choices: ['clear', 'tinted'], enabled: true }), { choices: ['clear', 'tinted'], enabled: true })
  assert.equal(toPrismaJsonInput(undefined), undefined)
  assert.equal(toPrismaJsonInput('[{"id":"glass-6","price":120}]'), '[{"id":"glass-6","price":120}]')
  assert.throws(() => toPrismaJsonInput(Number.NaN), /valid JSON input/)
  assert.throws(() => toPrismaJsonInput(new Date()), /valid JSON input/)
})

test('Finance exclusions use only post-migration Prisma stages for application, invoice-waiting and failed records', () => {
  assert.deepEqual(FINANCE_EXCLUDED_STAGES, ['APPLICATION', 'INVOICE_SENT', 'FAILED'])
})
