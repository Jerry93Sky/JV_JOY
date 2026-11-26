import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
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
      if (role !== undefined && !Object.values(Role).includes(role)) return reply.status(400).send({ error: 'Неизвестная роль' })
      if (role === Role.OWNER) return reply.status(403).send({ error: 'Создание владельца через этот интерфейс недоступно' })
      const caller = req.user as { id: string; role: Role }
      if (role === Role.ENGINEER && !await activeOwner(caller)) return reply.status(403).send({ error: 'Назначить роль инженера может только владелец' })

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
      const { firstName, lastName, middleName, role, isActive, password } = req.body
      if (role !== undefined && !Object.values(Role).includes(role)) return reply.status(400).send({ error: 'Неизвестная роль' })
      const data: Prisma.UserUpdateInput = { firstName, lastName, middleName, role, isActive }
      if (password) data.password = await bcrypt.hash(password, 10)

      // Нельзя менять роль OWNER другим пользователям
      const caller = req.user as { id: string; role: Role }
      const target = await prisma.user.findUnique({ where: { id } })
      if (!target) return reply.status(404).send({ error: 'Пользователь не найден' })
      if (role === Role.OWNER && target.role !== Role.OWNER) return reply.status(403).send({ error: 'Назначение роли владельца через этот интерфейс недоступно' })
      if (target.role === Role.OWNER && caller.id !== id) return reply.status(403).send({ error: 'Нельзя изменить владельца системы' })
      if (target.role === Role.OWNER && role !== undefined && role !== Role.OWNER) return reply.status(403).send({ error: 'Нельзя изменить роль владельца системы' })
      if ((role === Role.ENGINEER || target.role === Role.ENGINEER) && !await activeOwner(caller)) {
        return reply.status(403).send({ error: 'Управлять учётными записями инженеров может только владелец' })
      }

      try {
        return await prisma.user.update({
          where: { id, role: target.role },
          data,
          select: { id: true, login: true, firstName: true, lastName: true, middleName: true, role: true, isActive: true },
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return reply.status(409).send({ error: 'Пользователь изменён в другой сессии' })
        }
        throw error
      }
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

async function activeOwner(caller: { id: string; role: Role }) {
  return caller.role === Role.OWNER && !!await prisma.user.findFirst({
    where: { id: caller.id, role: Role.OWNER, isActive: true }, select: { id: true },
  })
}
