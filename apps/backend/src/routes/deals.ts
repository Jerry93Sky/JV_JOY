import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../lib/auth'
import { generateDealNumber } from '../lib/dealNumber'
import { DealStage, Direction, DeliveryType, GlassSupply, PaymentType, PaymentStatus, FailReason, Prisma } from '@prisma/client'
import { calculateDealExtras } from '../lib/dealExtras'
import { buildPaymentUpdate, createProposalVersion, decidePaymentWorkflow, issueDealInvoice } from '../domain/deals/stageWorkflow'

const DEAL_INCLUDE = {
  creator: { select: { id: true, firstName: true, lastName: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  contact: true,
  company: true,
  items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, isPaintable: true, priceWholesale: true, priceRetail: true, bundleLength: true } } } },
  systems: true,
  services: { include: { service: true } },
  files: true,
  proposals: { orderBy: { version: 'asc' as const } },
  dealEvents: { orderBy: { createdAt: 'asc' as const } },
  tasks: { orderBy: { scheduledAt: 'asc' as const } },
}

// Хелпер для логирования событий сделки
async function logDealEvent(dealId: string, type: string, content: string, userId?: string) {
  await prisma.dealEvent.create({ data: { dealId, type: type as never, content, userId } })
}

export async function dealRoutes(app: FastifyInstance) {
  // Список сделок
  app.get<{ Querystring: { assigneeId?: string; showCompleted?: string; stage?: string } }>(
    '/', { preHandler: requireAuth }, async (req) => {
      const { assigneeId, showCompleted, stage } = req.query
      const showDone = showCompleted === 'true'
      return prisma.deal.findMany({
        where: {
          isLead: false,
          ...(assigneeId ? { assigneeId } : {}),
          ...(stage ? { stage: stage as DealStage } : {}),
          ...(!showDone ? { stage: { notIn: [DealStage.COMPLETED, DealStage.FAILED] } } : {}),
        },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true } },
          creator: { select: { id: true, firstName: true, lastName: true } },
          contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
          company: { select: { id: true, name: true } },
          _count: { select: { items: true } },
          tasks: { where: { doneAt: null }, select: { id: true, scheduledAt: true, doneAt: true } },
          items: { select: { quantity: true, unitPrice: true } },
          services: { select: { quantity: true, unitPrice: true } },
        },
        orderBy: { updatedAt: 'desc' },
      })
    }
  )

  // Одна сделка
  app.get<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const deal = await prisma.deal.findUnique({ where: { id: req.params.id }, include: DEAL_INCLUDE })
    if (!deal) return reply.status(404).send({ error: 'Не найдена' })
    return deal
  })

  // Создание заявки (этап 1.1)
  app.post<{ Body: {
    contactId: string; companyId?: string; direction: Direction
    assigneeId: string; comment?: string; address?: string
    isAgentOrder?: boolean; agentPercent?: number
    glassSupply?: GlassSupply; needPainting?: boolean
    includeInstall?: boolean; includeTransport?: boolean; deliveryType?: DeliveryType
  } }>('/', { preHandler: requireAuth }, async (req, reply) => {
    const { contactId, direction, assigneeId, comment, address, isAgentOrder, agentPercent, glassSupply, needPainting, companyId, includeInstall, includeTransport, deliveryType } = req.body
    if (!contactId || !direction || !assigneeId) return reply.status(400).send({ error: 'Заполните обязательные поля' })
    const caller = req.user as { id: string }
    const number = await generateDealNumber()
    const deal = await prisma.deal.create({
      data: {
        number, stage: DealStage.APPLICATION,
        direction, contactId, companyId,
        creatorId: caller.id, assigneeId,
        comment, address: address ?? null,
        isAgentOrder: isAgentOrder ?? false,
        agentPercent: agentPercent ?? null,
        glassSupply: glassSupply ?? GlassSupply.OURS,
        needPainting: needPainting ?? false,
        includeInstall: includeInstall ?? false,
        includeTransport: includeTransport ?? false,
        deliveryType: (deliveryType as never) ?? 'SELF_PICKUP',
      },
      include: DEAL_INCLUDE,
    })
    await logDealEvent(deal.id, 'CREATED', 'Заявка создана', caller.id)
    return reply.status(201).send(deal)
  })

  // Обновление данных сделки (состав, параметры)
  app.patch<{ Params: { id: string }; Body: {
    assigneeId?: string; comment?: string; stage?: DealStage
    contactId?: string; companyId?: string; address?: string
    glassSupply?: GlassSupply; needPainting?: boolean; paintAllOneColor?: boolean
    isAgentOrder?: boolean; agentPercent?: number
    paintingCompany?: string; manualDiscountPct?: number | null
    includeInstall?: boolean; includeTransport?: boolean; deliveryType?: DeliveryType
  } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
    if (!deal) return reply.status(404).send({ error: 'Не найдена' })
    const caller = req.user as { id: string }

    if (req.body.stage === DealStage.IN_PROGRESS && deal.stage !== DealStage.APPLICATION) {
      return reply.status(400).send({ error: 'Недопустимый переход' })
    }

    // Логируем смену ответственного
    if (req.body.assigneeId && req.body.assigneeId !== deal.assigneeId) {
      const newAssignee = await prisma.user.findUnique({ where: { id: req.body.assigneeId }, select: { firstName: true, lastName: true } })
      await logDealEvent(deal.id, 'ASSIGNEE_CHANGED', `Ответственный изменён на ${newAssignee?.lastName} ${newAssignee?.firstName}`, caller.id)
    }

    const updateData: Prisma.DealUncheckedUpdateInput = req.body
    return prisma.deal.update({ where: { id: req.params.id }, data: updateData, include: DEAL_INCLUDE })
  })

  // Возврат на предыдущий этап
  app.post<{ Params: { id: string } }>(
    '/:id/go-back', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { product: { select: { bundleLength: true } } } } },
      })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const caller = req.user as { id: string }

      const PREV_STAGE: Partial<Record<string, string>> = {
        'IN_PROGRESS':    'APPLICATION',
        'INVOICE_SENT':   'IN_PROGRESS',
        'ASSEMBLY':       'PAID',
        'PAINTING':       'ASSEMBLY',
        'INSTALL_FIRST':  'ASSEMBLY',
        'INSTALL_SECOND': 'INSTALL_FIRST',
        'SHIPMENT':       'ASSEMBLY',
        'DOCS':           'SHIPMENT',
      }

      const s = deal.stage
      if (s === 'APPLICATION') return reply.status(400).send({ error: 'Нельзя вернуть дальше' })
      if (s === 'PAID') return reply.status(400).send({ error: 'После оплаты возврат невозможен' })

      const prevStage = PREV_STAGE[s]
      if (!prevStage) return reply.status(400).send({ error: 'Возврат с этого этапа невозможен' })

      await prisma.deal.update({ where: { id: req.params.id }, data: { stage: prevStage as never } })
      await logDealEvent(req.params.id, 'STAGE_CHANGED', `Возврат на этап: ${prevStage}`, caller.id)
      return { ok: true, stage: prevStage }
    }
  )

  // ── Системы в сделке ─────────────────────────────────────────────────────

  // Добавить систему в сделку
  app.post<{ Params: { id: string }; Body: { systemId: string; systemName: string; inputParams: Record<string, unknown>; calcParams?: Record<string, unknown>; items?: { productId: string; quantity: number; unitPrice: number }[] } }>(
    '/:id/systems', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      const { systemId, systemName, inputParams, calcParams, items } = req.body
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })

      const dealSystem = await prisma.$transaction(async (tx) => {
        const ds = await tx.dealSystem.create({
          data: { dealId: req.params.id, systemId, systemName, inputParams: inputParams as never, calcParams: (calcParams ?? {}) as never },
        })
        // Добавляем комплектующие если есть
        if (items?.length) {
          for (const item of items) {
            await tx.dealItem.create({
              data: { dealId: req.params.id, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, systemId: ds.id },
            })
          }
        }
        return ds
      })

      await logDealEvent(req.params.id, 'ITEMS_UPDATED', `Добавлена система: ${systemName}`, caller.id)
      return reply.status(201).send(dealSystem)
    }
  )

  // Обновить параметры системы в сделке (пересчёт)
  app.patch<{ Params: { id: string; dsId: string }; Body: { inputParams: Record<string, unknown>; calcParams?: Record<string, unknown>; items?: { productId: string; quantity: number; unitPrice: number }[] } }>(
    '/:id/systems/:dsId', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      const { inputParams, calcParams, items } = req.body

      await prisma.$transaction(async (tx) => {
        await tx.dealSystem.update({ where: { id: req.params.dsId }, data: { inputParams: inputParams as never, calcParams: (calcParams ?? {}) as never } })
        // Удаляем старые позиции этой системы и добавляем новые
        if (items !== undefined) {
          await tx.dealItem.deleteMany({ where: { dealId: req.params.id, systemId: req.params.dsId } })
          for (const item of items) {
            await tx.dealItem.create({
              data: { dealId: req.params.id, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, systemId: req.params.dsId },
            })
          }
        }
      })

      await logDealEvent(req.params.id, 'ITEMS_UPDATED', 'Параметры системы обновлены', caller.id)
      return { ok: true }
    }
  )

  // Удалить систему из сделки
  app.delete<{ Params: { id: string; dsId: string } }>(
    '/:id/systems/:dsId', { preHandler: requireAuth }, async (req) => {
      const caller = req.user as { id: string }
      const ds = await prisma.dealSystem.findUnique({ where: { id: req.params.dsId } })
      await prisma.$transaction(async (tx) => {
        await tx.dealItem.deleteMany({ where: { dealId: req.params.id, systemId: req.params.dsId } })
        await tx.dealSystem.delete({ where: { id: req.params.dsId } })
      })
      await logDealEvent(req.params.id, 'ITEMS_UPDATED', `Система удалена из заказа`, caller.id)
      return { ok: true }
    }
  )

  // Добавить комментарий в таймлайн сделки
  app.post<{ Params: { id: string }; Body: { content: string } }>(
    '/:id/comment', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const event = await prisma.dealEvent.create({
        data: { dealId: req.params.id, type: 'COMMENT_ADDED', content: req.body.content, userId: caller.id },
      })
      return reply.status(201).send(event)
    }
  )

  // Позиции сделки
  app.post<{ Params: { id: string }; Body: { productId: string; quantity: number; unitPrice: number; paintColor?: string; systemId?: string } }>(
    '/:id/items', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      const { productId, quantity, unitPrice, paintColor, systemId } = req.body
      const item = await prisma.dealItem.create({
        data: { dealId: req.params.id, productId, quantity, unitPrice, paintColor, systemId },
        include: { product: true },
      })
      await logDealEvent(req.params.id, 'ITEMS_UPDATED', 'Состав заказа изменён', caller.id)
      return reply.status(201).send(item)
    }
  )

  app.delete<{ Params: { id: string; itemId: string } }>(
    '/:id/items/:itemId', { preHandler: requireAuth }, async (req) => {
      const caller = req.user as { id: string }
      await prisma.dealItem.delete({ where: { id: req.params.itemId } })
      await logDealEvent(req.params.id, 'ITEMS_UPDATED', 'Состав заказа изменён', caller.id)
      return { ok: true }
    }
  )

  // Обновить цену позиции
  app.patch<{ Params: { id: string; itemId: string }; Body: { unitPrice: number } }>(
    '/:id/items/:itemId/price', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const prePayment = ['APPLICATION', 'IN_PROGRESS', 'INVOICE_SENT'].includes(deal.stage)
      if (!prePayment) return reply.status(400).send({ error: 'Изменение цены доступно только до оплаты' })
      const caller = req.user as { id: string }
      await prisma.dealItem.update({
        where: { id: req.params.itemId },
        data: { unitPrice: req.body.unitPrice },
      })
      await logDealEvent(req.params.id, 'ITEMS_UPDATED', 'Цена позиции изменена вручную', caller.id)
      return { ok: true }
    }
  )

  // Единый роут обновления позиции (цена и/или кол-во) с флагами override
  app.patch<{ Params: { id: string; itemId: string }; Body: { unitPrice?: number; quantity?: number } }>(
    '/:id/items/:itemId', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      const { unitPrice, quantity } = req.body
      const data: Record<string, unknown> = {}
      if (unitPrice !== undefined) { data.unitPrice = unitPrice; data.priceOverridden = true }
      if (quantity !== undefined) { data.quantity = quantity; data.qtyOverridden = true }
      await prisma.dealItem.update({ where: { id: req.params.itemId }, data })
      await logDealEvent(req.params.id, 'ITEMS_UPDATED', 'Позиция изменена вручную', caller.id)
      return { ok: true }
    }
  )

  // Обновить количество позиции
  app.patch<{ Params: { id: string; itemId: string }; Body: { quantity: number } }>(
    '/:id/items/:itemId/quantity', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const prePayment = ['APPLICATION', 'IN_PROGRESS', 'INVOICE_SENT'].includes(deal.stage)
      if (!prePayment) return reply.status(400).send({ error: 'Изменение количества доступно только до оплаты' })
      const caller = req.user as { id: string }
      await prisma.dealItem.update({
        where: { id: req.params.itemId },
        data: { quantity: req.body.quantity },
      })
      await logDealEvent(req.params.id, 'ITEMS_UPDATED', 'Количество позиции изменено', caller.id)
      return prisma.deal.findUnique({ where: { id: req.params.id }, include: DEAL_INCLUDE })
    }
  )

  // Обновить цвет/покрытие позиции (или всех окрашиваемых если paintAllOneColor)
  app.patch<{ Params: { id: string; itemId: string }; Body: { paintColor?: string; paintFinish?: string; applyToAll?: boolean } }>(
    '/:id/items/:itemId/paint', { preHandler: requireAuth }, async (req, reply) => {
      const { paintColor, paintFinish, applyToAll } = req.body
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id }, include: { items: { include: { product: true } } } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })

      if (applyToAll || deal.paintAllOneColor) {
        // Обновляем все окрашиваемые позиции
        const paintableIds = deal.items
          .filter(i => i.product.isPaintable)
          .map(i => i.id)
        await prisma.dealItem.updateMany({
          where: { id: { in: paintableIds } },
          data: { paintColor: paintColor ?? undefined, paintFinish: paintFinish ?? undefined },
        })
      } else {
        // Обновляем только одну позицию
        await prisma.dealItem.update({
          where: { id: req.params.itemId },
          data: { paintColor: paintColor ?? undefined, paintFinish: paintFinish ?? undefined },
        })
      }
      return prisma.deal.findUnique({ where: { id: req.params.id }, include: DEAL_INCLUDE })
    }
  )

  // Услуги сделки
  app.post<{ Params: { id: string }; Body: { serviceId: string; quantity?: number; unitPrice?: number } }>(
    '/:id/services', { preHandler: requireAuth }, async (req, reply) => {
      const { serviceId, quantity } = req.body
      let { unitPrice } = req.body
      console.log('POST /services body:', JSON.stringify(req.body))

      // Если цена не передана — пробуем вычислить по формуле услуги
      if (unitPrice === undefined || unitPrice === null) {
        const service = await prisma.service.findUnique({ where: { id: serviceId } })
        console.log('Service:', service?.name, 'price:', service?.price, 'formula:', service?.priceFormula)
        if (service?.priceFormula) {
          // Вычисляем формулу для каждой системы отдельно и суммируем
          const deal = await prisma.deal.findUnique({
            where: { id: req.params.id },
            include: { systems: { include: { system: { include: { parameters: true } } } } },
          })
          const { evaluateFormula } = await import('../lib/formulaEngine')
          let total = 0
          for (const ds of deal?.systems || []) {
            const context: Record<string, number | string | boolean> = {}
            const inputParams = (ds.inputParams || {}) as Record<string, unknown>
            const calcParams = (ds.calcParams || {}) as Record<string, unknown>
            for (const [k, v] of Object.entries(inputParams)) context[k] = v as never
            for (const [k, v] of Object.entries(calcParams)) context[k] = v as never
            // Добавляем константы системы
            if (ds.system) {
              for (const p of ds.system.parameters.filter(p => p.paramKind === 'CONSTANT')) {
                context[p.variable] = p.defaultValue ? parseFloat(p.defaultValue) : 0
              }
            }
            try {
              total += Number(evaluateFormula(service.priceFormula, context)) || 0
            } catch { /* игнорируем */ }
          }
          console.log('Formula total across systems:', total)
          unitPrice = total
        } else {
          unitPrice = service?.price ? Number(service.price) : 0
        }
      }

      const svc = await prisma.dealService.create({
        data: { dealId: req.params.id, serviceId, quantity: quantity ?? 1, unitPrice: unitPrice ?? 0 },
        include: { service: true },
      })
      return reply.status(201).send(svc)
    }
  )

  app.delete<{ Params: { id: string; serviceId: string } }>(
    '/:id/services/:serviceId', { preHandler: requireAuth }, async (req) => {
      await prisma.dealService.delete({ where: { id: req.params.serviceId } })
      return { ok: true }
    }
  )

  // ── Переходы по этапам ────────────────────────────────────────────────────

  // 1.3 → Сформировать КП (заглушка, PDF будет позже)
  app.post<{ Params: { id: string } }>('/:id/proposal', { preHandler: requireAuth }, async (req, reply) => {
    const deal = await prisma.deal.findUnique({ where: { id: req.params.id }, include: { proposals: true } })
    if (!deal) return reply.status(404).send({ error: 'Не найдена' })
    const result = await createProposalVersion({
      stage: deal.stage,
      proposalCount: deal.proposals.length,
      dealId: deal.id,
      dealNumber: deal.number,
      create: (data) => prisma.commercialProposal.create({ data }),
    })
    if (!result.ok) return reply.status(400).send({ error: 'Недопустимый этап' })
    return { version: result.version, url: result.url }
  })

  // 1.4 → Выставить счёт
  app.post<{ Params: { id: string }; Body: { paymentType: PaymentType } }>(
    '/:id/invoice', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { product: { select: { bundleLength: true } } } }, proposals: { select: { id: true } } },
      })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const caller = req.user as { id: string }
      const result = await issueDealInvoice({
        stage: deal.stage,
        proposalCount: deal.proposals.length,
        invoiceSentAt: deal.invoiceSentAt,
        now: new Date(),
        reserveInventory: async () => {
          for (const item of deal.items) {
            const bundleLength = item.product?.bundleLength ? Number(item.product.bundleLength) : null
            const reserveQty = bundleLength && bundleLength > 0
              ? Math.ceil(Number(item.quantity) / bundleLength)
              : Number(item.quantity)
            await prisma.product.update({ where: { id: item.productId }, data: { reservedQty: { increment: reserveQty } } })
          }
        },
        updateInvoice: (invoice) => prisma.deal.update({ where: { id: req.params.id }, data: { ...invoice, paymentType: req.body.paymentType, invoiceUrl: 'pending' } }).then(() => undefined),
        logTransition: () => logDealEvent(req.params.id, 'STAGE_CHANGED', 'Счёт выставлен → Ожидание оплаты', caller.id),
      })
      if (!result.allowed) return reply.status(400).send({ error: 'Недопустимый этап' })
      return { ok: true }
    }
  )

  // 2.1 → Оплата
  app.post<{ Params: { id: string }; Body: { paymentStatus: PaymentStatus; paidAmount?: number; isOfficialPayment?: boolean } }>(
    '/:id/payment', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const decision = decidePaymentWorkflow(deal.stage, deal.paymentStatus, req.body.paymentStatus)
      if (!decision.allowed) return reply.status(400).send({ error: 'Недопустимый этап' })
      const caller = req.user as { id: string }
      const { paymentStatus, paidAmount, isOfficialPayment } = req.body
      const paymentUpdate = buildPaymentUpdate({ decision, paymentStatus, paidAmount, isOfficialPayment, now: new Date() })
      await prisma.deal.update({
        where: { id: req.params.id },
        data: {
          ...paymentUpdate,
        },
      })
      const paymentLabel = paymentStatus === 'FULL' ? 'Полная оплата' : `Частичная оплата: ${paidAmount?.toLocaleString('ru-RU')} ₽`
      await logDealEvent(req.params.id, 'PAYMENT_RECEIVED', paymentLabel, caller.id)
      if (paymentStatus === 'FULL') await logDealEvent(req.params.id, 'STAGE_CHANGED', '→ Заказ оплачен', caller.id)
      return { ok: true }
    }
  )

  // 2.2 → Сборка (списание со склада + генерация разблюдовки)
  app.post<{ Params: { id: string } }>('/:id/assemble', { preHandler: requireAuth }, async (req, reply) => {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        contact: true,
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, bundleLength: true, isPaintable: true } } } },
        systems: true,
        services: { include: { service: true } },
      },
    })
    if (!deal) return reply.status(404).send({ error: 'Не найдена' })
    if (deal.stage !== DealStage.PAID) return reply.status(400).send({ error: 'Недопустимый этап' })

    await prisma.$transaction(async (tx) => {
      for (const item of deal.items) {
        const bundleLength = item.product?.bundleLength ? Number(item.product.bundleLength) : null
        const deductQty = bundleLength && bundleLength > 0
          ? Math.ceil(Number(item.quantity) / bundleLength)
          : Number(item.quantity)
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { decrement: deductQty }, reservedQty: { decrement: deductQty } },
        })
      }
      await tx.deal.update({ where: { id: req.params.id }, data: { stage: DealStage.ASSEMBLY } })
    })

    return { ok: true }
  })

  // Генерация разблюдовки (HTML)
  app.get<{ Params: { id: string } }>('/:id/assembly-sheet', { preHandler: requireAuth }, async (req, reply) => {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        contact: true,
        company: true,
        assignee: { select: { firstName: true, lastName: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, isPaintable: true } } } },
        systems: true,
        services: { include: { service: true } },
      },
    })
    if (!deal) return reply.status(404).send({ error: 'Не найдена' })

    // Группируем комплектующие по системам
    const systemsMap = new Map<string, { name: string; items: typeof deal.items }>()
    for (const sys of deal.systems) {
      const sysItems = deal.items.filter(i => i.systemId === sys.id)
      systemsMap.set(sys.id, { name: sys.systemName, items: sysItems })
    }
    const standaloneItems = deal.items.filter(i => !i.systemId)

    const contactName = deal.contact
      ? `${deal.contact.lastName} ${deal.contact.firstName}${deal.contact.middleName ? ' ' + deal.contact.middleName : ''}`
      : '—'

    const paidAt = deal.paidAt ? new Date(deal.paidAt).toLocaleDateString('ru-RU') : '—'
    const now = new Date().toLocaleDateString('ru-RU')

    const installTypeLabel: Record<string, string> = {
      NONE: 'Без монтажа', SINGLE: 'Монтаж (1 этап)', TWO_STAGE: 'Монтаж (2 этапа)',
    }
    const glassLabel = deal.glassSupply === 'OURS' ? 'Наше стекло' : 'Стекло заказчика'
    const installLabel = installTypeLabel[(deal as never as { installType?: string }).installType ?? 'NONE'] ?? 'Без монтажа'

    const renderSystemTable = (sysName: string, items: typeof deal.items) => {
      if (items.length === 0) return ''
      const rows = items.map(i => `
        <tr>
          <td>${i.product.name}</td>
          <td>${i.product.sku}</td>
          <td class="center">${Number(i.quantity)} ${i.product.unit}</td>
          <td class="center">${i.product.isPaintable ? '✓' : ''}</td>
        </tr>`).join('')
      return `
        <h3>${sysName}</h3>
        <table>
          <thead><tr><th>Наименование</th><th>Артикул</th><th>Кол-во</th><th>Покраска</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
    }

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Разблюдовка №${deal.number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 12px; margin: 12px 0 4px; color: #444; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 12px 0; font-size: 11px; }
    .meta span { color: #666; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #f0f0f0; text-align: left; padding: 4px 8px; border: 1px solid #ccc; font-size: 11px; }
    td { padding: 3px 8px; border: 1px solid #ddd; font-size: 11px; }
    .center { text-align: center; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; background: #e8f5e9; color: #2e7d32; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <h1>Разблюдовка №${deal.number}</h1>
  <div class="meta">
    <div><span>Клиент:</span> ${contactName}</div>
    <div><span>Дата оплаты:</span> ${paidAt}</div>
    <div><span>Дата формирования:</span> ${now}</div>
    <div><span>Ответственный:</span> ${deal.assignee.lastName} ${deal.assignee.firstName}</div>
    <div><span>Стекло:</span> ${glassLabel}</div>
    <div><span>Монтаж:</span> ${installLabel}</div>
    ${deal.needPainting ? '<div><span>Покраска:</span> <span class="badge">Да</span></div>' : ''}
    ${deal.address ? `<div><span>Адрес:</span> ${deal.address}</div>` : ''}
  </div>

  <h2>Комплектующие по системам</h2>
  ${Array.from(systemsMap.values()).map(s => renderSystemTable(s.name, s.items)).join('')}

  ${standaloneItems.length > 0 ? `
  <h2>Дополнительные комплектующие</h2>
  <table>
    <thead><tr><th>Наименование</th><th>Артикул</th><th>Кол-во</th><th>Покраска</th></tr></thead>
    <tbody>
      ${standaloneItems.map(i => `
        <tr>
          <td>${i.product.name}</td>
          <td>${i.product.sku}</td>
          <td class="center">${Number(i.quantity)} ${i.product.unit}</td>
          <td class="center">${i.product.isPaintable ? '✓' : ''}</td>
        </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${deal.services.length > 0 ? `
  <h2>Дополнительные работы</h2>
  <table>
    <thead><tr><th>Услуга</th><th>Кол-во</th></tr></thead>
    <tbody>
      ${deal.services.map(s => `<tr><td>${s.service.name}</td><td class="center">${s.quantity}</td></tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${deal.systems.length > 0 ? `
  <h2>Параметры систем</h2>
  ${deal.systems.map(sys => {
    const params = sys.calcParams as Record<string, unknown> | null
    if (!params) return ''
    const entries = Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== '')
    if (entries.length === 0) return ''
    return `
      <h3>${sys.systemName}</h3>
      <table>
        <tbody>
          ${entries.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
        </tbody>
      </table>`
  }).join('')}` : ''}
</body>
</html>`

    reply.header('Content-Type', 'text/html; charset=utf-8')
    return reply.send(html)
  })

  // 2.3 → Покраска (стоимость убрана — будет при получении)
  app.post<{ Params: { id: string }; Body: { paintingCompany: string; paintingCost?: number; profileRows?: { name: string; length: string; qty: string }[] } }>(
    '/:id/painting', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      if (deal.stage !== DealStage.ASSEMBLY) return reply.status(400).send({ error: 'Недопустимый этап' })
      if (!deal.needPainting) return reply.status(400).send({ error: 'Покраска не требуется' })

      // Сохраняем данные накладной в JSON поле comment (временно) или в отдельном поле
      const profileData = req.body.profileRows ? JSON.stringify(req.body.profileRows) : null

      await prisma.deal.update({
        where: { id: req.params.id },
        data: {
          stage: DealStage.PAINTING,
          paintingCompany: req.body.paintingCompany,
          paintingSentAt: new Date(),
          paintingCost: req.body.paintingCost ?? null,
          // Сохраняем профили в paintingNoteUrl как JSON (временное решение)
          paintingNoteUrl: profileData,
        },
      })
      return { ok: true }
    }
  )

  // Генерация накладной на покраску (HTML)
  app.get<{ Params: { id: string } }>('/:id/painting-note', { preHandler: requireAuth }, async (req, reply) => {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        contact: true,
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, isPaintable: true } } } },
        systems: true,
      },
    })
    if (!deal) return reply.status(404).send({ error: 'Не найдена' })

    const paintableItems = deal.items.filter(i => i.product.isPaintable)
    const profileRows: { name: string; length: string; qty: string }[] = (() => {
      try { return deal.paintingNoteUrl ? JSON.parse(deal.paintingNoteUrl) : [] } catch { return [] }
    })()

    const now = new Date().toLocaleDateString('ru-RU')
    const contactName = deal.contact
      ? `${deal.contact.lastName} ${deal.contact.firstName}`
      : '—'

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Накладная на покраску №${deal.number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
    h1 { font-size: 16px; margin-bottom: 8px; }
    h2 { font-size: 13px; margin: 14px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 10px 0; font-size: 11px; }
    .meta span { color: #666; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background: #f0f0f0; text-align: left; padding: 4px 8px; border: 1px solid #ccc; font-size: 11px; }
    td { padding: 3px 8px; border: 1px solid #ddd; font-size: 11px; }
    .center { text-align: center; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <h1>Накладная на покраску №${deal.number}</h1>
  <div class="meta">
    <div><span>Клиент:</span> ${contactName}</div>
    <div><span>Дата:</span> ${now}</div>
    <div><span>Покрасочная:</span> ${deal.paintingCompany || '—'}</div>
    ${deal.paintingCost ? `<div><span>Стоимость:</span> ${Number(deal.paintingCost).toLocaleString('ru-RU')} ₽</div>` : ''}
  </div>

  ${profileRows.length > 0 ? `
  <h2>Профили</h2>
  <table>
    <thead><tr><th>Наименование</th><th class="center">Длина (мм)</th><th class="center">Кол-во</th></tr></thead>
    <tbody>
      ${profileRows.filter(r => r.name).map(r => `
        <tr>
          <td>${r.name}</td>
          <td class="center">${r.length || '—'}</td>
          <td class="center">${r.qty}</td>
        </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${paintableItems.length > 0 ? `
  <h2>Окрашиваемые комплектующие</h2>
  <table>
    <thead><tr><th>Наименование</th><th>Артикул</th><th class="center">Кол-во</th></tr></thead>
    <tbody>
      ${paintableItems.map(i => `
        <tr>
          <td>${i.product.name}</td>
          <td>${i.product.sku}</td>
          <td class="center">${Number(i.quantity)} ${i.product.unit}</td>
        </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <div style="margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px;">
    <div>Сдал: _________________ / _________________</div>
    <div>Принял: _________________ / _________________</div>
  </div>
</body>
</html>`

    reply.header('Content-Type', 'text/html; charset=utf-8')
    return reply.send(html)
  })

  // 2.4 → Пришёл с покраски
  app.post<{ Params: { id: string }; Body: { paintingCost?: number } }>(
    '/:id/painting-done', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      if (deal.stage !== DealStage.PAINTING && deal.stage !== DealStage.ASSEMBLY) return reply.status(400).send({ error: 'Недопустимый этап' })
      // Определяем следующий этап по типу монтажа
      let nextStage: DealStage = DealStage.SHIPMENT
      if ((deal as never as { installType?: string }).installType === 'SINGLE') nextStage = DealStage.INSTALL_FIRST
      else if ((deal as never as { installType?: string }).installType === 'TWO_STAGE') nextStage = DealStage.INSTALL_FIRST
      await prisma.deal.update({
        where: { id: req.params.id },
        data: { stage: nextStage, paintingCost: req.body.paintingCost ?? null },
      })
      return { ok: true }
    }
  )

  // Скомплектовать на монтаж — отмечаем отгруженные позиции
  app.post<{ Params: { id: string }; Body: { items: { itemId: string; qty: number }[] } }>(
    '/:id/install-kit', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      await prisma.$transaction(
        req.body.items.map(({ itemId, qty }) =>
          prisma.dealItem.update({
            where: { id: itemId },
            data: { shippedQty: { increment: qty } },
          })
        )
      )
      await logDealEvent(req.params.id, 'STAGE_CHANGED', `Скомплектовано на монтаж: ${req.body.items.length} позиций`, caller.id)
      return { ok: true }
    }
  )

  // 2.5 → Монтаж 1
  app.post<{ Params: { id: string } }>('/:id/install-1', { preHandler: requireAuth }, async (req, reply) => {
    const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
    if (!deal) return reply.status(404).send({ error: 'Не найдена' })
    if (!['ASSEMBLY', 'PAINTING'].includes(deal.stage)) return reply.status(400).send({ error: 'Недопустимый этап' })
    await prisma.deal.update({ where: { id: req.params.id }, data: { stage: DealStage.INSTALL_FIRST } })
    return { ok: true }
  })

  // Заказ стекла (параллельный процесс)
  app.post<{ Params: { id: string }; Body: { glassCostPrice: number; glassSupplier?: string; glassExpectedDate?: string; glassComment?: string } }>(
    '/:id/glass-order', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      if (deal.glassSupply !== 'OURS') return reply.status(400).send({ error: 'Стекло заказчика — заказ не требуется' })
      const caller = req.user as { id: string }

      const { glassCostPrice, glassSupplier, glassExpectedDate, glassComment } = req.body
      await prisma.deal.update({
        where: { id: req.params.id },
        data: {
          glassOrderStatus: 'IN_PROGRESS',
          glassCostPrice,
          glassSupplier: glassSupplier ?? null,
          glassOrderDate: new Date(),
          glassExpectedDate: glassExpectedDate ? new Date(glassExpectedDate) : null,
          glassComment: glassComment ?? null,
        },
      })
      await logDealEvent(req.params.id, 'STAGE_CHANGED', `Стекло заказано${glassSupplier ? ` у ${glassSupplier}` : ''}. Стоимость: ${glassCostPrice.toLocaleString('ru-RU')} ₽`, caller.id)
      return { ok: true }
    }
  )

  app.post<{ Params: { id: string } }>('/:id/glass-done', { preHandler: requireAuth }, async (req, reply) => {
    const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
    if (!deal) return reply.status(404).send({ error: 'Не найдена' })
    const caller = req.user as { id: string }
    await prisma.deal.update({ where: { id: req.params.id }, data: { glassOrderStatus: 'COMPLETED' } })
    await logDealEvent(req.params.id, 'STAGE_CHANGED', 'Стекло получено', caller.id)
    return { ok: true }
  })

  // 3.3 → Монтаж 2
  app.post<{ Params: { id: string } }>('/:id/install-2', { preHandler: requireAuth }, async (req, reply) => {
    const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
    if (!deal) return reply.status(404).send({ error: 'Не найдена' })
    if (deal.stage !== DealStage.INSTALL_FIRST) return reply.status(400).send({ error: 'Недопустимый этап' })
    await prisma.deal.update({ where: { id: req.params.id }, data: { stage: DealStage.INSTALL_SECOND } })
    return { ok: true }
  })

  // → Отгрузка / Подписание документов
  app.post<{ Params: { id: string } }>(
    '/:id/ship', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id }, include: { files: true } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const validStages = ['ASSEMBLY', 'PAINTING', 'INSTALL_FIRST', 'INSTALL_SECOND']
      if (!validStages.includes(deal.stage)) return reply.status(400).send({ error: 'Недопустимый этап' })

      if (deal.paymentStatus === 'PARTIAL') {
        return reply.status(400).send({ error: 'Необходима полная оплата перед отгрузкой' })
      }

      const caller = req.user as { id: string }
      await prisma.deal.update({ where: { id: req.params.id }, data: { stage: DealStage.SHIPMENT } })
      await logDealEvent(req.params.id, 'STAGE_CHANGED', 'Отгрузка', caller.id)
      return { ok: true }
    }
  )

  // → Подписание документов
  app.post<{ Params: { id: string } }>(
    '/:id/docs', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      if (deal.stage !== DealStage.SHIPMENT) return reply.status(400).send({ error: 'Недопустимый этап' })
      const caller = req.user as { id: string }
      await prisma.deal.update({ where: { id: req.params.id }, data: { stage: DealStage.DOCS } })
      await logDealEvent(req.params.id, 'STAGE_CHANGED', '→ Подписание документов', caller.id)
      return { ok: true }
    }
  )

  // → Завершить заказ
  app.post<{ Params: { id: string } }>('/:id/complete', { preHandler: requireAuth }, async (req, reply) => {
    const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
    if (!deal) return reply.status(404).send({ error: 'Не найдена' })
    if (deal.stage !== DealStage.DOCS) return reply.status(400).send({ error: 'Недопустимый этап' })
    if (deal.paymentStatus !== 'FULL') return reply.status(400).send({ error: 'Нельзя завершить без полной оплаты' })
    await prisma.deal.update({ where: { id: req.params.id }, data: { stage: DealStage.COMPLETED } })
    return { ok: true }
  })

  // Пересчитать расчётные цены доп. работ (стекло, монтаж, покраска, транспорт)
  app.post<{ Params: { id: string } }>(
    '/:id/recalc-extras', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const extras = await calculateDealExtras(req.params.id)
      await prisma.deal.update({ where: { id: req.params.id }, data: extras })
      return { ok: true, ...extras }
    }
  )

  // Обновить параметры доп. работ вручную
  app.patch<{ Params: { id: string }; Body: {
    includeInstall?: boolean; includeTransport?: boolean; deliveryType?: string
    calcGlassPrice?: number; calcInstallPrice?: number; calcPaintingPrice?: number; calcTransportPrice?: number
    actualInstallPrice?: number
  } }>(
    '/:id/extras', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      return prisma.deal.update({ where: { id: req.params.id }, data: req.body as never, include: { items: true, services: true } })
    }
  )

  // Пересчитать цены по актуальным ценам склада
  app.post<{ Params: { id: string } }>(
    '/:id/reprice', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { product: true } } },
      })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const prePaymentStages = ['APPLICATION', 'IN_PROGRESS', 'INVOICE_SENT']
      if (!prePaymentStages.includes(deal.stage)) {
        return reply.status(400).send({ error: 'Пересчёт доступен только до оплаты' })
      }
      const caller = req.user as { id: string }
      await prisma.$transaction(async (tx) => {
        for (const item of deal.items) {
          const price = deal.direction === 'DEALER'
            ? Number(item.product.priceWholesale)
            : Number(item.product.priceRetail)
          if (price > 0) {
            await tx.dealItem.update({ where: { id: item.id }, data: { unitPrice: price } })
          }
        }
      })
      await logDealEvent(deal.id, 'ITEMS_UPDATED', 'Цены пересчитаны по актуальным ценам склада', caller.id)
      return { ok: true }
    }
  )

  // Доплата (2.6)
  app.post<{ Params: { id: string }; Body: { amount: number } }>(
    '/:id/extra-payment', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      if (deal.paymentStatus !== 'PARTIAL') return reply.status(400).send({ error: 'Доплата не требуется' })
      const caller = req.user as { id: string }
      const newPaid = Number(deal.paidAmount || 0) + req.body.amount
      // Считаем итог сделки для проверки полной оплаты
      const dealFull = await prisma.deal.findUnique({ where: { id: req.params.id }, include: { items: true, services: true } })
      const total = dealFull!.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
        + dealFull!.services.reduce((s, sv) => s + sv.quantity * Number(sv.unitPrice), 0)
      const isNowFull = newPaid >= total
      await prisma.deal.update({
        where: { id: req.params.id },
        data: { paidAmount: newPaid, paymentStatus: isNowFull ? 'FULL' : 'PARTIAL' },
      })
      await logDealEvent(req.params.id, 'PAYMENT_RECEIVED', `Доплата: ${req.body.amount.toLocaleString('ru-RU')} ₽${isNowFull ? ' (оплачен полностью)' : ''}`, caller.id)
      return { ok: true, isNowFull, newPaid }
    }
  )

  // 4.3 → Провал
  app.post<{ Params: { id: string }; Body: { failReason: FailReason } }>(
    '/:id/fail', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id }, include: { items: true } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const prePaymentStages = ['APPLICATION', 'IN_PROGRESS', 'INVOICE_SENT']
      if (!prePaymentStages.includes(deal.stage)) return reply.status(400).send({ error: 'Провалить можно только до оплаты' })

      await prisma.$transaction(async (tx) => {
        await tx.deal.update({ where: { id: req.params.id }, data: { stage: DealStage.FAILED, failReason: req.body.failReason } })
      })
      return { ok: true }
    }
  )

  // Восстановить из провала
  app.post<{ Params: { id: string } }>(
    '/:id/restore', { preHandler: requireAuth }, async (req, reply) => {
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      if (deal.stage !== DealStage.FAILED) return reply.status(400).send({ error: 'Сделка не в статусе провала' })
      const caller = req.user as { id: string }
      await prisma.deal.update({ where: { id: req.params.id }, data: { stage: DealStage.APPLICATION, failReason: null } })
      await logDealEvent(req.params.id, 'STAGE_CHANGED', 'Заявка восстановлена из провала', caller.id)
      return { ok: true }
    }
  )

  // ── Задачи для сделок ────────────────────────────────────────────────────

  // Получить задачи сделки
  app.get<{ Params: { id: string } }>(
    '/:id/tasks', { preHandler: requireAuth }, async (req) =>
      prisma.leadTask.findMany({ where: { dealId: req.params.id }, orderBy: { scheduledAt: 'asc' } })
  )

  // Создать задачу
  app.post<{ Params: { id: string }; Body: { description: string; scheduledAt: string } }>(
    '/:id/tasks', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      const deal = await prisma.deal.findUnique({ where: { id: req.params.id } })
      if (!deal) return reply.status(404).send({ error: 'Не найдена' })
      const task = await prisma.leadTask.create({
        data: { dealId: req.params.id, description: req.body.description, scheduledAt: new Date(req.body.scheduledAt) },
      })
      await logDealEvent(req.params.id, 'COMMENT_ADDED', `Запланировано: ${req.body.description} на ${new Date(req.body.scheduledAt).toLocaleString('ru-RU')}`, caller.id)
      return reply.status(201).send(task)
    }
  )

  // Выполнить задачу
  app.post<{ Params: { id: string; taskId: string }; Body: { comment?: string } }>(
    '/:id/tasks/:taskId/done', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      const task = await prisma.leadTask.findFirst({ where: { id: req.params.taskId, dealId: req.params.id } })
      if (!task) return reply.status(404).send({ error: 'Задача не найдена' })
      const updated = await prisma.leadTask.update({
        where: { id: req.params.taskId },
        data: { doneAt: new Date(), doneComment: req.body.comment ?? null },
      })
      await logDealEvent(req.params.id, 'COMMENT_ADDED', `Выполнено: ${task.description}${req.body.comment ? ` — ${req.body.comment}` : ''}`, caller.id)
      return updated
    }
  )
}
