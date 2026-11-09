import { FastifyRequest, FastifyReply } from 'fastify'
import type { Role as PrismaRole } from '@prisma/client'
import type { Role as SharedRole } from '@bms/shared'

type AuthRole = PrismaRole | SharedRole

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Не авторизован' })
  }
}

export function requireRole(...roles: AuthRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify()
      const payload = req.user as { id: string; role: AuthRole }
      if (!roles.includes(payload.role)) {
        reply.status(403).send({ error: 'Недостаточно прав' })
      }
    } catch {
      reply.status(401).send({ error: 'Не авторизован' })
    }
  }
}
