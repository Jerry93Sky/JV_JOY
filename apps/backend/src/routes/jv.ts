import { FastifyInstance } from 'fastify'
import { Role } from '@bms/shared'
import { requireRole } from '../lib/auth'
import { createResultDto, JvTraceStore } from '../domain/jv/jvResultDto'
import { calculateJvPreview, getJvUiFormConfig, JvRequestError, serializeJvResult } from '../domain/jv/jvCalculationService'

const MAX_PREVIEW_BODY_BYTES = 256 * 1024

export async function jvRoutes(app: FastifyInstance) {
  const traces = new JvTraceStore()
  app.get<{ Params: { handle: string }; Querystring: { position?: string; query?: string; offset?: string; limit?: string } }>(
    '/orders/results/:handle/trace', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (request, reply) => {
      const { position = '', query = '', offset = '0', limit = '100' } = request.query
      if (typeof position !== 'string' || typeof query !== 'string' || typeof offset !== 'string' || typeof limit !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(request.params.handle) || position.length > 100 || query.length > 100 || !/^\d{1,7}$/.test(offset) || !/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 100) return reply.status(400).send({error:{code:'INVALID_TRACE_QUERY',message:'Invalid trace page'}})
      const owner = (request.user as {id?: unknown}).id
      if (typeof owner !== 'string' || !owner) return reply.status(401).send({error:{code:'INVALID_IDENTITY',message:'Identity required'}})
      const page = traces.get(owner,request.params.handle,position,query,Number(offset),Number(limit))
      if (!page) return reply.status(404).send({error:{code:'TRACE_UNAVAILABLE',message:'Trace is unavailable or expired'}})
      reply.header('Cache-Control','no-store')
      return page
    },
  )
  app.get<{ Querystring: { profile?: string } }>(
    '/orders/form-config', { preHandler: requireRole(Role.OWNER, Role.ADMIN) }, async (request, reply) => {
      try { return getJvUiFormConfig(request.query.profile) }
      catch (error) {
        if (error instanceof JvRequestError) return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message, issues: error.issues, correlationId: request.id } })
        request.log.error({ correlationId: request.id }, 'JV form configuration failed')
        return reply.status(500).send({ error: { code: 'JV_CONFIG_FAILED', message: 'Form configuration could not be loaded', correlationId: request.id } })
      }
    },
  )
  app.post<{ Body: unknown }>(
    '/orders/calculate-preview-v1',
    { preHandler: requireRole(Role.OWNER, Role.ADMIN), bodyLimit: MAX_PREVIEW_BODY_BYTES },
    async (request, reply) => {
      try {
        const owner = (request.user as {id?: unknown}).id
        if (typeof owner !== 'string' || !owner) return reply.status(401).send({error:{code:'INVALID_IDENTITY',message:'Identity required'}})
        const result = calculateJvPreview(request.body)
        const dto = createResultDto(result)
        const traceHandle = traces.put(owner,result)
        reply.header('Cache-Control','no-store')
        return reply.status(200).send({...dto,traceHandle})
      } catch (error) {
        if (error instanceof JvRequestError) return reply.status(error.statusCode).send({error:{code:error.code,message:error.message,issues:error.issues,correlationId:request.id}})
        request.log.error({correlationId:request.id,errorType:error instanceof Error ? error.name : 'unknown'},'JV preview calculation failed')
        return reply.status(500).send({error:{code:'JV_CALCULATION_FAILED',message:'Calculation could not be completed',correlationId:request.id}})
      }
    },
  )
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
