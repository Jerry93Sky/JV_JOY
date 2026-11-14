import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../lib/auth'
import { Role } from '@bms/shared'

export async function userRoutes(app: FastifyInstance) {
  // GET /users
  app.get('/', { preHandler: requireAuth }, async () => {
    return prisma.user.findMany({
      select: { id: true, login: true, firstName: true, lastName: true, middleName: true, role: true, isActive: true, createdAt: true },
      orderBy: { lastName: 'asc' },
    })
  })

  // POST /users — только admin/owner
  app.post<{ Body: { login: string; password: string; firstName: string; lastName: string; middleName?: string; role: Role } }>(
    '/',
    { preHandler: requireRole(Role.OWNER, Role.ADMIN) },
    async (req, reply) => {
      const { login, password, firstName, lastName, middleName, role } = req.body
      if (!login || !password || !firstName || !lastName) return reply.status(400).send({ error: 'Заполните обязательные поля' })

      const exists = await prisma.user.findUnique({ where: { login } })
      if (exists) return reply.status(409).send({ error: 'Логин уже занят' })

      const hash = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: { login, password: hash, firstName, lastName, middleName, role: role || Role.USER },
        select: { id: true, login: true, firstName: true, lastName: true, middleName: true, role: true, isActive: true },
      })
      return reply.status(201).send(user)
    }
  )

  // PATCH /users/:id
  app.patch<{ Params: { id: string }; Body: { firstName?: string; lastName?: string; middleName?: string; role?: Role; isActive?: boolean; password?: string } }>(
    '/:id',
    { preHandler: requireRole(Role.OWNER, Role.ADMIN) },
    async (req, reply) => {
      const { id } = req.params
      const { password, ...rest } = req.body
      const data: Record<string, unknown> = { ...rest }
      if (password) data.password = await bcrypt.hash(password, 10)

      // Нельзя менять роль OWNER другим пользователям
      const caller = req.user as { id: string; role: Role }
      const target = await prisma.user.findUnique({ where: { id } })
      if (!target) return reply.status(404).send({ error: 'Пользователь не найден' })
      if (target.role === Role.OWNER && caller.id !== id) return reply.status(403).send({ error: 'Нельзя изменить владельца системы' })

      const updated = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, login: true, firstName: true, lastName: true, middleName: true, role: true, isActive: true },
      })
      return updated
    }
  )

  // DELETE /users/:id — только owner
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireRole(Role.OWNER) },
    async (req, reply) => {
      const caller = req.user as { id: string }
      if (caller.id === req.params.id) return reply.status(400).send({ error: 'Нельзя удалить себя' })
      const target = await prisma.user.findUnique({ where: { id: req.params.id } })
      if (!target) return reply.status(404).send({ error: 'Не найден' })
      if (target.role === Role.OWNER) return reply.status(403).send({ error: 'Нельзя удалить владельца системы' })
      await prisma.user.delete({ where: { id: req.params.id } })
      return { ok: true }
    }
  )
}
