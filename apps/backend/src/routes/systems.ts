import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../lib/auth'
import { Role } from '@bms/shared'
import { evaluateFormula } from '../lib/formulaEngine'

export async function systemRoutes(app: FastifyInstance) {
  // Список систем
  app.get<{ Querystring: { includeInactive?: string } }>('/', { preHandler: requireAuth }, async (req) => {
    const includeInactive = req.query.includeInactive === 'true'
    return prisma.glazingSystem.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: { parameters: { include: { limits: true }, orderBy: { name: 'asc' } }, components: { include: { product: true } }, categories: { orderBy: { order: 'asc' } }, glasses: { include: { glassType: true }, orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' },
    })
  })

  app.get<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const s = await prisma.glazingSystem.findUnique({
      where: { id: req.params.id },
      include: { parameters: { include: { limits: true }, orderBy: { name: 'asc' } }, components: { include: { product: true } }, categories: { orderBy: { order: 'asc' } }, glasses: { include: { glassType: true }, orderBy: { order: 'asc' } } },
    })
    if (!s) return reply.status(404).send({ error: 'Не найдена' })
    return s
  })

  // Создание системы
  app.post<{ Body: { name: string } }>('/', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
    if (!req.body.name) return reply.status(400).send({ error: 'Укажите название' })
    return reply.status(201).send(await prisma.glazingSystem.create({ data: { name: req.body.name }, include: { parameters: true, components: true } }))
  })

  // Обновление системы (название, активность, формулы)
  app.patch<{ Params: { id: string }; Body: { name?: string; isActive?: boolean; installFormula?: string | null; installCostFormula?: string | null; glassFormula?: string | null } }>(
    '/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const s = await prisma.glazingSystem.findUnique({ where: { id: req.params.id } })
      if (!s) return reply.status(404).send({ error: 'Не найдена' })
      return prisma.glazingSystem.update({ where: { id: req.params.id }, data: req.body, include: { parameters: { include: { limits: true } }, components: { include: { product: true } } } })
    }
  )

  app.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
    await prisma.glazingSystem.delete({ where: { id: req.params.id } })
    return { ok: true }
  })

  // Дублировать систему со всеми параметрами и комплектующими
  app.post<{ Params: { id: string }; Body: { name?: string } }>(
    '/:id/duplicate', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const source = await prisma.glazingSystem.findUnique({
        where: { id: req.params.id },
        include: {
          parameters: { include: { limits: true } },
          components: true,
          categories: true,
        },
      })
      if (!source) return reply.status(404).send({ error: 'Система не найдена' })

      const newName = req.body.name || `${source.name} (копия)`

      const newSystem = await prisma.$transaction(async (tx) => {
        // Создаём новую систему
        const sys = await tx.glazingSystem.create({
          data: {
            name: newName,
            isActive: source.isActive,
            installFormula: source.installFormula,
            glassFormula: source.glassFormula,
          },
        })

        // Копируем категории и запоминаем маппинг старый id → новый id
        const catMap: Record<string, string> = {}
        for (const cat of source.categories) {
          const newCat = await tx.systemParamCategory.create({
            data: { systemId: sys.id, name: cat.name, order: cat.order },
          })
          catMap[cat.id] = newCat.id
        }

        // Копируем параметры
        for (const p of source.parameters) {
          const newParam = await tx.systemParameter.create({
            data: {
              systemId: sys.id,
              categoryId: p.categoryId ? catMap[p.categoryId] ?? null : null,
              name: p.name,
              variable: p.variable,
              type: p.type,
              paramKind: p.paramKind,
              options: p.options ?? undefined,
              formula: p.formula,
              defaultValue: p.defaultValue,
              showInProposal: p.showInProposal,
              showInAssembly: p.showInAssembly,
              proposalPriority: p.proposalPriority,
            },
          })
          // Копируем лимиты
          for (const lim of p.limits) {
            await tx.systemLimit.create({
              data: { parameterId: newParam.id, minValue: lim.minValue, maxValue: lim.maxValue },
            })
          }
        }

        // Копируем комплектующие
        for (const c of source.components) {
          await tx.systemComponent.create({
            data: { systemId: sys.id, productId: c.productId, formula: c.formula },
          })
        }

        return tx.glazingSystem.findUnique({
          where: { id: sys.id },
          include: { parameters: { include: { limits: true } }, components: { include: { product: true } }, categories: true },
        })
      })

      return reply.status(201).send(newSystem)
    }
  )

  // ── Категории параметров ──────────────────────────────────────────────────

  app.get<{ Params: { id: string } }>('/:id/categories', { preHandler: requireAuth }, async (req) =>
    prisma.systemParamCategory.findMany({ where: { systemId: req.params.id }, orderBy: { order: 'asc' } })
  )

  app.post<{ Params: { id: string }; Body: { name: string; order?: number } }>(
    '/:id/categories', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      return reply.status(201).send(await prisma.systemParamCategory.create({
        data: { systemId: req.params.id, name: req.body.name, order: req.body.order ?? 0 },
      }))
    }
  )

  app.patch<{ Params: { id: string; catId: string }; Body: { name?: string; order?: number } }>(
    '/:id/categories/:catId', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) =>
      prisma.systemParamCategory.update({ where: { id: req.params.catId }, data: req.body })
  )

  app.delete<{ Params: { id: string; catId: string } }>(
    '/:id/categories/:catId', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
      await prisma.systemParamCategory.delete({ where: { id: req.params.catId } })
      return { ok: true }
    }
  )

  // ── Параметры ──────────────────────────────────────────────────────────────

  app.post<{ Params: { id: string }; Body: { name: string; variable: string; type: string; paramKind: string; options?: unknown; formula?: string; defaultValue?: string; showInProposal?: boolean; showInAssembly?: boolean; proposalPriority?: number; categoryId?: string; isAdvanced?: boolean } }>(
    '/:id/parameters', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const { name, variable, type, paramKind, options, formula, defaultValue, showInProposal, showInAssembly, proposalPriority, categoryId, isAdvanced } = req.body
      if (!name || !variable || !type || !paramKind) return reply.status(400).send({ error: 'Заполните обязательные поля' })
      if (!/^[a-zA-Z_]/.test(variable)) return reply.status(400).send({ error: 'Переменная должна начинаться с буквы или _' })
      return reply.status(201).send(await prisma.systemParameter.create({
        data: { systemId: req.params.id, name, variable, type: type as never, paramKind: paramKind as never, options: options as never, formula, defaultValue, showInProposal: showInProposal ?? false, showInAssembly: showInAssembly ?? false, proposalPriority: proposalPriority ?? 0, categoryId: categoryId ?? null, isAdvanced: isAdvanced ?? false },
        include: { limits: true },
      }))
    }
  )

  app.patch<{ Params: { id: string; paramId: string }; Body: { name?: string; variable?: string; options?: unknown; formula?: string; defaultValue?: string; showInProposal?: boolean; showInAssembly?: boolean; proposalPriority?: number; categoryId?: string | null; isAdvanced?: boolean } }>(
    '/:id/parameters/:paramId', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const data = { ...req.body as never, categoryId: req.body.categoryId === null ? null : (req.body.categoryId || undefined) }
      return prisma.systemParameter.update({
        where: { id: req.params.paramId },
        data,
        include: { limits: true },
      })
    }
  )

  app.delete<{ Params: { id: string; paramId: string } }>(
    '/:id/parameters/:paramId', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      await prisma.systemParameter.delete({ where: { id: req.params.paramId } })
      return { ok: true }
    }
  )

  // Batch-обновление приоритетов (для drag-and-drop)
  app.post<{ Params: { id: string }; Body: { priorities: { id: string; proposalPriority: number }[] } }>(
    '/:id/parameters/reorder', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
      await prisma.$transaction(
        req.body.priorities.map(({ id, proposalPriority }) =>
          prisma.systemParameter.update({ where: { id }, data: { proposalPriority } })
        )
      )
      return { ok: true }
    }
  )

  // Лимиты
  app.post<{ Params: { id: string; paramId: string }; Body: { minValue?: number; maxValue?: number } }>(
    '/:id/parameters/:paramId/limits', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      return reply.status(201).send(await prisma.systemLimit.create({
        data: { parameterId: req.params.paramId, minValue: req.body.minValue, maxValue: req.body.maxValue },
      }))
    }
  )

  app.patch<{ Params: { id: string; paramId: string; limitId: string }; Body: { minValue?: number; maxValue?: number } }>(
    '/:id/parameters/:paramId/limits/:limitId', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
      return prisma.systemLimit.update({ where: { id: req.params.limitId }, data: req.body })
    }
  )

  // ── Комплектующие системы ──────────────────────────────────────────────────

  app.post<{ Params: { id: string }; Body: { productId: string; formula: string } }>(
    '/:id/components', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const { productId, formula } = req.body
      if (!productId || !formula) return reply.status(400).send({ error: 'Заполните обязательные поля' })
      return reply.status(201).send(await prisma.systemComponent.create({
        data: { systemId: req.params.id, productId, formula },
        include: { product: true },
      }))
    }
  )

  app.patch<{ Params: { id: string; componentId: string }; Body: { formula: string } }>(
    '/:id/components/:componentId', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
      return prisma.systemComponent.update({ where: { id: req.params.componentId }, data: { formula: req.body.formula }, include: { product: true } })
    }
  )

  app.delete<{ Params: { id: string; componentId: string } }>(
    '/:id/components/:componentId', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
      await prisma.systemComponent.delete({ where: { id: req.params.componentId } })
      return { ok: true }
    }
  )

  // ── Расчёт ────────────────────────────────────────────────────────────────

  app.post<{ Params: { id: string }; Body: { inputs: Record<string, number | string | boolean>; direction?: 'PRIVATE' | 'DEALER'; glassTypeOverrides?: Record<string, string> } }>(
    '/:id/calculate', { preHandler: requireAuth }, async (req, reply) => {
      const system = await prisma.glazingSystem.findUnique({
        where: { id: req.params.id },
        include: {
          parameters: { include: { limits: true } },
          components: { include: { product: true } },
          glasses: { include: { glassType: true }, orderBy: { order: 'asc' } },
        },
      })
      if (!system) return reply.status(404).send({ error: 'Система не найдена' })

      const { inputs, direction } = req.body
      const context: Record<string, number | string | boolean> = {}
      for (const [k, v] of Object.entries(inputs)) {
        if (typeof v === 'string') {
          const num = parseFloat(v)
          context[k] = !isNaN(num) && String(num) === v.trim() ? num : v
        } else {
          context[k] = v
        }
      }

      // Константы
      for (const p of system.parameters.filter(p => p.paramKind === 'CONSTANT')) {
        context[p.variable] = p.defaultValue ? parseFloat(p.defaultValue) : 0
      }

      // Рассчитываемые параметры (3 прохода для зависимостей)
      const calculated = system.parameters.filter(p => p.paramKind === 'CALCULATED')
      const calcErrors: string[] = []
      for (let pass = 0; pass < 3; pass++) {
        for (const p of calculated) {
          if (p.formula) {
            try { context[p.variable] = evaluateFormula(p.formula, context) }
            catch (e) {
              context[p.variable] = 0
              if (pass === 2) calcErrors.push(`${p.name} (${p.variable}): ${(e as Error).message}`)
            }
          }
        }
      }

      // Проверка лимитов
      const warnings: { paramName: string; variable: string; value: number; min?: number; max?: number }[] = []
      for (const p of system.parameters) {
        for (const limit of p.limits) {
          const val = Number(context[p.variable])
          if ((limit.minValue !== null && val < Number(limit.minValue)) ||
              (limit.maxValue !== null && val > Number(limit.maxValue))) {
            warnings.push({ paramName: p.name, variable: p.variable, value: val, min: limit.minValue ? Number(limit.minValue) : undefined, max: limit.maxValue ? Number(limit.maxValue) : undefined })
          }
        }
      }

      // Расчёт комплектующих
      const componentErrors: string[] = []
      const components = system.components.map(c => {
        let qty = 0
        try { qty = Number(evaluateFormula(c.formula, context)) } catch (e) {
          qty = 0
          componentErrors.push(`${c.product.name}: ${(e as Error).message}`)
        }
        const price = direction === 'DEALER' ? Number(c.product.priceWholesale) : Number(c.product.priceRetail)
        return {
          productId: c.productId,
          productName: c.product.name,
          productSku: c.product.sku,
          unit: c.product.unit,
          sellingPrice: Math.round(price * 100) / 100,
          quantity: Math.round(qty * 1000) / 1000,
          formula: c.formula,
        }
      })

      // Расчёт стёкол
      const glassErrors: string[] = []
      const { glassTypeOverrides = {} } = req.body
      const glasses = system.glasses.map(g => {
        let widthMm = 0, heightMm = 0, qty = 1
        try { widthMm = Math.round(Number(evaluateFormula(g.widthFormula, context))) } catch (e) { glassErrors.push(`${g.name} ширина: ${(e as Error).message}`) }
        try { heightMm = Math.round(Number(evaluateFormula(g.heightFormula, context))) } catch (e) { glassErrors.push(`${g.name} высота: ${(e as Error).message}`) }
        try { qty = Math.round(Number(evaluateFormula(g.quantityFormula, context))) } catch { qty = 1 }
        const sqm = Math.round((widthMm / 1000) * (heightMm / 1000) * 1000) / 1000
        const glassTypeId = glassTypeOverrides[g.id] || g.glassTypeId || null
        const glassType = glassTypeId ? (g.glassType?.id === glassTypeId ? g.glassType : null) : null
        let costPricePerSqm = 0, sellingPricePerSqm = 0
        if (glassType) {
          const gc = g.complexity
          if (gc === 'CUTS' && glassType.costPriceWithCuts != null) { costPricePerSqm = Number(glassType.costPriceWithCuts); sellingPricePerSqm = Number(glassType.sellingPriceWithCuts ?? glassType.sellingPricePerSqm) }
          else if (gc === 'CUTS' && glassType.surchargeWithCutsPct != null) { const p = 1 + Number(glassType.surchargeWithCutsPct) / 100; costPricePerSqm = Number(glassType.costPricePerSqm) * p; sellingPricePerSqm = Number(glassType.sellingPricePerSqm) * p }
          else if (gc === 'HOLES' && glassType.costPriceWithHoles != null) { costPricePerSqm = Number(glassType.costPriceWithHoles); sellingPricePerSqm = Number(glassType.sellingPriceWithHoles ?? glassType.sellingPricePerSqm) }
          else if (gc === 'HOLES' && glassType.surchargeWithHolesPct != null) { const p = 1 + Number(glassType.surchargeWithHolesPct) / 100; costPricePerSqm = Number(glassType.costPricePerSqm) * p; sellingPricePerSqm = Number(glassType.sellingPricePerSqm) * p }
          else { costPricePerSqm = Number(glassType.costPricePerSqm); sellingPricePerSqm = Number(glassType.sellingPricePerSqm) }
        }
        const totalSqm = sqm * qty
        return { systemGlassId: g.id, name: g.name, widthMm, heightMm, quantity: qty, sqm, totalSqm, complexity: g.complexity, glassTypeId, needsGlassTypeSelection: !glassTypeId, costPricePerSqm: Math.round(costPricePerSqm * 100) / 100, sellingPricePerSqm: Math.round(sellingPricePerSqm * 100) / 100, costTotal: Math.round(totalSqm * costPricePerSqm * 100) / 100, sellingTotal: Math.round(totalSqm * sellingPricePerSqm * 100) / 100 }
      })
      const needsGlassSelection = glasses.some(g => g.needsGlassTypeSelection)
      let installSellingPrice = 0, installCostPrice = 0
      if (system.installFormula) {
        try { installSellingPrice = Math.round(Number(evaluateFormula(system.installFormula, context)) * 100) / 100 } catch { installSellingPrice = 0 }
      }
      if (system.installCostFormula) {
        try { installCostPrice = Math.round(Number(evaluateFormula(system.installCostFormula, context)) * 100) / 100 } catch { installCostPrice = 0 }
      }

      // Параметры для отображения
      const displayParams = system.parameters.map(p => ({
        name: p.name,
        variable: p.variable,
        value: context[p.variable],
        showInProposal: p.showInProposal,
        showInAssembly: p.showInAssembly,
        paramKind: p.paramKind,
      }))

      return { context, displayParams, components, glasses, needsGlassSelection, install: { sellingPrice: installSellingPrice, costPrice: installCostPrice }, warnings, calcErrors, componentErrors, glassErrors }
    }
  )

  // ── Стёкла системы ────────────────────────────────────────────────────────

  app.get<{ Params: { id: string } }>('/:id/glasses', { preHandler: requireAuth }, async (req) =>
    prisma.systemGlass.findMany({ where: { systemId: req.params.id }, include: { glassType: true }, orderBy: { order: 'asc' } })
  )

  app.post<{ Params: { id: string }; Body: { name: string; widthFormula: string; heightFormula: string; quantityFormula?: string; complexity?: string; glassTypeId?: string | null; order?: number } }>(
    '/:id/glasses', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req, reply) => {
      const { name, widthFormula, heightFormula, quantityFormula, complexity, glassTypeId, order } = req.body
      if (!name || !widthFormula || !heightFormula) return reply.status(400).send({ error: 'Заполните обязательные поля' })
      return reply.status(201).send(await prisma.systemGlass.create({
        data: { systemId: req.params.id, name, widthFormula, heightFormula, quantityFormula: quantityFormula ?? '1', complexity: (complexity as never) ?? 'PLAIN', glassTypeId: glassTypeId ?? null, order: order ?? 0 },
        include: { glassType: true },
      }))
    }
  )

  app.patch<{ Params: { id: string; glassId: string }; Body: { name?: string; widthFormula?: string; heightFormula?: string; quantityFormula?: string; complexity?: string; glassTypeId?: string | null; order?: number } }>(
    '/:id/glasses/:glassId', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
      const data = { ...req.body as never, glassTypeId: req.body.glassTypeId === null ? null : (req.body.glassTypeId || undefined) }
      return prisma.systemGlass.update({ where: { id: req.params.glassId }, data, include: { glassType: true } })
    }
  )

  app.delete<{ Params: { id: string; glassId: string } }>(
    '/:id/glasses/:glassId', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (req) => {
      await prisma.systemGlass.delete({ where: { id: req.params.glassId } })
      return { ok: true }
    }
  )
}
