import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { login: string; password: string } }>('/login', async (req, reply) => {
    const { login, password } = req.body
    if (!login || !password) return reply.status(400).send({ error: 'Заполните все поля' })

    const user = await prisma.user.findUnique({ where: { login } })
    if (!user || !user.isActive) return reply.status(401).send({ error: 'Неверный логин или пароль' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return reply.status(401).send({ error: 'Неверный логин или пароль' })

    const token = app.jwt.sign(
      { id: user.id, role: user.role },
      { expiresIn: '8h' }
    )

    return {
      token,
      user: {
        id: user.id,
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        role: user.role,
      },
    }
  })

  app.post('/logout', async () => ({ ok: true }))
}
