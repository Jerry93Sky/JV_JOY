/**
 * Очистка тестовых данных перед развёртыванием.
 * Удаляет: сделки, лиды, контакты, компании, расходы.
 * Сохраняет: пользователей, товары, системы, параметры, формулы, услуги, настройки.
 *
 * Запуск: pnpm exec tsx src/prisma/clean-test-data.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Очистка тестовых данных...\n')

  // Порядок важен из-за foreign key constraints

  // Сделки и всё связанное
  const dealEvents = await prisma.dealEvent.deleteMany()
  console.log(`  ✓ Удалено событий сделок: ${dealEvents.count}`)

  const leadEvents = await prisma.leadEvent.deleteMany()
  console.log(`  ✓ Удалено событий лидов: ${leadEvents.count}`)

  const proposals = await prisma.commercialProposal.deleteMany()
  console.log(`  ✓ Удалено КП: ${proposals.count}`)

  const dealFiles = await prisma.dealFile.deleteMany()
  console.log(`  ✓ Удалено файлов сделок: ${dealFiles.count}`)

  const dealItems = await prisma.dealItem.deleteMany()
  console.log(`  ✓ Удалено позиций сделок: ${dealItems.count}`)

  const dealServices = await prisma.dealService.deleteMany()
  console.log(`  ✓ Удалено услуг в сделках: ${dealServices.count}`)

  const dealSystems = await prisma.dealSystem.deleteMany()
  console.log(`  ✓ Удалено систем в сделках: ${dealSystems.count}`)

  const expenses = await prisma.expense.deleteMany()
  console.log(`  ✓ Удалено расходов: ${expenses.count}`)

  const deals = await prisma.deal.deleteMany()
  console.log(`  ✓ Удалено сделок/лидов: ${deals.count}`)

  // Клиентская база
  const contactCompanies = await prisma.contactCompany.deleteMany()
  console.log(`  ✓ Удалено связей контакт-компания: ${contactCompanies.count}`)

  const contacts = await prisma.contact.deleteMany()
  console.log(`  ✓ Удалено контактов: ${contacts.count}`)

  const companyFiles = await prisma.companyFile.deleteMany()
  console.log(`  ✓ Удалено файлов компаний: ${companyFiles.count}`)

  const bankAccounts = await prisma.bankAccount.deleteMany()
  console.log(`  ✓ Удалено банковских счетов: ${bankAccounts.count}`)

  const companyRelations = await prisma.companyRelation.deleteMany()
  console.log(`  ✓ Удалено связей компаний: ${companyRelations.count}`)

  const companies = await prisma.company.deleteMany()
  console.log(`  ✓ Удалено компаний: ${companies.count}`)

  // Склад — приходы и списания (товары оставляем)
  const receiptItems = await prisma.receiptItem.deleteMany()
  console.log(`  ✓ Удалено позиций приходов: ${receiptItems.count}`)

  const receipts = await prisma.receipt.deleteMany()
  console.log(`  ✓ Удалено приходов: ${receipts.count}`)

  const writeoffItems = await prisma.writeoffItem.deleteMany()
  console.log(`  ✓ Удалено позиций списаний: ${writeoffItems.count}`)

  const writeoffs = await prisma.writeoff.deleteMany()
  console.log(`  ✓ Удалено списаний: ${writeoffs.count}`)

  // Сбрасываем остатки и резервы на складе
  await prisma.product.updateMany({
    data: { quantity: 0, reservedQty: 0 },
  })
  console.log(`  ✓ Остатки склада обнулены`)

  console.log('\n✅ Очистка завершена!')
  console.log('\nСохранено:')
  const users = await prisma.user.count()
  const products = await prisma.product.count()
  const systems = await prisma.glazingSystem.count()
  const services = await prisma.service.count()
  console.log(`  👤 Пользователей: ${users}`)
  console.log(`  📦 Товаров на складе: ${products}`)
  console.log(`  🏗️  Систем остекления: ${systems}`)
  console.log(`  🔧 Услуг: ${services}`)
}

main()
  .catch(e => { console.error('❌ Ошибка:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
