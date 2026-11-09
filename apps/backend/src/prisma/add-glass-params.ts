/**
 * Добавляет параметры стекла к уже существующим системам
 * Запуск: pnpm exec tsx src/prisma/add-glass-params.ts
 */
import { ParamKind, ParamType, PrismaClient } from '@prisma/client'
import { toPrismaJsonInput } from '../lib/prismaJson'

const prisma = new PrismaClient()

interface GlassParameterConfig {
  name: string
  variable: string
  type: ParamType
  paramKind: ParamKind
  defaultValue?: string
  showInProposal: boolean
  showInAssembly: boolean
  formula?: string
  options?: string
}

const GLASS_PARAMS: readonly GlassParameterConfig[] = [
  { name: 'Тип стекла', variable: 'glass_type', type: ParamType.SELECT, paramKind: ParamKind.INPUT, defaultValue: '6clear', showInProposal: true, showInAssembly: true,
    options: JSON.stringify([
      { label: '6 мм прозрачное', value: '6clear' },
      { label: '6 мм осветлённое', value: '6light' },
      { label: '6 мм тонированное', value: '6tinted' },
      { label: '6 мм матированное', value: '6matte' },
      { label: '8 мм прозрачное', value: '8clear' },
      { label: '8 мм осветлённое', value: '8light' },
      { label: '8 мм тонированное', value: '8tinted' },
      { label: '8 мм матированное', value: '8matte' },
      { label: '10 мм прозрачное', value: '10clear' },
      { label: '10 мм осветлённое', value: '10light' },
      { label: '10 мм тонированное', value: '10tinted' },
      { label: '10 мм матированное', value: '10matte' },
    ]),
  },
  { name: 'Цена стекла 6мм прозрачное (₽/м²)', variable: 'gp_6clear', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '4564', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 6мм осветлённое (₽/м²)', variable: 'gp_6light', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '8845', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 6мм тонированное (₽/м²)', variable: 'gp_6tinted', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '8845', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 6мм матированное (₽/м²)', variable: 'gp_6matte', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '7169', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 8мм прозрачное (₽/м²)', variable: 'gp_8clear', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '5553', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 8мм осветлённое (₽/м²)', variable: 'gp_8light', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '10956', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 8мм тонированное (₽/м²)', variable: 'gp_8tinted', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '10956', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 8мм матированное (₽/м²)', variable: 'gp_8matte', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '8565', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 10мм прозрачное (₽/м²)', variable: 'gp_10clear', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '6869', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 10мм осветлённое (₽/м²)', variable: 'gp_10light', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '13515', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 10мм тонированное (₽/м²)', variable: 'gp_10tinted', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '13515', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 10мм матированное (₽/м²)', variable: 'gp_10matte', type: ParamType.NUMBER, paramKind: ParamKind.CONSTANT, defaultValue: '11493', showInProposal: false, showInAssembly: false },
  {
    name: 'Стоимость стекла (₽)',
    variable: 'glass_cost',
    type: ParamType.NUMBER,
    paramKind: ParamKind.CALCULATED,
    defaultValue: undefined,
    showInProposal: true,
    showInAssembly: false,
    formula: `round(glassArea * if(glass_type == '6clear', gp_6clear, if(glass_type == '6light', gp_6light, if(glass_type == '6tinted', gp_6tinted, if(glass_type == '6matte', gp_6matte, if(glass_type == '8clear', gp_8clear, if(glass_type == '8light', gp_8light, if(glass_type == '8tinted', gp_8tinted, if(glass_type == '8matte', gp_8matte, if(glass_type == '10clear', gp_10clear, if(glass_type == '10light', gp_10light, if(glass_type == '10tinted', gp_10tinted, gp_10matte))))))))))), 0)`,
  },
]

async function main() {
  const systems = await prisma.glazingSystem.findMany({ include: { parameters: true } })

  for (const system of systems) {
    console.log(`\n🏗️  Система: ${system.name}`)
    const existingVars = new Set(system.parameters.map(p => p.variable))

    for (const param of GLASS_PARAMS) {
      if (existingVars.has(param.variable)) {
        console.log(`  ⏭️  ${param.variable} — уже есть`)
        continue
      }

      await prisma.systemParameter.create({
        data: {
          systemId: system.id,
          name: param.name,
          variable: param.variable,
          type: param.type,
          paramKind: param.paramKind,
          defaultValue: param.defaultValue ?? null,
          formula: param.formula ?? null,
          options: toPrismaJsonInput(param.options ?? null),
          showInProposal: param.showInProposal,
          showInAssembly: param.showInAssembly,
        },
      })
      console.log(`  ✓ ${param.name}`)
    }
  }

  console.log('\n✅ Параметры стекла добавлены во все системы!')
  console.log('   Цены можно изменить в редакторе системы → вкладка "Параметры" → константы.')
}

main()
  .catch(e => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
