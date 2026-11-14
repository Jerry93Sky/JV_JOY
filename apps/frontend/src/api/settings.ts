import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export enum Role { OWNER = 'OWNER', ADMIN = 'ADMIN', USER = 'USER', GUEST = 'GUEST' }

export interface AppUser {
  id: string; login: string; firstName: string; lastName: string
  middleName?: string; role: Role; isActive: boolean
}

export interface Service { id: string; name: string; price?: number | null; priceFormula?: string | null; unit: string; isActive: boolean }
export interface DiscountThreshold { id: string; minTurnover: number; discountPct: number }

// Users
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api.get<AppUser[]>('/users').then(r => r.data) })
export const useCreateUser = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (d: { login: string; password: string; firstName: string; lastName: string; middleName?: string; role: Role }) => api.post('/users', d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) }) }
export const useUpdateUser = () => { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, ...d }: Partial<AppUser> & { id: string; password?: string }) => api.patch(`/users/${id}`, d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) }) }
export const useDeleteUser = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.delete(`/users/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) }) }

// Services
export const useServices = () => useQuery({ queryKey: ['services'], queryFn: () => api.get<Service[]>('/settings/services').then(r => r.data) })
export const useCreateService = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (d: { name: string; price?: number; priceFormula?: string; unit?: string }) => api.post('/settings/services', d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }) }) }
export const useUpdateService = () => { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, ...d }: Partial<Service> & { id: string }) => api.patch(`/settings/services/${id}`, d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }) }) }

// Discount thresholds
export const useDiscountThresholds = () => useQuery({ queryKey: ['discountThresholds'], queryFn: () => api.get<DiscountThreshold[]>('/settings/discount-thresholds').then(r => r.data) })
export const useCreateThreshold = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (d: { minTurnover: number; discountPct: number }) => api.post('/settings/discount-thresholds', d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['discountThresholds'] }) }) }
export const useDeleteThreshold = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.delete(`/settings/discount-thresholds/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['discountThresholds'] }) }) }

// General settings
export const useAppSettings = () => useQuery({ queryKey: ['appSettings'], queryFn: () => api.get<Record<string, string>>('/settings').then(r => r.data) })
export const useUpdateSettings = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (d: Record<string, string>) => api.patch('/settings', d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['appSettings'] }) }) }
