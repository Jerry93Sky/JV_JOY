import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../lib/auth'
import { CompanyType } from '@bms/shared'

export async function companyRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string } }>('/', { preHandler: requireAuth }, async (req) => {
    const { q } = req.query
    return prisma.company.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      include: {
        bankAccounts: true,
        contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
      },
      orderBy: { name: 'asc' },
    })
  })

  app.get<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        bankAccounts: true,
        contacts: { include: { contact: true } },
        files: true,
        relatedFrom: { include: { to: { select: { id: true, name: true } } } },
        relatedTo: { include: { from: { select: { id: true, name: true } } } },
        deals: {
          select: { id: true, number: true, stage: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!company) return reply.status(404).send({ error: 'Не найдена' })

    // Оборот за прошлый год
    const now = new Date()
    const yearStart = new Date(now.getFullYear() - 1, 0, 1)
    const yearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
    const paidDeals = await prisma.deal.findMany({
      where: {
        companyId: req.params.id,
        stage: { in: ['PAID', 'ASSEMBLY', 'PAINTING', 'INSTALL_FIRST', 'INSTALL_SECOND', 'SHIPMENT', 'DOCS', 'COMPLETED'] },
        updatedAt: { gte: yearStart, lte: yearEnd },
      },
      include: { items: true, services: true },
    })

    const turnover = paidDeals.reduce((sum, deal) => {
      const itemsTotal = deal.items.reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0)
      const servicesTotal = deal.services.reduce((s, sv) => s + Number(sv.unitPrice) * sv.quantity, 0)
      return sum + itemsTotal + servicesTotal
    }, 0)

    // Скидка по порогам
    const thresholds = await prisma.discountThreshold.findMany({ orderBy: { minTurnover: 'desc' } })
    const discount = thresholds.find((t) => turnover >= Number(t.minTurnover))

    // Скидка: ручная имеет приоритет над автоматической
    const effectiveDiscount = company.manualDiscountPct != null
      ? Number(company.manualDiscountPct)
      : (discount ? Number(discount.discountPct) : 0)

    return { ...company, turnoverLastYear: turnover, currentDiscount: effectiveDiscount, isManualDiscount: company.manualDiscountPct != null }
  })

  app.post<{ Body: { name: string; type: CompanyType; inn?: string; ogrn?: string; bankAccounts?: { accountNum: string; bik: string }[]; relatedCompanyIds?: string[] } }>(
    '/', { preHandler: requireAuth }, async (req, reply) => {
      const { bankAccounts, relatedCompanyIds, ...data } = req.body
      if (!data.name || !data.type) return reply.status(400).send({ error: 'Заполните обязательные поля' })

      // Проверка уникальности ИНН
      if (data.inn) {
        const existing = await prisma.company.findFirst({ where: { inn: data.inn } })
        if (existing) return reply.status(409).send({ error: `ИНН уже используется компанией "${existing.name}"` })
      }
      // Проверка уникальности ОГРН
      if (data.ogrn) {
        const existing = await prisma.company.findFirst({ where: { ogrn: data.ogrn } })
        if (existing) return reply.status(409).send({ error: `ОГРН уже используется компанией "${existing.name}"` })
      }

      const company = await prisma.company.create({
        data: {
          ...data,
          bankAccounts: bankAccounts?.length ? { create: bankAccounts } : undefined,
          relatedFrom: relatedCompanyIds?.length ? {
            create: relatedCompanyIds.map((toId) => ({ toId })),
          } : undefined,
        },
        include: { bankAccounts: true },
      })
      return reply.status(201).send(company)
    }
  )

  app.patch<{ Params: { id: string }; Body: { name?: string; type?: CompanyType; inn?: string; ogrn?: string; bankAccounts?: { accountNum: string; bik: string }[] } }>(
    '/:id', { preHandler: requireAuth }, async (req, reply) => {
      const { bankAccounts, ...data } = req.body
      const company = await prisma.company.findUnique({ where: { id: req.params.id } })
      if (!company) return reply.status(404).send({ error: 'Не найдена' })

      if (bankAccounts !== undefined) {
        await prisma.bankAccount.deleteMany({ where: { companyId: req.params.id } })
        if (bankAccounts.length) {
          await prisma.bankAccount.createMany({
            data: bankAccounts.map((b) => ({ ...b, companyId: req.params.id })),
          })
        }
      }

      return prisma.company.update({
        where: { id: req.params.id },
        data,
        include: { bankAccounts: true },
      })
    }
  )

  app.delete<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } })
    if (!company) return reply.status(404).send({ error: 'Не найдена' })
    await prisma.company.delete({ where: { id: req.params.id } })
    return { ok: true }
  })

  // Привязать связанную компанию
  app.post<{ Params: { id: string }; Body: { relatedId: string } }>(
    '/:id/related', { preHandler: requireAuth }, async (req, reply) => {
      const { id } = req.params
      const { relatedId } = req.body
      if (id === relatedId) return reply.status(400).send({ error: 'Нельзя привязать компанию к себе' })
      const existing = await prisma.companyRelation.findFirst({ where: { OR: [{ fromId: id, toId: relatedId }, { fromId: relatedId, toId: id }] } })
      if (existing) return reply.status(409).send({ error: 'Связь уже существует' })
      await prisma.companyRelation.create({ data: { fromId: id, toId: relatedId } })
      return { ok: true }
    }
  )
}
