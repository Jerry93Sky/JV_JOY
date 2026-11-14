import type { DealStage } from '@prisma/client'

export type ProposalWorkflowDecision =
  | { allowed: true; nextVersion: number }
  | { allowed: false; reason: 'PROPOSAL_REQUIRES_IN_PROGRESS' }

export function decideProposalWorkflow(stage: DealStage, existingProposalCount: number): ProposalWorkflowDecision {
  if (stage !== 'IN_PROGRESS') return { allowed: false, reason: 'PROPOSAL_REQUIRES_IN_PROGRESS' }
  return { allowed: true, nextVersion: existingProposalCount + 1 }
}

export type InvoiceWorkflowDecision =
  | { allowed: true; reserveInventory: boolean; invoiceSentAt: Date }
  | { allowed: false; reason: 'INVOICE_REQUIRES_PROPOSAL' | 'INVOICE_STAGE_INVALID' }

export function decideInvoiceWorkflow(input: {
  stage: DealStage
  proposalCount: number
  invoiceSentAt: Date | null
  now: Date
}): InvoiceWorkflowDecision {
  if (input.stage === 'IN_PROGRESS') {
    if (input.proposalCount === 0) return { allowed: false, reason: 'INVOICE_REQUIRES_PROPOSAL' }
    return { allowed: true, reserveInventory: input.invoiceSentAt === null, invoiceSentAt: input.invoiceSentAt ?? input.now }
  }

  // Reissuing/updating an already issued invoice must not reserve inventory again.
  if (input.stage === 'INVOICE_SENT') {
    return { allowed: true, reserveInventory: false, invoiceSentAt: input.invoiceSentAt ?? input.now }
  }

  return { allowed: false, reason: 'INVOICE_STAGE_INVALID' }
}

export type ProposalLifecycleResult =
  | { ok: true; version: number; url: string }
  | { ok: false; reason: 'PROPOSAL_REQUIRES_IN_PROGRESS' }

export async function createProposalVersion(input: {
  stage: DealStage
  proposalCount: number
  dealId: string
  dealNumber: string
  create: (data: { dealId: string; version: number; url: string }) => Promise<unknown>
}): Promise<ProposalLifecycleResult> {
  const decision = decideProposalWorkflow(input.stage, input.proposalCount)
  if (!decision.allowed) return { ok: false, reason: decision.reason }
  const url = `/proposals/${input.dealNumber}_v${decision.nextVersion}.pdf`
  await input.create({ dealId: input.dealId, version: decision.nextVersion, url })
  return { ok: true, version: decision.nextVersion, url }
}

export async function issueDealInvoice(input: {
  stage: DealStage
  proposalCount: number
  invoiceSentAt: Date | null
  now: Date
  reserveInventory: () => Promise<void>
  updateInvoice: (data: { stage: 'INVOICE_SENT'; invoiceSentAt: Date }) => Promise<void>
  logTransition: () => Promise<void>
}): Promise<InvoiceWorkflowDecision> {
  const decision = decideInvoiceWorkflow(input)
  if (!decision.allowed) return decision
  if (decision.reserveInventory) await input.reserveInventory()
  await input.updateInvoice({ stage: 'INVOICE_SENT', invoiceSentAt: decision.invoiceSentAt })
  await input.logTransition()
  return decision
}

export type PaymentWorkflowDecision =
  | { allowed: true; nextStage: DealStage }
  | { allowed: false; reason: 'PAYMENT_REQUIRES_INVOICE' }

export function decidePaymentWorkflow(stage: DealStage, currentStatus: 'FULL' | 'PARTIAL' | null, requestedStatus: 'FULL' | 'PARTIAL'): PaymentWorkflowDecision {
  if (stage !== 'INVOICE_SENT' && currentStatus !== 'PARTIAL') return { allowed: false, reason: 'PAYMENT_REQUIRES_INVOICE' }
  return { allowed: true, nextStage: requestedStatus === 'FULL' ? 'PAID' : stage }
}

export function buildPaymentUpdate(input: {
  decision: Extract<PaymentWorkflowDecision, { allowed: true }>
  paymentStatus: 'FULL' | 'PARTIAL'
  paidAmount?: number
  isOfficialPayment?: boolean
  now: Date
}) {
  return {
    stage: input.decision.nextStage,
    paymentStatus: input.paymentStatus,
    paidAmount: input.paidAmount ?? null,
    isOfficialPayment: input.isOfficialPayment ?? false,
    paidAt: input.paymentStatus === 'FULL' ? input.now : undefined,
  }
}
