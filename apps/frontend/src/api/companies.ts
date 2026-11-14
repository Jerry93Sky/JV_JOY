import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export enum CompanyType { OOO = 'OOO', IP = 'IP', AO = 'AO', SZ = 'SZ', AGENT = 'AGENT' }

export interface BankAccount { id?: string; accountNum: string; bik: string }

export interface Company {
  id: string
  name: string
  type: CompanyType
  inn?: string
  ogrn?: string
  manualDiscountPct?: number | null
  bankAccounts: BankAccount[]
  contacts?: { contact: { id: string; firstName: string; lastName: string; phone: string } }[]
  turnoverLastYear?: number
  currentDiscount?: number
}

export function useCompanies(q?: string) {
  return useQuery({
    queryKey: ['companies', q],
    queryFn: () => api.get<Company[]>('/companies', { params: { q } }).then(r => r.data),
  })
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ['companies', id],
    queryFn: () => api.get<Company>(`/companies/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Company, 'id' | 'bankAccounts'> & { bankAccounts?: BankAccount[] }) =>
      api.post('/companies', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Company> & { id: string }) =>
      api.patch(`/companies/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useDeleteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}
