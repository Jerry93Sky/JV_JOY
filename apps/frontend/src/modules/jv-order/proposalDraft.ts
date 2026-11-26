export const proposalTermLabels = [
  ['recipient', 'Получатель'],
  ['requisites', 'Реквизиты'],
  ['payment', 'Условия оплаты'],
  ['timeframe', 'Сроки'],
  ['delivery', 'Условия доставки'],
] as const

export type ProposalTerms = Record<(typeof proposalTermLabels)[number][0], string>

export interface ProposalDraft {
  id: string
  number: number
  createdAt: string
  formatVersion: string
  payload: {
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
}

export const proposalDraftPath = (orderId: string, proposalId: string) =>
  `/jv/orders/${encodeURIComponent(orderId)}/proposal-drafts/${encodeURIComponent(proposalId)}`
