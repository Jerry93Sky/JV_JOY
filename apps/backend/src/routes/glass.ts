import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../lib/auth'
import { requireRole } from '../lib/auth'
import { Role } from '@prisma/client'

export async function glassRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async () =>
    prisma.glassType.findMany({ orderBy: [{ thickness: 'asc' }, { glassKind: 'asc' }, { coating: 'asc' }] })
  )

  app.post<{ Body: {
    thickness: number; coating: string; glassKind: string
    costPricePerSqm: number; sellingPricePerSqm: number; deliveryCostFixed?: number
    costPriceWithCuts?: number | null; sellingPriceWithCuts?: number | null; surchargeWithCutsPct?: number | null
    costPriceWithHoles?: number | null; sellingPriceWithHoles?: number | null; surchargeWithHolesPct?: number | null
  } }>(
    '/', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const { thickness, coating, glassKind, costPricePerSqm, sellingPricePerSqm, deliveryCostFixed,
        costPriceWithCuts, sellingPriceWithCuts, surchargeWithCutsPct,
        costPriceWithHoles, sellingPriceWithHoles, surchargeWithHolesPct } = req.body
      if (!thickness || !coating || !glassKind) return reply.status(400).send({ error: 'Заполните все поля' })
      return reply.status(201).send(await prisma.glassType.create({
        data: {
          thickness, coating, glassKind, costPricePerSqm, sellingPricePerSqm,
          deliveryCostFixed: deliveryCostFixed ?? 0,
          costPriceWithCuts: costPriceWithCuts ?? null,
          sellingPriceWithCuts: sellingPriceWithCuts ?? null,
          surchargeWithCutsPct: surchargeWithCutsPct ?? null,
          costPriceWithHoles: costPriceWithHoles ?? null,
          sellingPriceWithHoles: sellingPriceWithHoles ?? null,
          surchargeWithHolesPct: surchargeWithHolesPct ?? null,
        }
      }))
    }
  )

  app.patch<{ Params: { id: string }; Body: Partial<{
    thickness: number; coating: string; glassKind: string
    costPricePerSqm: number; sellingPricePerSqm: number; deliveryCostFixed: number
    costPriceWithCuts: number | null; sellingPriceWithCuts: number | null; surchargeWithCutsPct: number | null
    costPriceWithHoles: number | null; sellingPriceWithHoles: number | null; surchargeWithHolesPct: number | null
    isActive: boolean
  }> }>(
    '/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const gt = await prisma.glassType.findUnique({ where: { id: req.params.id } })
      if (!gt) return reply.status(404).send({ error: 'Не найден' })
      return prisma.glassType.update({ where: { id: req.params.id }, data: req.body as never })
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      await prisma.glassType.delete({ where: { id: req.params.id } })
      return { ok: true }
    }
  )
}
