import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface VendorCategory {
  id: string
  name: string
  _count?: { vendors: number }
}

export interface Vendor {
  id: string
  name: string
  categoryId: string
  phone?: string | null
  email?: string | null
  address?: string | null
  comment?: string | null
  isPainting: boolean
  isDefault: boolean
  isActive: boolean
  createdAt: string
  category: VendorCategory
}

const QK = 'vendors'
const QK_CAT = 'vendorCategories'

export const useVendorCategories = () => useQuery({
  queryKey: [QK_CAT],
  queryFn: () => api.get<VendorCategory[]>('/vendors/categories').then(r => r.data),
})

export const useCreateVendorCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post('/vendors/categories', { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK_CAT] }),
  })
}

export const useDeleteVendorCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/vendors/categories/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK_CAT] }),
  })
}

export const useVendors = (params?: { categoryId?: string; isPainting?: boolean }) => useQuery({
  queryKey: [QK, params],
  queryFn: () => api.get<Vendor[]>('/vendors', { params }).then(r => r.data),
})

export const useCreateVendor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: Omit<Vendor, 'id' | 'createdAt' | 'category'>) => api.post('/vendors', d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export const useUpdateVendor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...d }: Partial<Vendor> & { id: string }) => api.patch(`/vendors/${id}`, d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export const useDeleteVendor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/vendors/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}
