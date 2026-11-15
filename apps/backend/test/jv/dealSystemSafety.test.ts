import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { registerPlugins } from '../../src/plugins'
import { dealRoutes } from '../../src/routes/deals'
import { prisma } from '../../src/lib/prisma'

test('system edits preserve calculation data when omitted and reject locked or foreign deals', async () => {
  process.env.JWT_SECRET = 'r33-deal-test-only'
  const app = Fastify({ logger: false }); await registerPlugins(app); await app.register(dealRoutes, { prefix: '/api/deals' }); await app.ready()
  const headers = { authorization: `Bearer ${app.jwt.sign({ id: 'user', role: 'USER' })}` }
  const originals = { findDeal: prisma.deal.findUnique, findSystem: prisma.dealSystem.findUnique, update: prisma.dealSystem.update, deleteMany: prisma.dealItem.deleteMany, event: prisma.dealEvent.create, transaction: prisma.$transaction }
  let stage = 'APPLICATION', belongsTo = 'deal', updateData: Record<string, unknown> | undefined, deletes = 0
  try {
    prisma.deal.findUnique = (async () => ({ id: 'deal', stage })) as typeof prisma.deal.findUnique
    prisma.dealSystem.findUnique = (async () => ({ id: 'system', dealId: belongsTo })) as typeof prisma.dealSystem.findUnique
    prisma.dealSystem.update = (async (arg: { data: Record<string, unknown> }) => { updateData = arg.data; return {} }) as typeof prisma.dealSystem.update
    prisma.dealItem.deleteMany = (async () => { deletes++; return { count: 0 } }) as typeof prisma.dealItem.deleteMany
    prisma.dealEvent.create = (async () => ({})) as typeof prisma.dealEvent.create
    prisma.$transaction = (async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)) as typeof prisma.$transaction
    const send = () => app.inject({ method: 'PATCH', url: '/api/deals/deal/systems/system', headers, payload: { inputParams: { width: 1 } } })
    assert.equal((await send()).statusCode, 200); assert.equal('calcParams' in updateData!, false); assert.equal(deletes, 0)
    stage = 'ASSEMBLY'; assert.equal((await send()).statusCode, 403)
    stage = 'APPLICATION'; belongsTo = 'other'; assert.equal((await send()).statusCode, 404)
  } finally {
    prisma.deal.findUnique = originals.findDeal; prisma.dealSystem.findUnique = originals.findSystem; prisma.dealSystem.update = originals.update; prisma.dealItem.deleteMany = originals.deleteMany; prisma.dealEvent.create = originals.event; prisma.$transaction = originals.transaction; await app.close()
  }
})
