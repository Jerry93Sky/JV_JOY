import { PrismaClient } from '@prisma/client'
import { evaluateFormula } from '../lib/formulaEngine'

const p = new PrismaClient()

async function main() {
  const systems = await p.glazingSystem.findMany({
    include: { parameters: true }
  })

  for (const sys of systems) {
    if (!sys.name.includes('Слайдер')) continue
    console.log(`\n=== ${sys.name} ===`)

    // Строим тестовый контекст из всех параметров системы
    const context: Record<string, number | string | boolean> = {}

    // Константы
    for (const p of sys.parameters.filter(x => x.paramKind === 'CONSTANT')) {
      context[p.variable] = p.defaultValue ? parseFloat(p.defaultValue) : 0
    }

    // Вводные — ставим тестовые значения
    for (const p of sys.parameters.filter(x => x.paramKind === 'INPUT')) {
      if (p.type === 'NUMBER') context[p.variable] = 1000
      else if (p.type === 'BOOLEAN') context[p.variable] = false
      else context[p.variable] = ''
    }

    console.log(`  Контекст: ${Object.keys(context).join(', ')}`)

    // Рассчитываемые
    for (const param of sys.parameters.filter(x => x.paramKind === 'CALCULATED')) {
      if (!param.formula) continue
      try {
        evaluateFormula(param.formula, context)
        console.log(`  ✓ ${param.variable}`)
      } catch (e) {
        console.log(`  ❌ ${param.variable}: ${(e as Error).message}`)
        console.log(`     Формула: ${param.formula.substring(0, 80)}...`)
        // Найдём какие переменные в формуле не определены в контексте
        const usedVars = param.formula.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || []
        const missing = [...new Set(usedVars)].filter(v =>
          !['if', 'round', 'floor', 'ceil', 'min', 'max', 'abs', 'sqrt'].includes(v) &&
          !(v in context)
        )
        if (missing.length) console.log(`     Не определены: ${missing.join(', ')}`)
      }
    }
  }
}

main().finally(() => p.$disconnect())
