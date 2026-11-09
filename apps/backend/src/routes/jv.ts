import { FastifyInstance } from 'fastify'
import { Role } from '@bms/shared'
import { requireRole } from '../lib/auth'
import { calculateJvPreview, JvRequestError, serializeJvResult } from '../domain/jv/jvCalculationService'

const MAX_PREVIEW_BODY_BYTES = 256 * 1024

export async function jvRoutes(app: FastifyInstance) {
  app.post<{ Body: unknown }>(
    '/orders/calculate-preview',
    { preHandler: requireRole(Role.OWNER, Role.ADMIN), bodyLimit: MAX_PREVIEW_BODY_BYTES },
    async (request, reply) => {
      try {
        const result = calculateJvPreview(request.body)
        return reply.status(200).send(serializeJvResult(result))
      } catch (error) {
        if (error instanceof JvRequestError) {
          return reply.status(error.statusCode).send({
            error: { code: error.code, message: error.message, issues: error.issues, correlationId: request.id },
          })
        }
        request.log.error({ correlationId: request.id, errorType: error instanceof Error ? error.name : 'unknown' }, 'JV preview calculation failed')
        return reply.status(500).send({ error: { code: 'JV_CALCULATION_FAILED', message: 'Calculation could not be completed', correlationId: request.id } })
      }
    },
  )
}
