import { FastifyRequest, FastifyReply } from 'fastify'
import { Role } from '@bms/shared'

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Не авторизован' })
  }
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify()
      const payload = req.user as { id: string; role: Role }
      if (!roles.includes(payload.role)) {
        reply.status(403).send({ error: 'Недостаточно прав' })
      }
    } catch {
      reply.status(401).send({ error: 'Не авторизован' })
    }
  }
}
