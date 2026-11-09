import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import Fastify from 'fastify'
import { DealStage } from '@prisma/client'
import { buildPaymentUpdate, createProposalVersion, decidePaymentWorkflow, issueDealInvoice } from '../../src/domain/deals/stageWorkflow'
import { registerPlugins } from '../../src/plugins'
import { dealRoutes } from '../../src/routes/deals'

const secret = 'pr14c-deal-workflow-test-only'
let app: ReturnType<typeof Fastify>

before(async () => {
  process.env.JWT_SECRET = secret
  app = Fastify({ logger: false })
  await registerPlugins(app)
  await app.register(dealRoutes, { prefix: '/api/deals' })
  app.get('/auth-check', { preHandler: async (request, reply) => {
    const { requireAuth } = await import('../../src/lib/auth')
    await requireAuth(request, reply)
  } }, async () => ({ ok: true }))
  await app.ready()
})

after(async () => { await app.close() })

test('deal proposal, invoice, and payment routes keep authentication; signed-in USER role remains permitted', async () => {
  for (const path of ['/api/deals/test/proposal', '/api/deals/test/invoice', '/api/deals/test/payment']) {
    const response = await app.inject({ method: 'POST', url: path, payload: {} })
    assert.equal(response.statusCode, 401, path)
  }
  const token = app.jwt.sign({ id: 'workflow-user', role: 'USER' })
  const authorized = await app.inject({ method: 'GET', url: '/auth-check', headers: { authorization: `Bearer ${token}` } })
  assert.equal(authorized.statusCode, 200)
  assert.deepEqual(authorized.json(), { ok: true })
})

test('proposal creation and revision create sequential document records without changing deal stage', async () => {
  let stage: DealStage = DealStage.IN_PROGRESS
  const records: { dealId: string; version: number; url: string }[] = []
  const create = async (data: { dealId: string; version: number; url: string }) => { records.push(data) }

  let result = await createProposalVersion({ stage, proposalCount: records.length, dealId: 'deal-1', dealNumber: 'JV-1', create })
  assert.deepEqual(result, { ok: true, version: 1, url: '/proposals/JV-1_v1.pdf' })
  result = await createProposalVersion({ stage, proposalCount: records.length, dealId: 'deal-1', dealNumber: 'JV-1', create })
  assert.deepEqual(result, { ok: true, version: 2, url: '/proposals/JV-1_v2.pdf' })
  assert.deepEqual(records.map(({ version }) => version), [1, 2])
  assert.equal(stage, DealStage.IN_PROGRESS)

  const denied = await createProposalVersion({ stage: DealStage.ASSEMBLY, proposalCount: 0, dealId: 'deal-2', dealNumber: 'JV-2', create })
  assert.deepEqual(denied, { ok: false, reason: 'PROPOSAL_REQUIRES_IN_PROGRESS' })
  assert.equal(records.length, 2)
})

test('invoice issue reserves stock, advances to INVOICE_SENT, preserves invoice timestamp and records event', async () => {
  const now = new Date('2026-11-08T10:00:00.000Z')
  let stage = DealStage.IN_PROGRESS
  let invoiceSentAt: Date | null = null
  let reservations = 0
  let updates = 0
  let events = 0
  const issue = (proposalCount: number) => issueDealInvoice({
    stage,
    proposalCount,
    invoiceSentAt,
    now,
    reserveInventory: async () => { reservations += 1 },
    updateInvoice: async (data) => { updates += 1; stage = data.stage; invoiceSentAt = data.invoiceSentAt },
    logTransition: async () => { events += 1 },
  })

  const first = await issue(1)
  assert.equal(first.allowed, true)
  assert.equal(reservations, 1)
  assert.equal(updates, 1)
  assert.equal(events, 1)
  assert.equal(stage, DealStage.INVOICE_SENT)
  assert.equal(invoiceSentAt?.toISOString(), now.toISOString())

  const retry = await issue(1)
  assert.equal(retry.allowed, true)
  assert.equal(reservations, 1, 'reissuing must not reserve inventory twice')
  assert.equal(updates, 2)
  assert.equal(events, 2)
  assert.equal(invoiceSentAt?.toISOString(), now.toISOString())
})

test('invoice with no proposal, invalid stage, or failed checks performs no side effects', async () => {
  const now = new Date('2026-11-08T10:00:00.000Z')
  let reservations = 0
  let updates = 0
  let events = 0
  const run = (stage: DealStage, proposalCount: number) => issueDealInvoice({
    stage,
    proposalCount,
    invoiceSentAt: null,
    now,
    reserveInventory: async () => { reservations += 1 },
    updateInvoice: async () => { updates += 1 },
    logTransition: async () => { events += 1 },
  })

  assert.deepEqual(await run(DealStage.IN_PROGRESS, 0), { allowed: false, reason: 'INVOICE_REQUIRES_PROPOSAL' })
  assert.deepEqual(await run(DealStage.PAID, 1), { allowed: false, reason: 'INVOICE_STAGE_INVALID' })
  assert.deepEqual({ reservations, updates, events }, { reservations: 0, updates: 0, events: 0 })
})

test('invoice after an explicit go-back does not reserve inventory twice when the original invoice timestamp remains', async () => {
  const firstInvoiceDate = new Date('2026-11-07T12:00:00.000Z')
  let reservations = 0
  let savedDate: Date | null = firstInvoiceDate
  const result = await issueDealInvoice({
    stage: DealStage.IN_PROGRESS,
    proposalCount: 2,
    invoiceSentAt: savedDate,
    now: new Date('2026-11-08T10:00:00.000Z'),
    reserveInventory: async () => { reservations += 1 },
    updateInvoice: async (data) => { savedDate = data.invoiceSentAt },
    logTransition: async () => undefined,
  })
  assert.equal(result.allowed, true)
  assert.equal(reservations, 0)
  assert.equal(savedDate?.toISOString(), firstInvoiceDate.toISOString())
})

test('partial payments retain invoice and financial fields; full payment advances to PAID; invalid stages are denied', () => {
  const partialDecision = decidePaymentWorkflow(DealStage.INVOICE_SENT, null, 'PARTIAL')
  assert.deepEqual(partialDecision, { allowed: true, nextStage: DealStage.INVOICE_SENT })
  if (!partialDecision.allowed) assert.fail('partial payment should be allowed for an issued invoice')
  assert.deepEqual(buildPaymentUpdate({ decision: partialDecision, paymentStatus: 'PARTIAL', paidAmount: 125, isOfficialPayment: true, now: new Date('2026-11-08T10:00:00Z') }), {
    stage: DealStage.INVOICE_SENT, paymentStatus: 'PARTIAL', paidAmount: 125, isOfficialPayment: true, paidAt: undefined,
  })

  const fullDecision = decidePaymentWorkflow(DealStage.INVOICE_SENT, 'PARTIAL', 'FULL')
  assert.deepEqual(fullDecision, { allowed: true, nextStage: DealStage.PAID })
  if (!fullDecision.allowed) assert.fail('full payment should be allowed for an issued invoice')
  assert.deepEqual(buildPaymentUpdate({ decision: fullDecision, paymentStatus: 'FULL', paidAmount: 500, now: new Date('2026-11-08T10:00:00Z') }), {
    stage: DealStage.PAID, paymentStatus: 'FULL', paidAmount: 500, isOfficialPayment: false, paidAt: new Date('2026-11-08T10:00:00Z'),
  })
  assert.deepEqual(decidePaymentWorkflow(DealStage.ASSEMBLY, null, 'FULL'), { allowed: false, reason: 'PAYMENT_REQUIRES_INVOICE' })
  assert.deepEqual(decidePaymentWorkflow(DealStage.ASSEMBLY, 'PARTIAL', 'FULL'), { allowed: true, nextStage: DealStage.PAID })
})
