import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export enum DealStage {
  // Лид
  APPLICATION = 'APPLICATION',      // новый необработанный
  IN_PROGRESS = 'IN_PROGRESS',      // обработанный лид
  // Сделка
  INVOICE_SENT = 'INVOICE_SENT',    // выставлен счёт
  PAID = 'PAID',                    // оплачен
  ASSEMBLY = 'ASSEMBLY',            // сборка
  PAINTING = 'PAINTING',            // покраска
  INSTALL_FIRST = 'INSTALL_FIRST',  // монтаж 1й этап
  INSTALL_SECOND = 'INSTALL_SECOND',// монтаж 2й этап
  SHIPMENT = 'SHIPMENT',            // отгрузка
  DOCS = 'DOCS',                    // подписание документов
  COMPLETED = 'COMPLETED',          // завершён
  FAILED = 'FAILED',                // отменён
}

export enum Direction { PRIVATE = 'PRIVATE', DEALER = 'DEALER' }
export enum GlassSupply { OURS = 'OURS', CLIENT = 'CLIENT' }
export enum PaymentType { CASH = 'CASH', BANK = 'BANK' }
export enum PaymentStatus { FULL = 'FULL', PARTIAL = 'PARTIAL' }
export enum FailReason { PRICE = 'PRICE', TECHNICAL = 'TECHNICAL', COMPETITOR = 'COMPETITOR', STOCK_SHORTAGE = 'STOCK_SHORTAGE' }
export enum InstallType { NONE = 'NONE', SINGLE = 'SINGLE', TWO_STAGE = 'TWO_STAGE' }

export interface DealListItem {
  id: string; number: string; stage: DealStage; direction: Direction
  assignee: { id: string; firstName: string; lastName: string }
  creator: { id: string; firstName: string; lastName: string }
  contact?: { id: string; firstName: string; lastName: string; phone: string } | null
  company?: { id: string; name: string }
  needPainting: boolean; paintingOverdue: boolean
  paymentStatus?: PaymentStatus; paidAmount?: number
  createdAt: string; updatedAt: string
  _count: { items: number }
}

export interface DealItem {
  id: string; productId: string; quantity: number; unitPrice: number
  calcPrice?: number; calcQty?: number
  priceOverridden: boolean; qtyOverridden: boolean
  shippedQty: number                               // отгружено на монтаж
  paintColor?: string; paintFinish?: string; systemId?: string
  product: { id: string; name: string; sku: string; unit: string; isPaintable?: boolean }
}

export interface DealService {
  id: string; serviceId: string; quantity: number; unitPrice: number
  service: { id: string; name: string }
}

export interface DealSystemEntry {
  id: string; dealId: string; systemId: string; systemName: string
  inputParams: Record<string, unknown>; calcParams?: Record<string, unknown>
}

export interface Deal extends DealListItem {
  comment?: string; isAgentOrder: boolean; agentPercent?: number
  glassSupply: GlassSupply; paintAllOneColor: boolean
  paymentType?: PaymentType; isOfficialPayment: boolean
  failReason?: FailReason; paintingCompany?: string; paintingSentAt?: string
  glassOrderStatus: string; glassDrawingUrl?: string; glassCostPrice?: number
  invoiceUrl?: string; manualDiscountPct?: number | null
  contactId: string
  // Новые поля
  invoiceSentAt?: string; paidAt?: string
  installType?: InstallType
  assemblySheetUrl?: string; paintingNoteUrl?: string
  items: DealItem[]
  systems: DealSystemEntry[]
  services: DealService[]
  files: { id: string; url: string; name: string; type: string }[]
  proposals: { id: string; version: number; url: string; createdAt: string }[]
}

const QK = 'deals'

export const useDeals = (params?: { assigneeId?: string; showCompleted?: boolean; stage?: string }) =>
  useQuery({
    queryKey: [QK, params],
    queryFn: () => api.get<DealListItem[]>('/deals', { params: { ...params, showCompleted: params?.showCompleted ? 'true' : undefined } }).then(r => r.data),
  })

export const useDeal = (id: string) =>
  useQuery({ queryKey: [QK, id], queryFn: () => api.get<Deal>(`/deals/${id}`).then(r => r.data), enabled: !!id })

export const useCreateDeal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { contactId: string; companyId?: string; direction: Direction; assigneeId: string; comment?: string; isAgentOrder?: boolean; agentPercent?: number; glassSupply?: GlassSupply; needPainting?: boolean }) =>
      api.post<Deal>('/deals', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export const useUpdateDeal = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Deal>) => api.patch<Deal>(`/deals/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export const useAddDealItem = (dealId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { productId: string; quantity: number; unitPrice: number; paintColor?: string; systemId?: string }) =>
      api.post(`/deals/${dealId}/items`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, dealId] }),
  })
}

export const useRemoveDealItem = (dealId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => api.delete(`/deals/${dealId}/items/${itemId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, dealId] }),
  })
}

export const useUpdateDealItem = (dealId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...d }: { id: string; quantity?: number; unitPrice?: number }) =>
      api.patch(`/deals/${dealId}/items/${id}`, d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, dealId] }),
  })
}

export const useAddDealService = (dealId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { serviceId: string; quantity?: number; unitPrice: number }) =>
      api.post(`/deals/${dealId}/services`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, dealId] }),
  })
}

export const useRemoveDealService = (dealId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (svcId: string) => api.delete(`/deals/${dealId}/services/${svcId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, dealId] }),
  })
}

// Переходы по этапам
const stageAction = (dealId: string, action: string, body?: object) =>
  api.post(`/deals/${dealId}/${action}`, body || {}).then(r => r.data)

export const useDealAction = (dealId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ action, body }: { action: string; body?: object }) => stageAction(dealId, action, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export const useAddDealSystem = (dealId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { systemId: string; systemName: string; inputParams: Record<string, unknown>; calcParams?: Record<string, unknown>; items?: { productId: string; quantity: number; unitPrice: number }[] }) =>
      api.post(`/deals/${dealId}/systems`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, dealId] }),
  })
}

export const useUpdateDealSystem = (dealId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dsId, ...data }: { dsId: string; inputParams: Record<string, unknown>; calcParams?: Record<string, unknown>; items?: { productId: string; quantity: number; unitPrice: number }[] }) =>
      api.patch(`/deals/${dealId}/systems/${dsId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, dealId] }),
  })
}

export const useDeleteDealSystem = (dealId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dsId: string) => api.delete(`/deals/${dealId}/systems/${dsId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, dealId] }),
  })
}

export const useUpdateItemPaint = (dealId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, paintColor, paintFinish, applyToAll }: { itemId: string; paintColor?: string; paintFinish?: string; applyToAll?: boolean }) =>
      api.patch(`/deals/${dealId}/items/${itemId}/paint`, { paintColor, paintFinish, applyToAll }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, dealId] }),
  })
}
