import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../lib/auth'

export async function supplierRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async () =>
    prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  )
  app.post<{ Body: { name: string } }>('/', { preHandler: requireAuth }, async (req, reply) => {
    if (!req.body.name) return reply.status(400).send({ error: 'Укажите название' })
    return reply.status(201).send(await prisma.supplier.create({ data: { name: req.body.name } }))
  })
}
