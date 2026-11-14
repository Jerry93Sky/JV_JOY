/**
 * Скрипт импорта систем остекления из systems-export.json
 * Запускать на сервере: node import-systems.mjs
 *
 * ВАЖНО: Запускать только если системы отсутствуют в БД!
 * Скрипт не перезаписывает существующие системы.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

const p = new PrismaClient()

const systems = JSON.parse(readFileSync('systems-export.json', 'utf-8'))
console.log(`Importing ${systems.length} systems...`)

for (const sys of systems) {
  const existing = await p.glazingSystem.findUnique({ where: { id: sys.id } })
  if (existing) {
    console.log(`  SKIP (already exists): ${sys.name}`)
    continue
  }

  await p.$transaction(async (tx) => {
    // Создаём систему
    await tx.glazingSystem.create({
      data: {
        id: sys.id,
        name: sys.name,
        isActive: sys.isActive,
        installFormula: sys.installFormula ?? null,
        installCostFormula: sys.installCostFormula ?? null,
        glassFormula: sys.glassFormula ?? null,
        createdAt: new Date(sys.createdAt),
      }
    })

    // Категории
    const catMap = {}
    for (const cat of sys.categories || []) {
      const newCat = await tx.systemParamCategory.create({
        data: { id: cat.id, systemId: sys.id, name: cat.name, order: cat.order }
      })
      catMap[cat.id] = newCat.id
    }

    // Параметры
    for (const p of sys.parameters || []) {
      await tx.systemParameter.create({
        data: {
          id: p.id,
          systemId: sys.id,
          categoryId: p.categoryId ?? null,
          name: p.name,
          variable: p.variable,
          type: p.type,
          paramKind: p.paramKind,
          options: p.options ?? undefined,
          formula: p.formula ?? null,
          defaultValue: p.defaultValue ?? null,
          showInProposal: p.showInProposal ?? false,
          showInAssembly: p.showInAssembly ?? false,
          showInDeal: p.showInDeal ?? false,
          proposalPriority: p.proposalPriority ?? 0,
          isAdvanced: p.isAdvanced ?? false,
        }
      })
      // Лимиты
      for (const lim of p.limits || []) {
        await tx.systemLimit.create({
          data: { id: lim.id, parameterId: p.id, minValue: lim.minValue ?? null, maxValue: lim.maxValue ?? null }
        })
      }
    }

    // Комплектующие
    for (const c of sys.components || []) {
      // Проверяем что продукт существует
      const product = await tx.product.findUnique({ where: { id: c.productId } })
      if (!product) {
        console.log(`    WARNING: Product ${c.productId} not found, skipping component`)
        continue
      }
      await tx.systemComponent.create({
        data: { id: c.id, systemId: sys.id, productId: c.productId, formula: c.formula }
      })
    }

    // Стёкла системы
    for (const g of sys.glasses || []) {
      await tx.systemGlass.create({
        data: {
          id: g.id,
          systemId: sys.id,
          name: g.name,
          widthFormula: g.widthFormula,
          heightFormula: g.heightFormula,
          quantityFormula: g.quantityFormula ?? '1',
          complexity: g.complexity ?? 'PLAIN',
          glassTypeId: g.glassTypeId ?? null,
          order: g.order ?? 0,
        }
      })
    }
  })

  console.log(`  OK: ${sys.name}`)
}

console.log('Import complete!')
await p.$disconnect()
