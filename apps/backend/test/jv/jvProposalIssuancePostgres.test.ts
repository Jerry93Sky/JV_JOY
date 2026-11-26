import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import Fastify from 'fastify'
import { Role } from '@prisma/client'
import { registerPlugins } from '../../src/plugins'
import { userRoutes } from '../../src/routes/users'
import { jvOrderPersistenceRoutes } from '../../src/routes/jvOrders'
import { jvProposalIssuanceRoutes } from '../../src/routes/jvProposalIssuance'
import { getJvUiFormConfig } from '../../src/domain/jv/jvCalculationService'
import { prisma } from '../../src/lib/prisma'

test('only a current OWNER or ENGINEER can issue an approved snapshot once', async () => {
  process.env.JWT_SECRET = 'r56-isolated-test-only'
  const app = Fastify()
  await registerPlugins(app)
  await app.register(userRoutes, { prefix: '/api/users' })
  await app.register(jvOrderPersistenceRoutes, { prefix: '/api/jv' })
  await app.register(jvProposalIssuanceRoutes, { prefix: '/api/jv' })
  await app.ready()
  const prefix = `r56-${randomUUID()}`
  const claims = (id: string, role: Role) => ({ authorization: `Bearer ${app.jwt.sign({ id, role })}` })
  let orderId: string | undefined
  try {
    const createUser = (role: Role) => prisma.user.create({
      data: { login: `${prefix}-${role}`, password: 'isolated-fixture', firstName: 'Test', lastName: role, role },
    })
    const [owner, admin, other, guest] = await Promise.all([Role.OWNER, Role.ADMIN, Role.USER, Role.GUEST].map(createUser))
    const ownerHeaders = claims(owner.id, Role.OWNER)
    const adminHeaders = claims(admin.id, Role.ADMIN)
    const request = async (method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, status: number, payload?: object, headers = ownerHeaders) => {
      const response = await app.inject({ method, url, headers, payload })
      assert.equal(response.statusCode, status, response.body)
      return response.json()
    }
    const account = { login: `${prefix}-engineer`, firstName: 'Test', lastName: 'Engineer', password: 'isolated-fixture', role: Role.ENGINEER }
    await request('POST', '/api/users', 403, account, adminHeaders)
    await request('PATCH', `/api/users/${other.id}`, 403, { role: Role.ENGINEER }, adminHeaders)
    const engineer = await request('POST', '/api/users', 201, account)
    assert.equal(engineer.role, Role.ENGINEER)
    await request('PATCH', `/api/users/${engineer.id}`, 403, { password: 'forged-reset' }, adminHeaders)
    const engineerHeaders = claims(engineer.id, Role.ENGINEER)
    await request('PATCH', `/api/users/${other.id}`, 403, { role: Role.ENGINEER }, engineerHeaders)
    const [deal, otherDeal] = await Promise.all(['initial', 'later'].map(suffix => prisma.deal.create({
      data: { number: `${prefix}-${suffix}`, direction: 'PRIVATE', creatorId: owner.id, assigneeId: owner.id },
    })))
    const dealQuotes = (id: string) => `/api/jv/deals/${id}/issued-proposals`
    await request('GET', dealQuotes(deal.id), 403, undefined, adminHeaders)
    await request('GET', dealQuotes(deal.id), 403, undefined, claims(guest.id, Role.GUEST))
    await request('GET', dealQuotes('missing'), 404, undefined, engineerHeaders)
    await request('GET', `${dealQuotes(deal.id)}?before=-1`, 400, undefined, engineerHeaders)
    const config = getJvUiFormConfig('RETAIL')
    const draft = {
      dealId: deal.id, profile: 'RETAIL', uiSchemaVersion: config.schemaVersion, rulesVersion: config.rulesVersion,
      positions: [{ id: 'one', family: 'LINE', slot: 1, quantity: '1', inputs: config.families.LINE }],
    }
    const order = await request('POST', '/api/jv/orders', 201, draft)
    orderId = order.id
    const orderPath = `/api/jv/orders/${order.id}`
    await request('GET', orderPath, 403, undefined, engineerHeaders)
    const snapshot = await request('POST', `${orderPath}/calculation-snapshots`, 201, { version: 1 })
    const draftPath = `${orderPath}/proposal-drafts`
    const blank = await request('POST', draftPath, 201, { snapshotId: snapshot.id })
    const terms = { recipient: 'Контрольный клиент', requisites: 'Реквизиты', payment: 'Предоплата', timeframe: 'Три дня', delivery: 'Самовывоз' }
    const revise = () => request('POST', `${draftPath}/${blank.id}/revise`, 201, { terms })
    const proposal = await revise()
    const review = `${draftPath}/${proposal.id}/review`
    const queue = '/api/jv/proposal-issuance'
    const detail = `${queue}/${proposal.id}`, issue = `${detail}/issue`
    assert.equal((await app.inject({ method: 'GET', url: queue })).statusCode, 401)
    for (const headers of [adminHeaders, claims(other.id, Role.USER), claims(guest.id, Role.GUEST)]) {
      await request('GET', queue, 403, undefined, headers)
      await request('POST', issue, 403, undefined, headers)
    }
    await request('GET', `${queue}?before=invalid`, 400, undefined, engineerHeaders)
    await request('GET', detail, 404, undefined, engineerHeaders)
    assert.equal((await request('POST', issue, 409, undefined, engineerHeaders)).error.code, 'PROPOSAL_NOT_APPROVED')
    await request('POST', review, 201, { action: 'SUBMIT' })
    await request('POST', review, 403, { action: 'APPROVE' }, engineerHeaders)
    await request('POST', issue, 409, undefined, engineerHeaders)
    await request('POST', review, 201, { action: 'APPROVE' })
    const ready = await request('GET', queue, 200, undefined, engineerHeaders)
    assert.equal(ready.items.find((row: { id: string }) => row.id === proposal.id).issue, null)
    assert.equal(ready.items.some((row: { id: string }) => row.id === blank.id), false)
    const preview = await request('GET', detail, 200, undefined, engineerHeaders)
    assert.deepEqual(Object.keys(preview).sort(), ['deal', 'issue', 'number', 'payload'])
    assert.deepEqual(preview.deal, { id: deal.id, number: deal.number })
    assert.deepEqual(preview.payload.terms, terms)
    assert.deepEqual(await request('GET', dealQuotes(deal.id), 200, undefined, engineerHeaders), { items: [], next: null })
    await request('POST', issue, 400, { totalSalePrice: '1' }, engineerHeaders)

    const issues = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url: issue, headers: engineerHeaders })))
    assert.deepEqual(issues.map(response => response.statusCode).sort(), [200, 201])
    assert.deepEqual(issues[0].json(), issues[1].json())
    const saved = await prisma.jvProposalIssue.findUniqueOrThrow({ where: { proposalId: proposal.id } })
    assert.equal(saved.issuerId, engineer.id)
    assert.equal(saved.issuerRole, Role.ENGINEER)
    assert.equal(saved.proposalSha256, proposal.contentSha256)
    assert.deepEqual((await request('GET', detail, 200)).payload, preview.payload)
    assert.deepEqual((await request('GET', detail, 200)).issue, issues[0].json())
    assert.deepEqual(preview.payload.totalSalePrice, snapshot.result.calculation.totalSalePrice)
    await request('PUT', orderPath, 200, { version: 1, draft: { ...draft, dealId: otherDeal.id } })
    const reopened = await request('GET', detail, 200)
    assert.deepEqual(reopened.payload, preview.payload)
    assert.deepEqual(reopened.deal, { id: deal.id, number: deal.number })
    const historical = await request('GET', dealQuotes(deal.id), 200, undefined, engineerHeaders)
    assert.deepEqual(historical, {
      items: [{ proposalId: proposal.id, number: saved.number, issuedAt: saved.issuedAt.toISOString(),
        orderNumber: order.number, totalSalePrice: preview.payload.totalSalePrice }],
      next: null,
    })
    assert.deepEqual(await request('GET', dealQuotes(otherDeal.id), 200), { items: [], next: null })
    assert.deepEqual(await request('GET', `${dealQuotes(deal.id)}?before=${saved.number}`, 200), { items: [], next: null })

    const next = await revise()
    const nextReview = `${draftPath}/${next.id}/review`
    const nextIssue = `${queue}/${next.id}/issue`
    await request('POST', nextReview, 201, { action: 'SUBMIT' })
    await request('POST', nextReview, 201, { action: 'APPROVE' })
    await prisma.jvCalculationSnapshot.update({ where: { id: snapshot.id }, data: { contentSha256: '0'.repeat(64) } })
    assert.equal((await request('POST', nextIssue, 409)).error.code, 'SNAPSHOT_INTEGRITY_FAILED')
    assert.deepEqual(await request('GET', dealQuotes(deal.id), 200), { items: [], next: null })
    assert.equal((await request('GET', detail, 200)).deal, null)
    assert.deepEqual((await request('GET', detail, 200)).payload, preview.payload)
    await prisma.jvCalculationSnapshot.update({ where: { id: snapshot.id }, data: { contentSha256: snapshot.contentSha256 } })
    await request('PATCH', `/api/users/${engineer.id}`, 200, { role: Role.USER })
    await request('GET', detail, 403, undefined, engineerHeaders)
    await request('GET', dealQuotes(deal.id), 403, undefined, engineerHeaders)
    await request('POST', nextIssue, 403, undefined, engineerHeaders)
    const ownerIssue = await request('POST', nextIssue, 201)
    assert.ok(ownerIssue.number > saved.number)
    assert.equal((await prisma.jvProposalIssue.findUniqueOrThrow({ where: { proposalId: next.id } })).issuerRole, Role.OWNER)
    const resultingDeal = await request('GET', dealQuotes(deal.id), 200)
    assert.deepEqual(resultingDeal.items.map((row: { number: number }) => row.number), [ownerIssue.number, saved.number])
    await prisma.jvProposalIssue.update({ where: { proposalId: proposal.id }, data: { contentSha256: '0'.repeat(64) } })
    assert.equal((await request('GET', detail, 409)).error.code, 'ISSUE_INTEGRITY_FAILED')
  } finally {
    if (orderId) {
      await prisma.jvProposalIssue.deleteMany({ where: { proposal: { orderId } } })
      await prisma.jvProposalDraft.deleteMany({ where: { orderId } })
      await prisma.jvCalculationSnapshot.deleteMany({ where: { orderId } })
      await prisma.jvOrder.delete({ where: { id: orderId } })
    }
    await prisma.deal.deleteMany({ where: { number: { startsWith: prefix } } })
    await prisma.user.deleteMany({ where: { login: { startsWith: prefix } } })
    await app.close()
    await prisma.$disconnect()
  }
})
