/**
 * Импорт формул расчёта комплектующих из Excel в системы BMS
 * Запуск: pnpm exec tsx src/prisma/import-formulas.ts
 *
 * Логика формул JV-Line (из анализа Excel):
 * - D3=width, D4=height, D5=panels (вводные параметры)
 * - Настройки!D2=cutCoeff (0.9), D6=припуск_створочный (100мм), D7=припуск_несущий (100мм)
 * - D32 = длина несущего = раскрой (сложная, упрощаем)
 * - D33 = длина бокового = height - 148 (константа из настроек)
 * - F39 = суммарная длина створочного профиля
 *
 * Упрощённые формулы для нашего движка:
 * Несущий профиль: ceil((width + 100) / 1000 / cutCoeff) — длина в п.м. с раскроем
 * Створочный верхний/нижний: ceil((height + 100) * panels / 6000 / cutCoeff)
 * Боковой: if(hasSide, ceil((height - 148) * 2 / 6000 / cutCoeff), 0)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Формулы для JV-Line (Парковка)
// Переменные: width, height, panels, hasSide, cutCoeff=0.9, bearingW=44, bearingH=58
const LINE_COMPONENTS: Record<string, string> = {
  'LN-010': 'round((width + 100) / 1000 / cutCoeff, 3)',                          // Профиль несущий (п.м.)
  'LN-020': 'round((height + 100) * panels / 6000 / cutCoeff, 3)',                // Профиль створочный верхний (п.м.)
  'LN-030': 'round((height + 100) * panels / 6000 / cutCoeff, 3)',                // Профиль створочный нижний (п.м.)
  'LN-040': 'if(hasSide, round((height - 148) * 2 / 6000 / cutCoeff, 3), 0)',    // Профиль боковой (п.м.)
  'LN-050-L': '1',                                                                  // Тройник левый (шт)
  'LN-050-R': '1',                                                                  // Тройник правый (шт)
  'LN-060': 'panels - 1',                                                           // Роликовая каретка низкая (шт)
  'LN-070-A': 'panels - 1',                                                         // Роликовая каретка высокая (шт)
  'LN-080': 'panels',                                                               // Защёлка боковая (шт)
  'LN-090': 'panels',                                                               // Защёлка продольная (шт)
  'LN-100': 'panels',                                                               // Ответная втулка (шт)
  'LN-110': 'panels',                                                               // Ручка-кноб (шт)
  'LN-120': 'panels',                                                               // Поворотный узел нижний (шт)
  'LN-130': 'panels',                                                               // Поворотный узел верхний (шт)
  'LN-140-L': '1',                                                                  // Отсекатель левый (шт)
  'LN-140-R': '1',                                                                  // Отсекатель правый (шт)
  'LN-150': 'panels - 1',                                                           // Пластина соединительная (шт)
  'LN-180': 'panels',                                                               // Спейсер (шт)
  'LN-TL': '1',                                                                     // Заглушка верхняя рядовая левая
  'LN-TR': '1',                                                                     // Заглушка верхняя рядовая правая
  'LN-BL': '1',                                                                     // Заглушка нижняя рядовая левая
  'LN-BR': '1',                                                                     // Заглушка нижняя рядовая правая
  'LN-T90': 'if(hasSide, 1, 0)',                                                    // Заглушка верхняя 90° (пара)
  'LN-B90': 'if(hasSide, 1, 0)',                                                    // Заглушка нижняя 90° (пара)
  'LN-210': 'panels',                                                               // Верхняя петля + башмаки (шт)
  'LN-220': 'panels',                                                               // Нижняя петля + башмаки (шт)
  'AA-020': 'round((width + height * 2) * panels / 1000, 1)',                      // Уплотнитель щёточный (м)
  'AA-050': 'panels',                                                               // Уплотнитель h-типа (шт, 3м)
  'AA-110': 'ceil(width * height * panels / 1000000 / 18)',                        // Активатор (шт)
  'AA-120': 'ceil(width * height * panels / 1000000 / 18)',                        // Клей (шт)
}

// Формулы для JV-Zigzag (Гармошка)
const ZIGZAG_COMPONENTS: Record<string, string> = {
  'LN-010': 'round((width + 100) / 1000 / cutCoeff, 3)',
  'LN-020': 'round((height + 100) * panels / 6000 / cutCoeff, 3)',
  'LN-030': 'round((height + 100) * panels / 6000 / cutCoeff, 3)',
  'LN-040': 'if(hasSide, round((height - 148) * 2 / 6000 / cutCoeff, 3), 0)',
  'LN-060': 'panels - 1',
  'LN-070-A': 'panels - 1',
  'LN-080': 'panels',
  'LN-090': 'panels',
  'LN-100': 'panels',
  'LN-110': 'panels',
  'LN-120': 'panels',
  'LN-130': 'panels',
  'LN-140-L': '1',
  'LN-140-R': '1',
  'LN-150': 'panels - 1',
  'LN-TL': '1',
  'LN-TR': '1',
  'LN-BL': '1',
  'LN-BR': '1',
  'LN-210': 'panels',
  'LN-220': 'panels',
  'AA-020': 'round((width + height * 2) * panels / 1000, 1)',
  'AA-050': 'panels',
  'AA-110': 'ceil(width * height * panels / 1000000 / 18)',
  'AA-120': 'ceil(width * height * panels / 1000000 / 18)',
}

// Формулы для JV-Slider (Раздвижка)
// tracks=3 или 5 (тип дорожек)
const SLIDER_COMPONENTS: Record<string, string> = {
  'S-010': 'if(tracks == 3, round(width / 1000 / cutCoeff, 3), 0)',               // Профиль верхний 3-дорожечный
  'S-020': 'if(tracks == 5, round(width / 1000 / cutCoeff, 3), 0)',               // Профиль верхний 5-дорожечный
  'SL-110': 'if(tracks == 3, round(width / 1000 / cutCoeff, 3), 0)',              // Профиль L опорный 3-дорож.
  'SL-120': 'if(tracks == 5, round(width / 1000 / cutCoeff, 3), 0)',              // Профиль L опорный 5-дорож.
  'SL-130': 'if(tracks == 3, round((height + 50) * panels / 6000 / cutCoeff, 3), 0)', // Профиль L створочный
  'SX-130': 'if(tracks == 5, round((height + 50) * panels / 6000 / cutCoeff, 3), 0)', // Профиль X створочный
  'S-030': 'round((height - 100) * 2 / 6000 / cutCoeff, 3)',                      // Боковой профиль
  'SL-140-L': '1',
  'SL-140-R': '1',
  'SL-150': 'panels',                                                               // Роликовая каретка L
  'SL-160': 'panels',                                                               // Задвижка нижняя L
  'AA-030': 'round(width * 2 / 1000, 1)',                                           // Уплотнитель щёточный 5х4
  'AA-040': 'round(height * panels / 1000, 1)',                                     // Уплотнитель щёточный 5x9
  'AA-110': 'ceil(width * height * panels / 1000000 / 18)',
  'AA-120': 'ceil(width * height * panels / 1000000 / 18)',
}

// Формулы для JV-Front (Стационарное)
const FRONT_COMPONENTS: Record<string, string> = {
  'AYPC.115.0011': 'round(width / 1000 / cutCoeff, 3)',                            // Направляющая зажимного (м)
  'AYPC.115.0004': 'round(width / 1000 / cutCoeff, 3)',                            // Крышка зажимного (м)
  'AYPC.115.0101': 'panels * 2',                                                    // Клипса (шт)
  'AYPC.115.0102': 'panels * 2',                                                    // Вставка (шт)
  'AYPC.115.0902': 'panels * 2',                                                    // Подкладка опорная (шт)
  'AYPC.115.0905': '2',                                                             // Заглушка (шт)
  'AA-050': 'panels',                                                               // Уплотнитель h-типа
  'AA-070': 'panels',                                                               // Уплотнитель D-типа
}

const SYSTEM_FORMULAS: Record<string, Record<string, string>> = {
  'JV-Line (Парковка)': LINE_COMPONENTS,
  'JV-Zigzag (Гармошка)': ZIGZAG_COMPONENTS,
  'JV-Slider (Раздвижка)': SLIDER_COMPONENTS,
  'JV-Front (Стационарное)': FRONT_COMPONENTS,
}

async function main() {
  console.log('🔧 Импорт формул расчёта комплектующих...\n')

  // Сначала добавляем недостающие товары Slider
  console.log('📦 Добавляем недостающие профили Slider...')
  const sliderProfiles = [
    { sku: 'S-010', name: 'Профиль верхний 3-дорожечный', unit: 'п.м.', markupRetail: 30, markupWholesale: 15, priceRetail: 3732, priceWholesale: 3295 },
    { sku: 'S-020', name: 'Профиль верхний 5-дорожечный', unit: 'п.м.', markupRetail: 30, markupWholesale: 15, priceRetail: 6603, priceWholesale: 5841 },
    { sku: 'S-030', name: 'Боковой профиль Slider', unit: 'п.м.', markupRetail: 30, markupWholesale: 15, priceRetail: 802, priceWholesale: 709 },
  ]

  const profileType = await prisma.productType.findFirst({ where: { name: 'Профиль' } })
  if (profileType) {
    for (const p of sliderProfiles) {
      const exists = await prisma.product.findUnique({ where: { sku: p.sku } })
      if (!exists) {
        await prisma.product.create({ data: { ...p, typeId: profileType.id, isPaintable: true } })
        console.log(`  + ${p.sku}: ${p.name}`)
      } else {
        console.log(`  ⏭️  ${p.sku} уже есть`)
      }
    }
  }

  for (const [systemName, formulas] of Object.entries(SYSTEM_FORMULAS)) {
    const system = await prisma.glazingSystem.findFirst({
      where: { name: systemName },
      include: { components: { include: { product: true } } },
    })

    if (!system) {
      console.log(`⚠️  Система "${systemName}" не найдена`)
      continue
    }

    console.log(`\n📐 ${systemName}`)
    let updated = 0, skipped = 0, notFound = 0

    for (const [sku, formula] of Object.entries(formulas)) {
      // Находим товар по артикулу
      const product = await prisma.product.findUnique({ where: { sku } })
      if (!product) {
        console.log(`  ⚠️  Товар ${sku} не найден на складе`)
        notFound++
        continue
      }

      // Проверяем есть ли уже компонент
      const existing = system.components.find(c => c.productId === product.id)

      if (existing) {
        // Обновляем формулу
        await prisma.systemComponent.update({
          where: { id: existing.id },
          data: { formula },
        })
        console.log(`  ✓ [${sku}] обновлена формула: ${formula}`)
        updated++
      } else {
        // Создаём новый компонент
        await prisma.systemComponent.create({
          data: { systemId: system.id, productId: product.id, formula },
        })
        console.log(`  + [${sku}] добавлен с формулой: ${formula}`)
        updated++
      }
    }

    console.log(`  Итого: ${updated} обновлено/добавлено, ${notFound} товаров не найдено`)
  }

  console.log('\n✅ Формулы импортированы!')
  console.log('\n⚠️  Важно: формулы являются упрощёнными аппроксимациями.')
  console.log('   Для точного расчёта рекомендуется проверить и скорректировать')
  console.log('   формулы в редакторе систем после первых реальных расчётов.')
}

main()
  .catch(e => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
