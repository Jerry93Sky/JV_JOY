import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface SystemLimit { id: string; minValue?: number; maxValue?: number }

export interface SystemParamCategory { id: string; systemId: string; name: string; order: number }

export interface SystemParameter {
  id: string; systemId: string; name: string; variable: string
  type: 'NUMBER' | 'SELECT' | 'BOOLEAN'
  paramKind: 'INPUT' | 'CALCULATED' | 'CONSTANT'
  options?: { label: string; value: string }[]
  formula?: string; defaultValue?: string
  showInProposal: boolean; showInAssembly: boolean
  proposalPriority?: number
  isAdvanced?: boolean
  categoryId?: string
  limits: SystemLimit[]
}

export interface SystemComponent {
  id: string; systemId: string; productId: string; formula: string
  product: { id: string; name: string; sku: string; unit: string; sellingPrice: number }
}

export interface GlazingSystem {
  id: string; name: string; isActive: boolean; createdAt: string
  parameters: SystemParameter[]
  components: SystemComponent[]
  categories: SystemParamCategory[]
}

export interface CalcResult {
  context: Record<string, number | string | boolean>
  displayParams: { name: string; variable: string; value: number | string | boolean; showInProposal: boolean; showInAssembly: boolean; paramKind: string }[]
  components: { productId: string; productName: string; productSku: string; unit: string; sellingPrice: number; quantity: number; formula: string }[]
  warnings: { paramName: string; variable: string; value: number; min?: number; max?: number }[]
}

const QK = 'systems'

export const useSystems = (includeInactive = false) => useQuery({
  queryKey: [QK, includeInactive],
  queryFn: () => api.get<GlazingSystem[]>('/systems', { params: { includeInactive } }).then(r => r.data),
})

export const useSystem = (id: string) => useQuery({
  queryKey: [QK, id],
  queryFn: () => api.get<GlazingSystem>(`/systems/${id}`).then(r => r.data),
  enabled: !!id,
})

export const useCreateSystem = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (name: string) => api.post('/systems', { name }).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }) }) }
export const useUpdateSystem = () => { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; isActive?: boolean }) => api.patch(`/systems/${id}`, d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }) }) }
export const useDeleteSystem = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.delete(`/systems/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }) }) }

export const useCreateParameter = (systemId: string) => { const qc = useQueryClient(); return useMutation({ mutationFn: (d: Omit<SystemParameter, 'id' | 'systemId' | 'limits'>) => api.post(`/systems/${systemId}/parameters`, d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId] }) }) }
export const useUpdateParameter = (systemId: string) => { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, ...d }: Partial<SystemParameter> & { id: string }) => api.patch(`/systems/${systemId}/parameters/${id}`, d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId] }) }) }
export const useDeleteParameter = (systemId: string) => { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.delete(`/systems/${systemId}/parameters/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId] }) }) }
export const useSaveLimit = (systemId: string, paramId: string) => { const qc = useQueryClient(); return useMutation({ mutationFn: (d: { id?: string; minValue?: number; maxValue?: number }) => d.id ? api.patch(`/systems/${systemId}/parameters/${paramId}/limits/${d.id}`, d).then(r => r.data) : api.post(`/systems/${systemId}/parameters/${paramId}/limits`, d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId] }) }) }

export const useCreateComponent = (systemId: string) => { const qc = useQueryClient(); return useMutation({ mutationFn: (d: { productId: string; formula: string }) => api.post(`/systems/${systemId}/components`, d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId] }) }) }
export const useUpdateComponent = (systemId: string) => { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, formula }: { id: string; formula: string }) => api.patch(`/systems/${systemId}/components/${id}`, { formula }).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId] }) }) }
export const useDeleteComponent = (systemId: string) => { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.delete(`/systems/${systemId}/components/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId] }) }) }

export const useCalculate = (systemId: string) => useMutation({
  mutationFn: (inputs: Record<string, number | string | boolean>) =>
    api.post<CalcResult>(`/systems/${systemId}/calculate`, { inputs }).then(r => r.data),
})

// Categories
export const useSystemCategories = (systemId: string) => useQuery({
  queryKey: [QK, systemId, 'categories'],
  queryFn: () => api.get<SystemParamCategory[]>(`/systems/${systemId}/categories`).then(r => r.data),
  enabled: !!systemId,
})
export const useCreateCategory = (systemId: string) => { const qc = useQueryClient(); return useMutation({ mutationFn: (d: { name: string; order?: number }) => api.post(`/systems/${systemId}/categories`, d).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, systemId] }); qc.invalidateQueries({ queryKey: [QK, systemId, 'categories'] }) } }) }
export const useDeleteCategory = (systemId: string) => { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.delete(`/systems/${systemId}/categories/${id}`).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, systemId] }); qc.invalidateQueries({ queryKey: [QK, systemId, 'categories'] }) } }) }

// ── Стёкла системы ────────────────────────────────────────────────────────────

export interface SystemGlass {
  id: string
  systemId: string
  name: string
  widthFormula: string
  heightFormula: string
  quantityFormula: string
  complexity: 'PLAIN' | 'CUTS' | 'HOLES'
  glassTypeId: string | null
  order: number
  glassType?: { id: string; thickness: number; coating: string; glassKind: string } | null
}

export const useSystemGlasses = (systemId: string) => useQuery({
  queryKey: [QK, systemId, 'glasses'],
  queryFn: () => api.get<SystemGlass[]>(`/systems/${systemId}/glasses`).then(r => r.data),
  enabled: !!systemId,
})

export const useCreateGlass = (systemId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: { name: string; widthFormula: string; heightFormula: string; quantityFormula?: string; complexity?: string; glassTypeId?: string | null; order?: number }) =>
      api.post(`/systems/${systemId}/glasses`, d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId, 'glasses'] }),
  })
}

export const useUpdateGlass = (systemId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...d }: Partial<SystemGlass> & { id: string }) =>
      api.patch(`/systems/${systemId}/glasses/${id}`, d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId, 'glasses'] }),
  })
}

export const useDeleteGlass = (systemId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/systems/${systemId}/glasses/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId, 'glasses'] }),
  })
}

export const useReorderParameters = (systemId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (priorities: { id: string; proposalPriority: number }[]) =>
      api.post(`/systems/${systemId}/parameters/reorder`, { priorities }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, systemId] }),
  })
}
