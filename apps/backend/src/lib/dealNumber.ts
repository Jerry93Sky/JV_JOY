import { prisma } from './prisma'

export async function generateDealNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.deal.count()
  return `${year}-${String(count + 1).padStart(4, '0')}`
}
