import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.findUnique({ where: { login: 'admin' } })
  if (existing) {
    console.log('Seed already done, skipping.')
    return
  }

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD
  if (!initialPassword) {
    throw new Error('ADMIN_INITIAL_PASSWORD is required before creating the initial admin user.')
  }

  const hash = await bcrypt.hash(initialPassword, 10)
  await prisma.user.create({
    data: {
      login: 'admin',
      password: hash,
      firstName: 'Администратор',
      lastName: 'Системы',
      role: 'OWNER',
    },
  })

  // Базовые категории расходов
  await prisma.expenseCategory.createMany({
    data: [
      { name: 'Покраска' },
      { name: 'Транспорт' },
      { name: 'Зарплата' },
      { name: 'Аренда помещения' },
      { name: 'Транспортные компании' },
      { name: 'Разработка' },
      { name: 'Прочее' },
    ],
  })

  // Базовые типы комплектующих
  await prisma.productType.createMany({
    data: [
      { name: 'Профиль' },
      { name: 'Фурнитура' },
      { name: 'Уплотнители' },
      { name: 'Крепёж' },
      { name: 'Прочее' },
    ],
  })

  // Настройка наценки на стекло по умолчанию
  await prisma.setting.create({
    data: { key: 'glass_markup_pct', value: '30' },
  })

  console.log('✅ Seed completed.')
  console.log('   Login: admin')
  console.log('   Set the initial admin password through ADMIN_INITIAL_PASSWORD.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
