export const proposalTermLabels = [
  ['recipient', 'Получатель'],
  ['requisites', 'Реквизиты'],
  ['payment', 'Условия оплаты'],
  ['timeframe', 'Сроки'],
  ['delivery', 'Условия доставки'],
] as const

export type ProposalTerms = Record<(typeof proposalTermLabels)[number][0], string>

export type ProposalReviewStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED'
export type ProposalReviewAction = 'SUBMIT' | 'APPROVE' | 'RETURN'

export const proposalReviewLabels: Record<ProposalReviewStatus, string> = {
  DRAFT: 'Черновик',
  IN_REVIEW: 'На согласовании',
  APPROVED: 'Согласовано',
  CHANGES_REQUESTED: 'Возвращено на доработку',
}

export interface ProposalReview {
  status: ProposalReviewStatus
  events: {
    sequence: number
    status: Exclude<ProposalReviewStatus, 'DRAFT'>
    actorId: string
    actorRole: 'OWNER' | 'ADMIN'
    createdAt: string
    comment: string | null
  }[]
}

export interface ProposalDraft {
  id: string
  number: number
  createdAt: string
  formatVersion: string
  review?: ProposalReview
  payload: ProposalPayload
}

export interface ProposalPayload {
  orderNumber: number
  orderVersion: number
  profile: 'COMPLETATION' | 'RETAIL'
  totalSalePrice: unknown
  terms?: ProposalTerms
  positions: {
    id: string
    family: string
    slot: number
    quantity: unknown
    confirmedUnitAmount?: unknown
  }[]
}

export interface ProposalIssue {
  number: number
  issuedAt: string
}

export interface ProposalForIssue {
  number: number
  issue: ProposalIssue | null
  payload: ProposalPayload
  deal: { id: string; number: string } | null
}

export const proposalDraftPath = (orderId: string, proposalId: string) =>
  `/jv/orders/${encodeURIComponent(orderId)}/proposal-drafts/${encodeURIComponent(proposalId)}`

export const proposalIssuancePath = '/jv/proposal-issuance'
export const proposalIssuanceDetailPath = (proposalId: string) =>
  `${proposalIssuancePath}/${encodeURIComponent(proposalId)}`
export const dealDetailPath = (dealId: string) => `/deals?open=deal:${encodeURIComponent(dealId)}`

export const canIssueJvProposal = (role: string | undefined) => role === 'OWNER' || role === 'ENGINEER'
export const issuedDate = (value: string) => new Date(value).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })
