import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../lib/auth'
import { requireRole } from '../lib/auth'
import { Role } from '@prisma/client'

export async function vendorRoutes(app: FastifyInstance) {
  // ── Категории поставщиков ─────────────────────────────────────────────────

  app.get('/categories', { preHandler: requireAuth }, async () =>
    prisma.vendorCategory.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { vendors: true } } } })
  )

  app.post<{ Body: { name: string } }>(
    '/categories', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      if (!req.body.name?.trim()) return reply.status(400).send({ error: 'Укажите название' })
      return reply.status(201).send(await prisma.vendorCategory.create({ data: { name: req.body.name.trim() } }))
    }
  )

  app.delete<{ Params: { catId: string } }>(
    '/categories/:catId', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const count = await prisma.vendor.count({ where: { categoryId: req.params.catId } })
      if (count > 0) return reply.status(400).send({ error: 'Нельзя удалить категорию с поставщиками' })
      await prisma.vendorCategory.delete({ where: { id: req.params.catId } })
      return { ok: true }
    }
  )

  // ── Поставщики ────────────────────────────────────────────────────────────

  app.get<{ Querystring: { categoryId?: string; isPainting?: string } }>(
    '/', { preHandler: requireAuth }, async (req) => {
      const { categoryId, isPainting } = req.query
      return prisma.vendor.findMany({
        where: {
          ...(categoryId ? { categoryId } : {}),
          ...(isPainting === 'true' ? { isPainting: true } : {}),
        },
        include: { category: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      })
    }
  )

  app.post<{ Body: {
    name: string; categoryId: string; phone?: string; email?: string
    address?: string; comment?: string; isPainting?: boolean; isDefault?: boolean
  } }>(
    '/', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const { name, categoryId, phone, email, address, comment, isPainting, isDefault } = req.body
      if (!name?.trim() || !categoryId) return reply.status(400).send({ error: 'Заполните обязательные поля' })

      // Если isDefault — снимаем флаг с остальных в категории
      if (isDefault) {
        await prisma.vendor.updateMany({ where: { categoryId }, data: { isDefault: false } })
      }

      return reply.status(201).send(await prisma.vendor.create({
        data: { name: name.trim(), categoryId, phone, email, address, comment, isPainting: isPainting ?? false, isDefault: isDefault ?? false },
        include: { category: true },
      }))
    }
  )

  app.patch<{ Params: { id: string }; Body: Partial<{
    name: string; categoryId: string; phone: string; email: string
    address: string; comment: string; isPainting: boolean; isDefault: boolean; isActive: boolean
  }> }>(
    '/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } })
      if (!vendor) return reply.status(404).send({ error: 'Не найден' })

      // Если устанавливаем isDefault — снимаем с остальных в той же категории
      if (req.body.isDefault) {
        const catId = req.body.categoryId ?? vendor.categoryId
        await prisma.vendor.updateMany({ where: { categoryId: catId, id: { not: req.params.id } }, data: { isDefault: false } })
      }

      return prisma.vendor.update({ where: { id: req.params.id }, data: req.body as never, include: { category: true } })
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      await prisma.vendor.delete({ where: { id: req.params.id } })
      return { ok: true }
    }
  )
}
