import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../lib/auth'
import { Role } from '@bms/shared'
import { addDays } from '../lib/dateUtils'

export async function receiptRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async () =>
    prisma.receipt.findMany({
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { date: 'desc' },
    })
  )

  app.get<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const r = await prisma.receipt.findUnique({
      where: { id: req.params.id },
      include: { supplier: true, items: { include: { product: true } } },
    })
    if (!r) return reply.status(404).send({ error: 'Не найден' })
    return r
  })

  app.post<{ Body: { supplierId: string; date?: string; items: { productId: string; quantity: number; costPrice: number }[] } }>(
    '/', { preHandler: requireAuth }, async (req, reply) => {
      const { supplierId, date, items } = req.body
      if (!supplierId || !items?.length) return reply.status(400).send({ error: 'Заполните обязательные поля' })

      const receiptDate = date ? new Date(date) : new Date()

      const receipt = await prisma.$transaction(async (tx) => {
        const r = await tx.receipt.create({
          data: {
            supplierId,
            date: receiptDate,
            editableUntil: addDays(new Date(), 10),
            items: { create: items.map(i => ({ productId: i.productId, quantity: i.quantity, costPrice: i.costPrice })) },
          },
          include: { supplier: true, items: { include: { product: true } } },
        })
        // Обновляем количество и закупочную цену товаров
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: { increment: item.quantity },
              // Закупочная цена = цена последнего прихода, пересчитываем отпускную
            },
          })
          // Получаем текущие наценки и обновляем обе цены
          const product = await tx.product.findUnique({ where: { id: item.productId } })
          if (product) {
            const newRetail = item.costPrice * (1 + Number(product.markupRetail) / 100)
            const newWholesale = item.costPrice * (1 + Number(product.markupWholesale) / 100)
            await tx.product.update({
              where: { id: item.productId },
              data: { priceRetail: newRetail, priceWholesale: newWholesale },
            })
          }
        }
        return r
      })

      return reply.status(201).send(receipt)
    }
  )

  // Редактирование — только admin, только в течение 10 дней
  app.patch<{ Params: { id: string }; Body: { date?: string; items?: { productId: string; quantity: number; costPrice: number }[] } }>(
    '/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const receipt = await prisma.receipt.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      })
      if (!receipt) return reply.status(404).send({ error: 'Не найден' })
      if (new Date() > receipt.editableUntil) return reply.status(403).send({ error: 'Срок редактирования истёк (10 дней)' })

      const { date, items } = req.body

      await prisma.$transaction(async (tx) => {
        if (date) await tx.receipt.update({ where: { id: req.params.id }, data: { date: new Date(date) } })

        if (items) {
          // Откатываем старые количества
          for (const old of receipt.items) {
            await tx.product.update({ where: { id: old.productId }, data: { quantity: { decrement: Number(old.quantity) } } })
          }
          await tx.receiptItem.deleteMany({ where: { receiptId: req.params.id } })
          // Применяем новые
          for (const item of items) {
            await tx.receiptItem.create({ data: { receiptId: req.params.id, ...item } })
            await tx.product.update({ where: { id: item.productId }, data: { quantity: { increment: item.quantity } } })
          }
        }
      })

      return prisma.receipt.findUnique({
        where: { id: req.params.id },
        include: { supplier: true, items: { include: { product: true } } },
      })
    }
  )
}
