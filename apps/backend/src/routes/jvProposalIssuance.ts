import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { Prisma, Role, type JvProposalIssue } from '@prisma/client'
import { contentDigest, parseProposalTerms, stableJson } from '../domain/jv/jvProposalPayload'
import { createResultDto } from '../domain/jv/jvResultDto'
import { requireRole } from '../lib/auth'
import { prisma } from '../lib/prisma'

const formatVersion = 'JV-PROPOSAL-ISSUE-1'
const issueReceipt = { number: true, issuedAt: true } as const
const sourceRelations = { issue: true, snapshot: true, reviewEvents: { orderBy: { sequence: 'asc' } } } satisfies Prisma.JvProposalDraftInclude
type Source = Prisma.JvProposalDraftGetPayload<{ include: typeof sourceRelations }>
type Actor = { id: string; role: Role }

function jsonObject(value: Prisma.JsonValue | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function issueDocument({ number, issuedAt, proposalId, formatVersion, proposalSha256, payload, contentSha256 }: JvProposalIssue) {
  const digest = contentDigest({ proposalId, formatVersion, proposalSha256, payload })
  return formatVersion === 'JV-PROPOSAL-ISSUE-1' && digest === contentSha256 ? { number, issuedAt, payload } : null
}

function prepareIssue(source: Source) {
  const { id: proposalId, formatVersion: sourceVersion, orderId, snapshotId, payload, contentSha256, reviewEvents, snapshot } = source
  if (reviewEvents.at(-1)?.status !== 'APPROVED') return { status: 409, error: 'PROPOSAL_NOT_APPROVED' } as const

  if (sourceVersion !== 'JV-PROPOSAL-DRAFT-1' ||
      contentDigest({ formatVersion: sourceVersion, orderId, snapshotId, payload }) !== contentSha256 ||
      reviewEvents.some(event => event.contentSha256 !== contentSha256)) {
    return { status: 409, error: 'PROPOSAL_INTEGRITY_FAILED' } as const
  }
  const draft = jsonObject(payload)
  const terms = parseProposalTerms(draft?.terms)
  if (!draft || !terms || typeof draft.orderNumber !== 'number' || typeof draft.orderVersion !== 'number' || !Array.isArray(draft.positions) ||
      (draft.profile !== 'COMPLETATION' && draft.profile !== 'RETAIL')) {
    return { status: 422, error: 'INVALID_PROPOSAL' } as const
  }
  const { formatVersion: snapshotVersion, orderVersion, input, result } = snapshot
  if (snapshot.orderId !== orderId || draft.orderVersion !== orderVersion || draft.snapshotSha256 !== snapshot.contentSha256 ||
      contentDigest({ formatVersion: snapshotVersion, orderId, orderVersion, input, result }) !== snapshot.contentSha256) {
    return { status: 409, error: 'SNAPSHOT_INTEGRITY_FAILED' } as const
  }
  const inputs = jsonObject(input)
  if (draft.profile !== inputs?.profile || (draft.profile === 'COMPLETATION' && inputs.uiSchemaVersion !== 'JV-UI-INPUTS-3')) {
    return { status: 409, error: 'HISTORICAL_GLASS_POLICY' } as const
  }
  const snapshotTotal = createResultDto(result).calculation.totalSalePrice
  if (!snapshotTotal || stableJson(draft.totalSalePrice) !== stableJson(snapshotTotal)) {
    return { status: 422, error: 'UNCONFIRMED_PRICE' } as const
  }

  const document = {
    proposalId,
    proposalSha256: contentSha256,
    formatVersion,
    payload: { orderNumber: draft.orderNumber, orderVersion, profile: draft.profile,
      terms, positions: draft.positions, totalSalePrice: draft.totalSalePrice as Prisma.JsonObject },
  }
  return { document, contentSha256: contentDigest(document) } as const
}

export async function jvProposalIssuanceRoutes(app: FastifyInstance) {
  const eligibleRole = requireRole(Role.OWNER, Role.ENGINEER)
  async function requireActiveIssuer(req: FastifyRequest, reply: FastifyReply) {
    const actor = req.user as Actor
    if (typeof actor.id !== 'string' || !actor.id || !await prisma.user.findFirst({
      where: { id: actor.id, role: actor.role, isActive: true }, select: { id: true },
    })) {
      return reply.status(403).send({ error: { code: 'ISSUER_ROLE_REQUIRED' } })
    }
  }
  const readGuard = [eligibleRole, requireActiveIssuer]

  app.get<{ Querystring: { before?: string } }>('/proposal-issuance', { preHandler: readGuard }, async (req, reply) => {
    const before = req.query.before
    if (before !== undefined && (!/^[1-9]\d{0,9}$/.test(before) || Number(before) > 2147483647)) {
      return reply.status(400).send({ error: { code: 'INVALID_CURSOR' } })
    }
    const rows = await prisma.jvProposalDraft.findMany({
      where: { reviewEvents: { some: { status: 'APPROVED' } }, ...(before ? { number: { lt: Number(before) } } : {}) },
      select: { id: true, number: true, order: { select: { number: true } }, issue: { select: issueReceipt } },
      orderBy: { number: 'desc' }, take: 26,
    })
    reply.header('Cache-Control', 'no-store')
    return { items: rows.slice(0, 25), next: rows.length > 25 ? rows[24].number : null }
  })

  app.get<{ Params: { proposalId: string } }>('/proposal-issuance/:proposalId', { preHandler: readGuard }, async (req, reply) => {
    const source = await prisma.jvProposalDraft.findUnique({ where: { id: req.params.proposalId }, include: sourceRelations })
    reply.header('Cache-Control', 'no-store')
    if (!source || source.reviewEvents.at(-1)?.status !== 'APPROVED') return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (source.issue) {
      const issued = issueDocument(source.issue)
      return issued ? { number: source.number, issue: { number: issued.number, issuedAt: issued.issuedAt }, payload: issued.payload }
        : reply.status(409).send({ error: { code: 'ISSUE_INTEGRITY_FAILED' } })
    }
    const prepared = prepareIssue(source)
    if (prepared.error !== undefined) return reply.status(prepared.status).send({ error: { code: prepared.error } })
    return { number: source.number, issue: null, payload: prepared.document.payload }
  })

  app.post<{ Params: { proposalId: string }; Body: unknown }>('/proposal-issuance/:proposalId/issue', { preHandler: eligibleRole, bodyLimit: 1024 }, async (req, reply) => {
    if (req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) {
      return reply.status(400).send({ error: { code: 'INVALID_REQUEST' } })
    }
    const actor = req.user as Actor
    if (typeof actor.id !== 'string' || !actor.id) return reply.status(403).send({ error: { code: 'ISSUER_ROLE_REQUIRED' } })
    const { proposalId } = req.params
    const outcome = await prisma.$transaction(async tx => {
      // Hold the account's current role through the issuance transaction.
      const account = await tx.$queryRaw<{ role: Role }[]>`SELECT role FROM "User" WHERE id = ${actor.id} AND "isActive" FOR SHARE`
      if (account[0]?.role !== actor.role) return { status: 403, error: 'ISSUER_ROLE_REQUIRED' }
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "JvProposalDraft" WHERE id = ${proposalId} FOR UPDATE`
      if (!locked.length) return { status: 404, error: 'NOT_FOUND' }
      const source = await tx.jvProposalDraft.findUniqueOrThrow({ where: { id: proposalId }, include: sourceRelations })
      if (source.issue) {
        const issued = issueDocument(source.issue)
        return issued ? { status: 200, issue: { number: issued.number, issuedAt: issued.issuedAt } }
          : { status: 409, error: 'ISSUE_INTEGRITY_FAILED' }
      }
      const prepared = prepareIssue(source)
      if (prepared.error !== undefined) return prepared
      const issue = await tx.jvProposalIssue.create({
        data: { ...prepared.document, contentSha256: prepared.contentSha256, issuerId: actor.id, issuerRole: actor.role },
        select: issueReceipt,
      })
      return { status: 201, issue }
    })
    reply.header('Cache-Control', 'no-store')
    return reply.status(outcome.status).send(outcome.error !== undefined ? { error: { code: outcome.error } } : outcome.issue)
  })
}
