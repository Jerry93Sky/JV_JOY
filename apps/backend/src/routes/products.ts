import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../lib/auth'
import { Role } from '@bms/shared'

export async function productRoutes(app: FastifyInstance) {
  // Типы комплектующих
  app.get('/types', { preHandler: requireAuth }, async () =>
    prisma.productType.findMany({ orderBy: { order: 'asc' } })
  )
  app.post<{ Body: { name: string } }>('/types', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
    const { name } = req.body
    if (!name) return reply.status(400).send({ error: 'Укажите название' })
    // Новый тип добавляется в конец
    const maxOrder = await prisma.productType.aggregate({ _max: { order: true } })
    const nextOrder = (maxOrder._max.order ?? -1) + 1
    return reply.status(201).send(await prisma.productType.create({ data: { name, order: nextOrder } }))
  })
  app.delete<{ Params: { id: string } }>('/types/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
    await prisma.productType.delete({ where: { id: req.params.id } })
    return { ok: true }
  })
  // Переупорядочить типы
  app.post<{ Body: { ids: string[] } }>(
    '/types/reorder', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
      await prisma.$transaction(
        req.body.ids.map((id, idx) => prisma.productType.update({ where: { id }, data: { order: idx } }))
      )
      return { ok: true }
    }
  )

  // Товары
  app.get<{ Querystring: { q?: string; typeId?: string } }>('/', { preHandler: requireAuth }, async (req) => {
    const { q, typeId } = req.query
    return prisma.product.findMany({
      where: {
        isActive: true,
        ...(typeId ? { typeId } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      include: { type: true },
      orderBy: { name: 'asc' },
    })
  })

  app.get<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const p = await prisma.product.findUnique({ where: { id: req.params.id }, include: { type: true } })
    if (!p) return reply.status(404).send({ error: 'Не найден' })
    return p
  })

  app.post<{ Body: { sku: string; name: string; typeId: string; unit: string; isPaintable?: boolean; affectedByDiscount?: boolean; minStockLevel?: number; bundleLength?: number; paintingPricePerUnit?: number; paintingPricePerMeter?: number; markupRetail?: number; markupWholesale?: number; priceRetail?: number; priceWholesale?: number } }>(
    '/', { preHandler: requireAuth }, async (req, reply) => {
      const { sku, name, typeId, unit } = req.body
      if (!sku || !name || !typeId || !unit) return reply.status(400).send({ error: 'Заполните обязательные поля' })
      const exists = await prisma.product.findUnique({ where: { sku } })
      if (exists) return reply.status(409).send({ error: 'Артикул уже существует' })
      return reply.status(201).send(await prisma.product.create({
        data: { ...req.body },
        include: { type: true },
      }))
    }
  )

  app.patch<{ Params: { id: string }; Body: { name?: string; typeId?: string; unit?: string; isPaintable?: boolean; affectedByDiscount?: boolean; minStockLevel?: number | null; bundleLength?: number | null; paintingPricePerUnit?: number | null; paintingPricePerMeter?: number | null; markupRetail?: number; markupWholesale?: number; priceRetail?: number; priceWholesale?: number; isActive?: boolean } }>(
    '/:id', { preHandler: requireAuth }, async (req, reply) => {
      const p = await prisma.product.findUnique({ where: { id: req.params.id } })
      if (!p) return reply.status(404).send({ error: 'Не найден' })
      const { typeId, ...rest } = req.body
      const data: Record<string, unknown> = { ...rest }
      if (typeId) data.type = { connect: { id: typeId } }
      if ('bundleLength' in data && !data.bundleLength) data.bundleLength = null
      if ('minStockLevel' in data && !data.minStockLevel) data.minStockLevel = null
      if ('paintingPricePerUnit' in data && !data.paintingPricePerUnit) data.paintingPricePerUnit = null
      if ('paintingPricePerMeter' in data && !data.paintingPricePerMeter) data.paintingPricePerMeter = null
      try {
        return await prisma.product.update({ where: { id: req.params.id }, data: data as never, include: { type: true } })
      } catch (e) {
        console.error('Product update error:', e)
        return reply.status(500).send({ error: String((e as Error).message) })
      }
    }
  )
}
