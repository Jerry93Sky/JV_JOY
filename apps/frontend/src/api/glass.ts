import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface GlassType {
  id: string
  thickness: number
  coating: string
  glassKind: string
  costPricePerSqm: number
  sellingPricePerSqm: number
  deliveryCostFixed: number
  costPriceWithCuts?: number | null
  sellingPriceWithCuts?: number | null
  surchargeWithCutsPct?: number | null
  costPriceWithHoles?: number | null
  sellingPriceWithHoles?: number | null
  surchargeWithHolesPct?: number | null
  isActive: boolean
  createdAt: string
}

const QK = 'glassTypes'

export const useGlassTypes = () => useQuery({
  queryKey: [QK],
  queryFn: () => api.get<GlassType[]>('/glass-types').then(r => r.data),
})

export const useCreateGlassType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: Omit<GlassType, 'id' | 'createdAt'>) => api.post('/glass-types', d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export const useUpdateGlassType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...d }: Partial<GlassType> & { id: string }) => api.patch(`/glass-types/${id}`, d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export const useDeleteGlassType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/glass-types/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}
