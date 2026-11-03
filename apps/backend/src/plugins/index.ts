import { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'

export async function registerPlugins(app: FastifyInstance) {
  await app.register(fastifyCors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })

  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    cookie: { cookieName: 'refreshToken', signed: false },
  })

  await app.register(fastifyCookie)

  await app.register(fastifyMultipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  })
}
