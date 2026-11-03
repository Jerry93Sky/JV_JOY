import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Contact {
  id: string
  lastName: string
  firstName: string
  middleName?: string
  phone: string
  email?: string
  position?: string
  companies: { company: { id: string; name: string } }[]
}

export function useContacts(q?: string) {
  return useQuery({
    queryKey: ['contacts', q],
    queryFn: () => api.get<Contact[]>('/contacts', { params: { q } }).then(r => r.data),
  })
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: () => api.get<Contact>(`/contacts/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Contact, 'id' | 'companies'> & { companyIds?: string[] }) =>
      api.post('/contacts', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Contact> & { id: string; companyIds?: string[] }) =>
      api.patch(`/contacts/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  })
}
