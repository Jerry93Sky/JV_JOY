import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../lib/auth'

export async function contactRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string } }>('/', { preHandler: requireAuth }, async (req) => {
    const { q } = req.query
    return prisma.contact.findMany({
      where: q ? {
        OR: [
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { middleName: { contains: q, mode: 'insensitive' } },
        ],
      } : undefined,
      include: {
        companies: { include: { company: { select: { id: true, name: true } } } },
      },
      orderBy: { lastName: 'asc' },
    })
  })

  app.get<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        companies: { include: { company: true } },
        deals: { select: { id: true, number: true, stage: true, createdAt: true } },
      },
    })
    if (!contact) return reply.status(404).send({ error: 'Не найден' })
    return contact
  })

  app.post<{ Body: { lastName: string; firstName: string; middleName?: string; phone: string; email?: string; position?: string; companyIds?: string[] } }>(
    '/', { preHandler: requireAuth }, async (req, reply) => {
      const { companyIds, ...data } = req.body
      if (!data.lastName || !data.firstName || !data.phone) return reply.status(400).send({ error: 'Заполните обязательные поля' })

      // Проверка уникальности телефона
      const existingPhone = await prisma.contact.findFirst({ where: { phone: data.phone } })
      if (existingPhone) return reply.status(409).send({ error: `Телефон уже используется контактом "${existingPhone.lastName} ${existingPhone.firstName}"` })

      // Проверка уникальности email
      if (data.email) {
        const existingEmail = await prisma.contact.findFirst({ where: { email: data.email } })
        if (existingEmail) return reply.status(409).send({ error: `Email уже используется контактом "${existingEmail.lastName} ${existingEmail.firstName}"` })
      }

      const contact = await prisma.contact.create({
        data: {
          ...data,
          companies: companyIds?.length ? {
            create: companyIds.map((companyId) => ({ companyId })),
          } : undefined,
        },
        include: { companies: { include: { company: { select: { id: true, name: true } } } } },
      })
      return reply.status(201).send(contact)
    }
  )

  app.patch<{ Params: { id: string }; Body: { lastName?: string; firstName?: string; middleName?: string; phone?: string; email?: string; position?: string; companyIds?: string[] } }>(
    '/:id', { preHandler: requireAuth }, async (req, reply) => {
      const { companyIds, ...data } = req.body
      const contact = await prisma.contact.findUnique({ where: { id: req.params.id } })
      if (!contact) return reply.status(404).send({ error: 'Не найден' })

      if (companyIds !== undefined) {
        await prisma.contactCompany.deleteMany({ where: { contactId: req.params.id } })
        if (companyIds.length) {
          await prisma.contactCompany.createMany({
            data: companyIds.map((companyId) => ({ contactId: req.params.id, companyId })),
          })
        }
      }

      return prisma.contact.update({
        where: { id: req.params.id },
        data,
        include: { companies: { include: { company: { select: { id: true, name: true } } } } },
      })
    }
  )

  app.delete<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const contact = await prisma.contact.findUnique({ where: { id: req.params.id } })
    if (!contact) return reply.status(404).send({ error: 'Не найден' })
    await prisma.contact.delete({ where: { id: req.params.id } })
    return { ok: true }
  })
}
