import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../lib/auth'
import { Role } from '@bms/shared'

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async () => {
    const settings = await prisma.setting.findMany()
    return Object.fromEntries(settings.map(s => [s.key, s.value]))
  })

  app.patch<{ Body: Record<string, string> }>('/', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
    for (const [key, value] of Object.entries(req.body)) {
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    }
    return { ok: true }
  })

  // Услуги
  app.get('/services', { preHandler: requireAuth }, async () => {
    const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    console.log('Services with formulas:', services.filter(s => s.priceFormula).map(s => `${s.name}: ${s.priceFormula}`))
    return services
  })
  app.post<{ Body: { name: string; price?: number | null; priceFormula?: string | null; unit?: string; affectedByDiscount?: boolean } }>(
    '/services', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const data: Record<string, unknown> = { ...req.body }
      if (data.priceFormula) data.price = null
      if (data.price !== undefined && data.price !== null && !data.priceFormula) data.priceFormula = null
      return reply.status(201).send(await prisma.service.create({ data: data as never }))
    }
  )
  app.patch<{ Params: { id: string }; Body: { name?: string; price?: number | null; priceFormula?: string | null; unit?: string; isActive?: boolean; affectedByDiscount?: boolean } }>(
    '/services/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
      const data: Record<string, unknown> = { ...req.body }
      // Если передана формула — обнуляем фиксированную цену
      if (data.priceFormula) data.price = null
      // Если передана фиксированная цена — обнуляем формулу
      if (data.price !== undefined && data.price !== null && !data.priceFormula) data.priceFormula = null
      return prisma.service.update({ where: { id: req.params.id }, data: data as never })
    }
  )

  // Пороги скидок
  app.get('/discount-thresholds', { preHandler: requireAuth }, async () =>
    prisma.discountThreshold.findMany({ orderBy: { minTurnover: 'asc' } })
  )
  app.post<{ Body: { minTurnover: number; discountPct: number } }>(
    '/discount-thresholds', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      return reply.status(201).send(await prisma.discountThreshold.create({ data: req.body }))
    }
  )
  app.delete<{ Params: { id: string } }>(
    '/discount-thresholds/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
      await prisma.discountThreshold.delete({ where: { id: req.params.id } })
      return { ok: true }
    }
  )
}
