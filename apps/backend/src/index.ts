import Fastify from 'fastify'
import { registerPlugins } from './plugins'
import { registerRoutes } from './routes'
import fastifyStatic from '@fastify/static'
import * as path from 'path'
import * as fs from 'fs'

const app = Fastify({ logger: true })

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

async function start() {
  await registerPlugins(app)

  // Раздаём собранный фронтенд
  app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), '../frontend/dist'),
    prefix: '/',
  })

  // Раздаём загруженные файлы
  app.register(fastifyStatic, {
    root: UPLOAD_DIR,
    prefix: '/uploads/',
    decorateReply: false,
  })

  await registerRoutes(app)

  // SPA fallback — все не-API запросы отдают index.html
  app.setNotFoundHandler((req, reply) => {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
      reply.sendFile('index.html', path.resolve(process.cwd(), '../frontend/dist'))
    } else {
      reply.status(404).send({ error: 'Not found' })
    }
  })

  const port = Number(process.env.PORT) || 3001
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`Backend running on http://localhost:${port}`)
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
