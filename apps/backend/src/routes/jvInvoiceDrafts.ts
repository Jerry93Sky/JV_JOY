import type { FastifyInstance } from 'fastify'
import type { JvInvoiceDraft } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { contentDigest } from '../domain/jv/jvProposalPayload'
import { issueDocument, issuedSnapshotDealId, jvCommercialDocumentGuard } from './jvProposalIssuance'

const formatVersion = 'JV-INVOICE-DRAFT-1'
const line = z.string().max(300).trim()
const party = z.object({ name: line, inn: line, kpp: line, address: line }).strict()
const detailsSchema = z.object({
  seller: party.extend({ bank: line, bik: line, account: line }).strict(),
  buyer: party,
  notes: z.string().max(2000).trim(),
}).strict()
const editSchema = z.object({ version: z.number().int().min(1).max(2147483646), details: detailsSchema }).strict()
type Details = z.infer<typeof detailsSchema>

function missingRequisites({ seller, buyer }: Details) {
  return [
    ['seller.name', seller.name], ['seller.inn', seller.inn], ['seller.address', seller.address],
    ['seller.bank', seller.bank], ['seller.bik', seller.bik], ['seller.account', seller.account],
    ['buyer.name', buyer.name], ['buyer.address', buyer.address],
  ].filter(([, value]) => !value).map(([field]) => field)
}

function document(draft: JvInvoiceDraft) {
  const { formatVersion: version, dealId, proposalId, source, contentSha256, status } = draft
  const details = detailsSchema.safeParse(draft.details)
  if (version !== formatVersion || status !== 'DRAFT' || !details.success ||
      contentDigest({ formatVersion: version, dealId, proposalId, source }) !== contentSha256) return null
  return { ...draft, details: details.data, missingRequisites: missingRequisites(details.data) }
}

const notFound = { error: { code: 'NOT_FOUND' } }
const integrityError = { error: { code: 'INVOICE_DRAFT_INTEGRITY_FAILED' } }
const guard = { preHandler: jvCommercialDocumentGuard }
type DealParams = { dealId: string }
type DraftParams = DealParams & { draftId: string }

export async function jvInvoiceDraftRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (_req, reply) => { reply.header('Cache-Control', 'no-store') })

  app.get<{ Params: DealParams; Querystring: { before?: string } }>('/deals/:dealId/invoice-drafts', guard, async (req, reply) => {
    const { dealId } = req.params
    const { before } = req.query
    if (before !== undefined && !/^[a-zA-Z0-9_-]{1,100}$/.test(before)) {
      return reply.status(400).send({ error: { code: 'INVALID_CURSOR' } })
    }
    if (!await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } })) return reply.status(404).send(notFound)
    if (before && !await prisma.jvInvoiceDraft.findFirst({ where: { id: before, dealId }, select: { id: true } })) {
      return reply.status(404).send(notFound)
    }
    const rows = await prisma.jvInvoiceDraft.findMany({
      where: { dealId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 26,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      select: { id: true, proposalId: true, version: true, status: true, createdAt: true, updatedAt: true },
    })
    return { items: rows.slice(0, 25), next: rows.length > 25 ? rows[24].id : null }
  })

  app.get<{ Params: DraftParams }>('/deals/:dealId/invoice-drafts/:draftId', guard, async (req, reply) => {
    const draft = await prisma.jvInvoiceDraft.findFirst({ where: { id: req.params.draftId, dealId: req.params.dealId } })
    if (!draft) return reply.status(404).send(notFound)
    return document(draft) ?? reply.status(409).send(integrityError)
  })

  app.post<{ Params: DealParams & { proposalId: string }; Body: unknown }>(
    '/deals/:dealId/issued-proposals/:proposalId/invoice-draft', { ...guard, bodyLimit: 1024 }, async (req, reply) => {
      if (req.body !== undefined && !z.object({}).strict().safeParse(req.body).success) {
        return reply.status(400).send({ error: { code: 'INVALID_REQUEST' } })
      }
      const { dealId, proposalId } = req.params
      const { id: authorId } = req.user as { id: string }
      const outcome = await prisma.$transaction(async tx => {
        const rows = await tx.$queryRaw<{ proposalId: string }[]>`SELECT "proposalId" FROM "JvProposalIssue" WHERE "proposalId" = ${proposalId} FOR UPDATE`
        if (!rows.length) return { status: 404, payload: notFound }
        const existing = await tx.jvInvoiceDraft.findUnique({ where: { proposalId } })
        if (existing) {
          if (existing.dealId !== dealId) return { status: 404, payload: notFound }
          const payload = document(existing)
          return payload ? { status: 200, payload } : { status: 409, payload: integrityError }
        }
        const issue = await tx.jvProposalIssue.findUniqueOrThrow({
          where: { proposalId }, include: { proposal: { include: { snapshot: true } } },
        })
        const issued = issueDocument(issue)
        if (!issued || issuedSnapshotDealId(issue, issue.proposal) !== dealId) return { status: 404, payload: notFound }
        const deal = await tx.deal.findUnique({
          where: { id: dealId }, select: { number: true, company: { select: { name: true, inn: true } } },
        })
        if (!deal) return { status: 404, payload: notFound }
        const snapshot = issue.proposal.snapshot
        const source = {
          issuedProposalNumber: issued.number, issuedAt: issued.issuedAt.toISOString(), issueSha256: issue.contentSha256,
          snapshotId: snapshot.id, snapshotSha256: snapshot.contentSha256, dealNumber: deal.number,
          commercial: issued.payload,
        }
        const blank = { name: '', inn: '', kpp: '', address: '' }
        const details = {
          seller: { ...blank, bank: '', bik: '', account: '' },
          buyer: { ...blank, name: deal.company?.name.trim().slice(0, 300) ?? '', inn: deal.company?.inn?.trim().slice(0, 300) ?? '' },
          notes: '',
        }
        const draft = await tx.jvInvoiceDraft.create({
          data: { proposalId, dealId, authorId, formatVersion, source, details,
            contentSha256: contentDigest({ formatVersion, proposalId, dealId, source }) },
        })
        return { status: 201, payload: document(draft) }
      })
      return reply.status(outcome.status).send(outcome.payload)
    },
  )

  app.put<{ Params: DraftParams; Body: unknown }>('/deals/:dealId/invoice-drafts/:draftId', { ...guard, bodyLimit: 32768 }, async (req, reply) => {
    const input = editSchema.safeParse(req.body)
    if (!input.success) return reply.status(400).send({ error: { code: 'INVALID_INVOICE_DETAILS' } })
    const { dealId, draftId: id } = req.params
    const { version, details } = input.data
    const outcome = await prisma.$transaction(async tx => {
      const draft = await tx.jvInvoiceDraft.findFirst({ where: { id, dealId } })
      if (!draft) return { status: 404, payload: notFound }
      if (!document(draft)) return { status: 409, payload: integrityError }
      const updated = await tx.jvInvoiceDraft.updateMany({
        where: { id, dealId, version, status: 'DRAFT' }, data: { details, version: { increment: 1 } },
      })
      if (!updated.count) return { status: 409, payload: { error: { code: 'VERSION_CONFLICT' } } }
      return { status: 200, payload: document(await tx.jvInvoiceDraft.findUniqueOrThrow({ where: { id } })) }
    })
    return reply.status(outcome.status).send(outcome.payload)
  })
}
