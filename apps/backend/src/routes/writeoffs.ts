import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../lib/auth'
import { Role, WriteoffReason } from '@bms/shared'
import { addDays } from '../lib/dateUtils'

export async function writeoffRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async () =>
    prisma.writeoff.findMany({
      include: { items: { include: { product: true } } },
      orderBy: { date: 'desc' },
    })
  )

  app.post<{ Body: { reason: WriteoffReason; comment: string; items: { productId: string; quantity: number }[] } }>(
    '/', { preHandler: requireAuth }, async (req, reply) => {
      const { reason, comment, items } = req.body
      if (!reason || !comment || !items?.length) return reply.status(400).send({ error: 'Заполните все поля' })

      const writeoff = await prisma.$transaction(async (tx) => {
        const w = await tx.writeoff.create({
          data: {
            reason,
            comment,
            editableUntil: addDays(new Date(), 10),
            items: { create: items.map(i => ({ productId: i.productId, quantity: i.quantity })) },
          },
          include: { items: { include: { product: true } } },
        })
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { decrement: item.quantity } },
          })
        }
        return w
      })

      return reply.status(201).send(writeoff)
    }
  )

  app.patch<{ Params: { id: string }; Body: { comment?: string; items?: { productId: string; quantity: number }[] } }>(
    '/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const writeoff = await prisma.writeoff.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      })
      if (!writeoff) return reply.status(404).send({ error: 'Не найден' })
      if (new Date() > writeoff.editableUntil) return reply.status(403).send({ error: 'Срок редактирования истёк (10 дней)' })

      const { comment, items } = req.body

      await prisma.$transaction(async (tx) => {
        if (comment) await tx.writeoff.update({ where: { id: req.params.id }, data: { comment } })
        if (items) {
          for (const old of writeoff.items) {
            await tx.product.update({ where: { id: old.productId }, data: { quantity: { increment: Number(old.quantity) } } })
          }
          await tx.writeoffItem.deleteMany({ where: { writeoffId: req.params.id } })
          for (const item of items) {
            await tx.writeoffItem.create({ data: { writeoffId: req.params.id, ...item } })
            await tx.product.update({ where: { id: item.productId }, data: { quantity: { decrement: item.quantity } } })
          }
        }
      })

      return prisma.writeoff.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { product: true } } },
      })
    }
  )
}
