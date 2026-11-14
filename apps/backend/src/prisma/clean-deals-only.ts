/**
 * Удаляет только сделки и лиды (все записи в таблице Deal).
 * Сохраняет: контакты, компании, товары, системы, пользователей.
 *
 * Запуск: npx tsx src/prisma/clean-deals-only.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Удаление всех сделок и лидов...\n')

  const dealEvents   = await prisma.dealEvent.deleteMany()
  console.log(`  ✓ Событий сделок: ${dealEvents.count}`)

  const leadEvents   = await prisma.leadEvent.deleteMany()
  console.log(`  ✓ Событий лидов: ${leadEvents.count}`)

  const tasks        = await prisma.leadTask.deleteMany()
  console.log(`  ✓ Задач: ${tasks.count}`)

  const proposals    = await prisma.commercialProposal.deleteMany()
  console.log(`  ✓ КП: ${proposals.count}`)

  const dealFiles    = await prisma.dealFile.deleteMany()
  console.log(`  ✓ Файлов: ${dealFiles.count}`)

  const dealItems    = await prisma.dealItem.deleteMany()
  console.log(`  ✓ Позиций: ${dealItems.count}`)

  const dealServices = await prisma.dealService.deleteMany()
  console.log(`  ✓ Услуг: ${dealServices.count}`)

  const dealSystems  = await prisma.dealSystem.deleteMany()
  console.log(`  ✓ Систем в заказах: ${dealSystems.count}`)

  const expenses     = await prisma.expense.deleteMany()
  console.log(`  ✓ Расходов: ${expenses.count}`)

  // Сбрасываем резервы на складе
  await prisma.product.updateMany({ data: { reservedQty: 0 } })
  console.log(`  ✓ Резервы склада обнулены`)

  const deals = await prisma.deal.deleteMany()
  console.log(`\n  ✅ Удалено сделок/лидов: ${deals.count}`)

  console.log('\nСохранено:')
  console.log(`  👤 Контактов: ${await prisma.contact.count()}`)
  console.log(`  🏢 Компаний: ${await prisma.company.count()}`)
  console.log(`  📦 Товаров: ${await prisma.product.count()}`)
  console.log(`  🏗️  Систем: ${await prisma.glazingSystem.count()}`)
}

main()
  .catch(e => { console.error('❌ Ошибка:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
