import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../lib/auth'
import { generateDealNumber } from '../lib/dealNumber'

const LEAD_INCLUDE = {
  assignee: { select: { id: true, firstName: true, lastName: true } },
  creator: { select: { id: true, firstName: true, lastName: true } },
  contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
  company: { select: { id: true, name: true } },
  events: { orderBy: { createdAt: 'asc' as const } },
  tasks: { orderBy: { scheduledAt: 'asc' as const } },
  systems: true,
  items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, isPaintable: true, priceWholesale: true, priceRetail: true, bundleLength: true } } } },
  services: { include: { service: true } },
}

export async function leadRoutes(app: FastifyInstance) {
  // Список лидов
  app.get<{ Querystring: { status?: string; assigneeId?: string } }>(
    '/', { preHandler: requireAuth }, async (req) => {
      const { status, assigneeId } = req.query
      return prisma.deal.findMany({
        where: {
          // Конвертированные лиды имеют isLead: false, но leadStatus: 'CONVERTED'
          ...(status === 'CONVERTED'
            ? { leadStatus: 'CONVERTED' as never }
            : { isLead: true, ...(status ? { leadStatus: status as never } : {}) }
          ),
          ...(assigneeId ? { assigneeId } : {}),
        },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true } },
          contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
          company: { select: { id: true, name: true } },
          _count: { select: { events: true } },
          tasks: { where: { doneAt: null }, orderBy: { scheduledAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }
  )

  // Один лид
  app.get<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true }, include: LEAD_INCLUDE })
    if (!lead) return reply.status(404).send({ error: 'Лид не найден' })
    return lead
  })

  // Создание лида
  app.post<{ Body: { contactId?: string; companyId?: string; assigneeId: string; comment?: string; leadSource?: string } }>(
    '/', { preHandler: requireAuth }, async (req, reply) => {
      const { contactId, companyId, assigneeId, comment, leadSource } = req.body
      if (!assigneeId) return reply.status(400).send({ error: 'Укажите ответственного' })
      const caller = req.user as { id: string }
      const number = await generateDealNumber()

      const lead = await prisma.deal.create({
        data: {
          number,
          isLead: true,
          leadStatus: 'NEW',
          leadSource: (leadSource as never) || 'MANUAL',
          direction: 'PRIVATE',
          ...(contactId ? { contactId } : {}),
          companyId,
          creatorId: caller.id, assigneeId,
          comment,
          stage: 'APPLICATION',
          events: {
            create: { type: 'CREATED', content: 'Лид создан', userId: caller.id },
          },
        },
        include: LEAD_INCLUDE,
      })
      return reply.status(201).send(lead)
    }
  )

  // Смена статуса
  app.post<{ Params: { id: string }; Body: { status: string; rejectReason?: string } }>(
    '/:id/status', { preHandler: requireAuth }, async (req, reply) => {
      const { status, rejectReason } = req.body
      const caller = req.user as { id: string }
      const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true } })
      if (!lead) return reply.status(404).send({ error: 'Лид не найден' })

      await prisma.$transaction(async (tx) => {
        await tx.deal.update({
          where: { id: req.params.id },
          data: { leadStatus: status as never, leadRejectReason: rejectReason ?? null },
        })
        await tx.leadEvent.create({
          data: { dealId: req.params.id, type: status === 'REJECTED' ? 'REJECTED' : 'STATUS_CHANGED', content: `Статус изменён на: ${status}${rejectReason ? ` (${rejectReason})` : ''}`, userId: caller.id },
        })
      })
      return { ok: true }
    }
  )

  // Добавить комментарий в таймлайн
  app.post<{ Params: { id: string }; Body: { content: string; type?: string } }>(
    '/:id/events', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true } })
      if (!lead) return reply.status(404).send({ error: 'Лид не найден' })
      const event = await prisma.leadEvent.create({
        data: { dealId: req.params.id, type: (req.body.type as never) || 'COMMENT_ADDED', content: req.body.content, userId: caller.id },
      })
      return reply.status(201).send(event)
    }
  )

  // Конвертация в сделку
  app.post<{ Params: { id: string }; Body: { direction: string; assigneeId: string; glassSupply?: string; needPainting?: boolean; contactId?: string } }>(
    '/:id/convert', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true } })
      if (!lead) return reply.status(404).send({ error: 'Лид не найден' })
      if (lead.leadStatus === 'CONVERTED') return reply.status(400).send({ error: 'Лид уже конвертирован' })

      // Если у лида нет контакта — требуем его при конвертации
      const contactId = req.body.contactId || lead.contactId
      if (!contactId) return reply.status(400).send({ error: 'Укажите контактное лицо для создания сделки' })

      await prisma.$transaction(async (tx) => {
        await tx.deal.update({
          where: { id: req.params.id },
          data: {
            isLead: false,
            leadStatus: 'CONVERTED',
            stage: 'APPLICATION',
            direction: req.body.direction as never,
            assigneeId: req.body.assigneeId,
            glassSupply: (req.body.glassSupply as never) || 'OURS',
            needPainting: req.body.needPainting ?? false,
            contactId,
          },
        })
        await tx.leadEvent.create({
          data: { dealId: req.params.id, type: 'CONVERTED', content: `Конвертирован в сделку #${lead.number}`, userId: caller.id },
        })
      })

      return { ok: true, dealId: req.params.id, number: lead.number }
    }
  )

  // ── Системы в лиде ───────────────────────────────────────────────────────

  // Добавить систему в лид
  app.post<{ Params: { id: string }; Body: { systemId: string; systemName: string; inputParams: Record<string, unknown>; calcParams?: Record<string, unknown>; items?: { productId: string; quantity: number; unitPrice: number }[] } }>(
    '/:id/systems', { preHandler: requireAuth }, async (req, reply) => {
      const { systemId, systemName, inputParams, calcParams, items } = req.body
      const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true } })
      if (!lead) return reply.status(404).send({ error: 'Лид не найден' })

      const ds = await prisma.$transaction(async (tx) => {
        const created = await tx.dealSystem.create({
          data: { dealId: req.params.id, systemId, systemName, inputParams: inputParams as never, calcParams: (calcParams ?? {}) as never },
        })
        if (items?.length) {
          for (const item of items) {
            await tx.dealItem.create({
              data: { dealId: req.params.id, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, systemId: created.id },
            })
          }
        }
        return created
      })
      return reply.status(201).send(ds)
    }
  )

  // Обновить систему в лиде (пересчёт)
  app.patch<{ Params: { id: string; dsId: string }; Body: { inputParams: Record<string, unknown>; calcParams?: Record<string, unknown>; items?: { productId: string; quantity: number; unitPrice: number }[] } }>(
    '/:id/systems/:dsId', { preHandler: requireAuth }, async (req, reply) => {
      const { inputParams, calcParams, items } = req.body
      await prisma.$transaction(async (tx) => {
        await tx.dealSystem.update({ where: { id: req.params.dsId }, data: { inputParams: inputParams as never, calcParams: (calcParams ?? {}) as never } })
        if (items !== undefined) {
          await tx.dealItem.deleteMany({ where: { dealId: req.params.id, systemId: req.params.dsId } })
          for (const item of items) {
            await tx.dealItem.create({
              data: { dealId: req.params.id, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, systemId: req.params.dsId },
            })
          }
        }
      })
      return { ok: true }
    }
  )

  // Удалить систему из лида
  app.delete<{ Params: { id: string; dsId: string } }>(
    '/:id/systems/:dsId', { preHandler: requireAuth }, async (req) => {
      await prisma.$transaction(async (tx) => {
        await tx.dealItem.deleteMany({ where: { dealId: req.params.id, systemId: req.params.dsId } })
        await tx.dealSystem.delete({ where: { id: req.params.dsId } })
      })
      return { ok: true }
    }
  )

  // ── Задачи ──────────────────────────────────────────────────────────────────

  // Создать задачу
  app.post<{ Params: { id: string }; Body: { description: string; scheduledAt: string } }>(
    '/:id/tasks', { preHandler: requireAuth }, async (req, reply) => {
      const caller = req.user as { id: string }
      const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true } })
      if (!lead) return reply.status(404).send({ error: 'Лид не найден' })
      const task = await prisma.leadTask.create({
        data: { dealId: req.params.id, description: req.body.description, scheduledAt: new Date(req.body.scheduledAt) },
      })
      await prisma.leadEvent.create({
        data: { dealId: req.params.id, type: 'TASK_CREATED' as never, content: `Запланировано: ${req.body.description} на ${new Date(req.body.scheduledAt).toLocaleString('ru-RU')}`, userId: caller.id },
      })
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
      await prisma.leadEvent.create({
        data: { dealId: req.params.id, type: 'TASK_DONE' as never, content: `Выполнено: ${task.description}${req.body.comment ? ` — ${req.body.comment}` : ''}`, userId: caller.id },
      })
      return updated
    }
  )

  // ── Комплектующие лида ───────────────────────────────────────────────────

  app.post<{ Params: { id: string }; Body: { productId: string; quantity: number; unitPrice: number; paintColor?: string; systemId?: string } }>(
    '/:id/items', { preHandler: requireAuth }, async (req, reply) => {
      const { productId, quantity, unitPrice, paintColor, systemId } = req.body
      const item = await prisma.dealItem.create({
        data: { dealId: req.params.id, productId, quantity, unitPrice, paintColor, systemId },
        include: { product: true },
      })
      return reply.status(201).send(item)
    }
  )

  app.delete<{ Params: { id: string; itemId: string } }>(
    '/:id/items/:itemId', { preHandler: requireAuth }, async (req) => {
      await prisma.dealItem.delete({ where: { id: req.params.itemId } })
      return { ok: true }
    }
  )

  app.patch<{ Params: { id: string; itemId: string }; Body: { quantity: number } }>(
    '/:id/items/:itemId/quantity', { preHandler: requireAuth }, async (req, reply) => {
      const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true } })
      if (!lead) return reply.status(404).send({ error: 'Лид не найден' })
      await prisma.dealItem.update({ where: { id: req.params.itemId }, data: { quantity: req.body.quantity } })
      return prisma.deal.findFirst({ where: { id: req.params.id }, include: LEAD_INCLUDE })
    }
  )

  app.patch<{ Params: { id: string; itemId: string }; Body: { unitPrice: number } }>(
    '/:id/items/:itemId/price', { preHandler: requireAuth }, async (req, reply) => {
      await prisma.dealItem.update({ where: { id: req.params.itemId }, data: { unitPrice: req.body.unitPrice } })
      return { ok: true }
    }
  )

  app.patch<{ Params: { id: string; itemId: string }; Body: { paintColor?: string; paintFinish?: string; applyToAll?: boolean } }>(
    '/:id/items/:itemId/paint', { preHandler: requireAuth }, async (req, reply) => {
      const { paintColor, paintFinish, applyToAll } = req.body
      const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true }, include: { items: { include: { product: true } } } })
      if (!lead) return reply.status(404).send({ error: 'Лид не найден' })
      if (applyToAll || lead.paintAllOneColor) {
        const paintableIds = lead.items.filter(i => i.product.isPaintable).map(i => i.id)
        await prisma.dealItem.updateMany({ where: { id: { in: paintableIds } }, data: { paintColor: paintColor ?? undefined, paintFinish: paintFinish ?? undefined } })
      } else {
        await prisma.dealItem.update({ where: { id: req.params.itemId }, data: { paintColor: paintColor ?? undefined, paintFinish: paintFinish ?? undefined } })
      }
      return prisma.deal.findFirst({ where: { id: req.params.id }, include: LEAD_INCLUDE })
    }
  )

  // ── Услуги лида ──────────────────────────────────────────────────────────

  app.post<{ Params: { id: string }; Body: { serviceId: string; quantity?: number; unitPrice?: number } }>(
    '/:id/services', { preHandler: requireAuth }, async (req, reply) => {
      const { serviceId, quantity } = req.body
      let { unitPrice } = req.body
      if (unitPrice === undefined || unitPrice === null) {
        const service = await prisma.service.findUnique({ where: { id: serviceId } })
        if (service?.priceFormula) {
          const lead = await prisma.deal.findFirst({ where: { id: req.params.id }, include: { systems: { include: { system: { include: { parameters: true } } } } } })
          const { evaluateFormula } = await import('../lib/formulaEngine')
          let total = 0
          for (const ds of lead?.systems || []) {
            const context: Record<string, number | string | boolean> = {}
            const inputParams = (ds.inputParams || {}) as Record<string, unknown>
            const calcParams = (ds.calcParams || {}) as Record<string, unknown>
            for (const [k, v] of Object.entries(inputParams)) context[k] = v as never
            for (const [k, v] of Object.entries(calcParams)) context[k] = v as never
            if (ds.system) {
              for (const p of ds.system.parameters.filter(p => p.paramKind === 'CONSTANT')) {
                context[p.variable] = p.defaultValue ? parseFloat(p.defaultValue) : 0
              }
            }
            try { total += Number(evaluateFormula(service.priceFormula, context)) || 0 } catch { /* ignore */ }
          }
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

  // ── Доп. работы лида (стекло, монтаж, покраска, транспорт) ──────────────

  app.patch<{ Params: { id: string }; Body: {
    includeInstall?: boolean; includeTransport?: boolean; deliveryType?: string; needPainting?: boolean; glassSupply?: string
    calcGlassPrice?: number; calcInstallPrice?: number; calcPaintingPrice?: number; calcTransportPrice?: number
  } }>(
    '/:id/extras', { preHandler: requireAuth }, async (req, reply) => {
      const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true } })
      if (!lead) return reply.status(404).send({ error: 'Лид не найден' })
      return prisma.deal.update({ where: { id: req.params.id }, data: req.body as never, include: LEAD_INCLUDE })
    }
  )

  app.post<{ Params: { id: string } }>(
    '/:id/recalc-extras', { preHandler: requireAuth }, async (req, reply) => {
      const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true } })
      if (!lead) return reply.status(404).send({ error: 'Лид не найден' })
      const { calculateDealExtras } = await import('../lib/dealExtras')
      const extras = await calculateDealExtras(req.params.id)
      await prisma.deal.update({ where: { id: req.params.id }, data: extras })
      return { ok: true, ...extras }
    }
  )

  // ── Выставить счёт → конвертация лида в сделку ───────────────────────────

  app.post<{ Params: { id: string }; Body: {
    noInvoice?: boolean; invoiceUrl?: string | null
    installType?: string; direction?: string; glassSupply?: string; needPainting?: boolean
  } }>(
    '/:id/invoice', { preHandler: requireAuth }, async (req, reply) => {
      const lead = await prisma.deal.findFirst({ where: { id: req.params.id, isLead: true } })
      if (!lead) return reply.status(404).send({ error: 'Лид не найден' })
      if (!lead.contactId) return reply.status(400).send({ error: 'Нельзя выставить счёт без контакта' })

      const { noInvoice, invoiceUrl, installType, direction, glassSupply, needPainting } = req.body
      if (!noInvoice && !invoiceUrl) return reply.status(400).send({ error: 'Прикрепите файл счёта или отметьте "Без счёта"' })

      const caller = req.user as { id: string }
      const now = new Date()

      const deal = await prisma.deal.update({
        where: { id: req.params.id },
        data: {
          isLead: false,
          leadStatus: 'CONVERTED',
          stage: 'INVOICE_SENT' as never,
          invoiceSentAt: now,
          invoiceUrl: invoiceUrl ?? null,
          installType: (installType as never) ?? 'NONE',
          direction: (direction as never) ?? lead.direction,
          glassSupply: (glassSupply as never) ?? lead.glassSupply,
          needPainting: needPainting ?? lead.needPainting,
          events: {
            create: {
              type: 'CONVERTED',
              content: `Лид конвертирован в сделку. Счёт выставлен${noInvoice ? ' (без документа)' : ''}.`,
              userId: caller.id,
            },
          },
        },
        include: LEAD_INCLUDE,
      })

      return { ok: true, dealId: deal.id, number: deal.number }
    }
  )
}
