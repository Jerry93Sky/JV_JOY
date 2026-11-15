import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { registerPlugins } from '../../src/plugins'
import { userRoutes } from '../../src/routes/users'
import { prisma } from '../../src/lib/prisma'

test('administrators cannot create or promote an OWNER through user endpoints', async () => {
  process.env.JWT_SECRET = 'r32-test-only-jwt-secret'
  const app = Fastify({ logger: false })
  await registerPlugins(app)
  await app.register(userRoutes, { prefix: '/api/users' })
  await app.ready()
  const token = app.jwt.sign({ id: 'test-admin', role: 'ADMIN' })
  const headers = { authorization: `Bearer ${token}` }
  const original = prisma.user.findUnique
  try {
    const create = await app.inject({ method: 'POST', url: '/api/users', headers, payload: { login: 'fake', password: 'fake', firstName: 'test', lastName: 'test', role: 'OWNER' } })
    assert.equal(create.statusCode, 403)
    prisma.user.findUnique = (async () => ({ id: 'other', role: 'USER' })) as typeof prisma.user.findUnique
    const promote = await app.inject({ method: 'PATCH', url: '/api/users/other', headers, payload: { role: 'OWNER' } })
    assert.equal(promote.statusCode, 403)
    prisma.user.findUnique = (async () => ({ id: 'owner-id', role: 'OWNER' })) as typeof prisma.user.findUnique
    const changeOwner = await app.inject({ method: 'PATCH', url: '/api/users/owner-id', headers, payload: { firstName: 'other' } })
    assert.equal(changeOwner.statusCode, 403)
    const ownerToken = app.jwt.sign({ id: 'owner-id', role: 'OWNER' })
    const selfDemotion = await app.inject({ method: 'PATCH', url: '/api/users/owner-id', headers: { authorization: `Bearer ${ownerToken}` }, payload: { role: 'USER' } })
    assert.equal(selfDemotion.statusCode, 403)
  } finally { prisma.user.findUnique = original; await app.close() }
})
