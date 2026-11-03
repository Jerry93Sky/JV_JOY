import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../lib/auth'

export async function financeRoutes(app: FastifyInstance) {
  // Сводка за период (поддерживает сравнение двух периодов)
  app.get<{ Querystring: { from: string; to: string; compareFrom?: string; compareTo?: string } }>(
    '/summary', { preHandler: requireAuth }, async (req, reply) => {
      const { from, to, compareFrom, compareTo } = req.query
      if (!from || !to) return reply.status(400).send({ error: 'Укажите период' })

      async function calcSummary(dateFrom: Date, dateTo: Date) {
        const end = new Date(dateTo); end.setHours(23, 59, 59)
        const deals = await prisma.deal.findMany({
          where: {
            isLead: false,
            paymentStatus: { not: null },
            updatedAt: { gte: dateFrom, lte: end },
            stage: { notIn: ['APPLICATION', 'CALCULATION', 'PROPOSAL', 'AWAITING_PAYMENT', 'FAILED'] },
          },
          include: { items: true, services: true },
        })

        const expenses = await prisma.expense.findMany({
          where: { date: { gte: dateFrom, lte: end } },
          include: { category: true },
        })

        let grossRevenue = 0, costOfGoods = 0
        for (const deal of deals) {
          const itemsRevenue = deal.items.reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0)
          const servicesRevenue = deal.services.reduce((s, sv) => s + Number(sv.unitPrice) * sv.quantity, 0)
          const agentFee = deal.isAgentOrder && deal.agentPercent ? (itemsRevenue + servicesRevenue) * (Number(deal.agentPercent) / 100) : 0

          // Стёкла из calcParams систем
          const dealSystems = await prisma.dealSystem.findMany({ where: { dealId: deal.id } })
          let glassRevenue = 0, glassCost = 0, installRevenue = 0, installCost = 0
          for (const ds of dealSystems) {
            const cp = (ds.calcParams || {}) as Record<string, unknown>
            const glasses = cp['__glasses__'] as Array<{ sellingTotal: number; costTotal: number }> | undefined
            if (glasses) {
              glassRevenue += glasses.reduce((s, g) => s + (g.sellingTotal || 0), 0)
              glassCost += glasses.reduce((s, g) => s + (g.costTotal || 0), 0)
            }
            const inst = cp['__install__'] as { sellingPrice: number; costPrice: number } | undefined
            if (inst) {
              installRevenue += inst.sellingPrice || 0
              installCost += inst.costPrice || 0
            }
          }

          grossRevenue += itemsRevenue + servicesRevenue + agentFee + glassRevenue + installRevenue
          costOfGoods += glassCost + installCost

          for (const item of deal.items) {
            const lastReceipt = await prisma.receiptItem.findFirst({ where: { productId: item.productId }, orderBy: { receipt: { date: 'desc' } } })
            if (lastReceipt) costOfGoods += Number(lastReceipt.costPrice) * Number(item.quantity)
          }
          // Старая ручная цена стекла (legacy)
          if (deal.glassCostPrice && glassCost === 0) {
            const glassSetting = await prisma.setting.findUnique({ where: { key: 'glass_markup_pct' } })
            const markup = glassSetting ? parseFloat(glassSetting.value) : 30
            costOfGoods += Number(deal.glassCostPrice)
            grossRevenue += Number(deal.glassCostPrice) * (1 + markup / 100)
          }
        }

        const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
        const officialRevenue = deals.filter(d => d.isOfficialPayment).reduce((s, d) => s + d.items.reduce((si, i) => si + Number(i.unitPrice) * Number(i.quantity), 0) + d.services.reduce((ss, sv) => ss + Number(sv.unitPrice) * sv.quantity, 0), 0)
        const taxLoad = officialRevenue * 0.06
        const grossProfit = grossRevenue - costOfGoods
        const netProfit = grossProfit - totalExpenses
        const margin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0
        const expensesByCategory: Record<string, number> = {}
        for (const e of expenses) expensesByCategory[e.category.name] = (expensesByCategory[e.category.name] || 0) + Number(e.amount)

        return {
          grossRevenue: Math.round(grossRevenue), costOfGoods: Math.round(costOfGoods),
          grossProfit: Math.round(grossProfit), netProfit: Math.round(netProfit),
          margin: Math.round(margin * 10) / 10, totalExpenses: Math.round(totalExpenses),
          taxLoad: Math.round(taxLoad), officialRevenue: Math.round(officialRevenue),
          expensesByCategory, dealsCount: deals.length,
        }
      }

      const main = await calcSummary(new Date(from), new Date(to))
      if (compareFrom && compareTo) {
        const compare = await calcSummary(new Date(compareFrom), new Date(compareTo))
        return { main, compare }
      }
      return { main }
    }
  )

  // Список расходов
  app.get<{ Querystring: { from?: string; to?: string; categoryId?: string } }>(
    '/expenses', { preHandler: requireAuth }, async (req) => {
      const { from, to, categoryId } = req.query
      return prisma.expense.findMany({
        where: {
          ...(from && to ? { date: { gte: new Date(from), lte: new Date(to) } } : {}),
          ...(categoryId ? { categoryId } : {}),
        },
        include: { category: true, deal: { select: { id: true, number: true } } },
        orderBy: { date: 'desc' },
      })
    }
  )

  // Создание расхода
  app.post<{ Body: { categoryId: string; amount: number; comment?: string; dealId?: string; date?: string } }>(
    '/expenses', { preHandler: requireAuth }, async (req, reply) => {
      const { categoryId, amount, comment, dealId, date } = req.body
      if (!categoryId || !amount) return reply.status(400).send({ error: 'Заполните обязательные поля' })
      return reply.status(201).send(await prisma.expense.create({
        data: { categoryId, amount, comment, dealId, date: date ? new Date(date) : new Date() },
        include: { category: true },
      }))
    }
  )

  // Сравнение расчётных и фактических расходов на услуги
  app.get<{ Querystring: { from: string; to: string } }>(
    '/services-comparison', { preHandler: requireAuth }, async (req, reply) => {
      const { from, to } = req.query
      if (!from || !to) return reply.status(400).send({ error: 'Укажите период' })
      const dateFrom = new Date(from)
      const dateTo = new Date(to); dateTo.setHours(23, 59, 59)

      // Расчётные расходы из сделок
      const dealServices = await prisma.dealService.findMany({
        where: { deal: { updatedAt: { gte: dateFrom, lte: dateTo }, isLead: false } },
        include: { service: true },
      })
      const estimated: Record<string, number> = {}
      for (const ds of dealServices) {
        const name = ds.service.name
        estimated[name] = (estimated[name] || 0) + Number(ds.unitPrice) * ds.quantity
      }

      // Фактические расходы из финансов
      const expenses = await prisma.expense.findMany({
        where: { date: { gte: dateFrom, lte: dateTo } },
        include: { category: true },
      })
      const actual: Record<string, number> = {}
      for (const e of expenses) {
        actual[e.category.name] = (actual[e.category.name] || 0) + Number(e.amount)
      }

      // Объединяем
      const allKeys = new Set([...Object.keys(estimated), ...Object.keys(actual)])
      const comparison = Array.from(allKeys).map(name => ({
        name,
        estimated: Math.round(estimated[name] || 0),
        actual: Math.round(actual[name] || 0),
        diff: Math.round((actual[name] || 0) - (estimated[name] || 0)),
      })).sort((a, b) => b.estimated - a.estimated)

      return comparison
    }
  )

  // Категории расходов
  app.get('/expense-categories', { preHandler: requireAuth }, async () =>
    prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } })
  )

  app.post<{ Body: { name: string } }>('/expense-categories', { preHandler: requireAuth }, async (req, reply) => {
    return reply.status(201).send(await prisma.expenseCategory.create({ data: { name: req.body.name } }))
  })

  // Аналитика
  app.get<{ Querystring: { from: string; to: string } }>(
    '/analytics', { preHandler: requireAuth }, async (req, reply) => {
      const { from, to } = req.query
      if (!from || !to) return reply.status(400).send({ error: 'Укажите период' })

      const dateFrom = new Date(from)
      const dateTo = new Date(to)
      dateTo.setHours(23, 59, 59)

      const deals = await prisma.deal.findMany({
        where: {
          isLead: false,
          stage: { notIn: ['APPLICATION', 'CALCULATION', 'PROPOSAL', 'AWAITING_PAYMENT', 'FAILED'] },
          updatedAt: { gte: dateFrom, lte: dateTo },
        },
        include: { items: { include: { product: { include: { type: true } } } } },
      })

      // Топ систем — берём из DealSystem записей
      const dealSystemStats = await prisma.dealSystem.groupBy({
        by: ['systemName'],
        where: { deal: { updatedAt: { gte: dateFrom, lte: dateTo }, isLead: false } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      })

      const topSystems = dealSystemStats.map(s => ({ name: s.systemName, count: s._count.id }))

      // Цвета покраски
      const paintColors: Record<string, number> = {}
      for (const deal of deals) {
        for (const item of deal.items) {
          if (item.paintColor) paintColors[item.paintColor] = (paintColors[item.paintColor] || 0) + 1
        }
      }

      // Топ комплектующих
      const productStats: Record<string, { name: string; totalQty: number }> = {}
      for (const deal of deals) {
        for (const item of deal.items) {
          if (!productStats[item.productId]) productStats[item.productId] = { name: item.product.name, totalQty: 0 }
          productStats[item.productId].totalQty += Number(item.quantity)
        }
      }

      return {
        topSystems,
        paintColors: Object.entries(paintColors).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([color, count]) => ({ color, count })),
        topProducts: Object.values(productStats).sort((a, b) => b.totalQty - a.totalQty).slice(0, 15),
        dealsCount: deals.length,
      }
    }
  )
}
