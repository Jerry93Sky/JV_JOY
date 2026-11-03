import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export type LeadStatus = 'NEW' | 'IN_PROGRESS' | 'CONVERTED' | 'REJECTED'
export type LeadSource = 'CALL' | 'WEBSITE' | 'MANUAL' | 'OTHER'
export type LeadEventType = 'CREATED' | 'STATUS_CHANGED' | 'COMMENT_ADDED' | 'CALL_INBOUND' | 'CALL_OUTBOUND' | 'CONVERTED' | 'REJECTED'

export interface LeadEvent {
  id: string; dealId: string; type: LeadEventType
  content?: string; userId?: string; createdAt: string
}

export interface LeadListItem {
  id: string; number: string; leadStatus: LeadStatus; leadSource: LeadSource
  assignee: { id: string; firstName: string; lastName: string }
  contact?: { id: string; firstName: string; lastName: string; phone: string } | null
  company?: { id: string; name: string }
  comment?: string; createdAt: string
  _count: { events: number }
}

export interface Lead extends LeadListItem {
  events: LeadEvent[]
  tasks: { id: string; description: string; scheduledAt: string; doneAt: string | null }[]
  leadRejectReason?: string
  // Состав заказа (как у сделки)
  items?: import('./deals').DealItem[]
  systems?: import('./deals').DealSystemEntry[]
  services?: import('./deals').DealService[]
  direction?: string
  glassSupply?: string
  needPainting?: boolean
  paymentType?: string
  installType?: string
}

const QK = 'leads'

export const useLeads = (params?: { status?: LeadStatus; assigneeId?: string }) =>
  useQuery({ queryKey: [QK, params], queryFn: () => api.get<LeadListItem[]>('/leads', { params }).then(r => r.data) })

export const useLead = (id: string) =>
  useQuery({ queryKey: [QK, id], queryFn: () => api.get<Lead>(`/leads/${id}`).then(r => r.data), enabled: !!id })

export const useCreateLead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { contactId?: string; companyId?: string; assigneeId: string; comment?: string; leadSource?: LeadSource }) =>
      api.post<Lead>('/leads', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export const useChangeLeadStatus = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { status: LeadStatus; rejectReason?: string }) => api.post(`/leads/${id}/status`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export const useAddLeadEvent = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { content: string; type?: LeadEventType }) => api.post(`/leads/${id}/events`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, id] }),
  })
}

export const useConvertLead = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { direction: string; assigneeId: string; glassSupply?: string; needPainting?: boolean }) =>
      api.post<{ ok: boolean; dealId: string; number: string }>(`/leads/${id}/convert`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); qc.invalidateQueries({ queryKey: ['deals'] }) },
  })
}
