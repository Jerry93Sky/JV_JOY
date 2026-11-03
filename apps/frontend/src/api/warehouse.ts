import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface ProductType { id: string; name: string }

export interface Product {
  id: string; sku: string; name: string; typeId: string; type: ProductType
  unit: string; isPaintable: boolean
  markupRetail: number; markupWholesale: number
  priceRetail: number; priceWholesale: number
  quantity: number; reservedQty: number; isActive: boolean
}

export interface Supplier { id: string; name: string }

export interface ReceiptItem { productId: string; quantity: number; costPrice: number; product?: Product }
export interface Receipt {
  id: string; supplierId: string; supplier: Supplier; date: string
  editableUntil: string; items: ReceiptItem[]
}

export interface WriteoffItem { productId: string; quantity: number; product?: Product }
export interface Writeoff {
  id: string; reason: 'INVENTORY' | 'DEFECT'; comment: string
  date: string; editableUntil: string; items: WriteoffItem[]
}

// Product Types
export const useProductTypes = () => useQuery({ queryKey: ['productTypes'], queryFn: () => api.get<ProductType[]>('/products/types').then(r => r.data) })
export const useCreateProductType = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (name: string) => api.post('/products/types', { name }).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['productTypes'] }) }) }

// Products
export const useProducts = (q?: string, typeId?: string) => useQuery({
  queryKey: ['products', q, typeId],
  queryFn: () => api.get<Product[]>('/products', { params: { q, typeId } }).then(r => r.data),
})
export const useCreateProduct = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (data: Omit<Product, 'id' | 'type' | 'quantity' | 'reservedQty' | 'isActive'>) => api.post('/products', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) }) }
export const useUpdateProduct = () => { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, ...data }: Partial<Product> & { id: string }) => api.patch(`/products/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) }) }

// Suppliers
export const useSuppliers = () => useQuery({ queryKey: ['suppliers'], queryFn: () => api.get<Supplier[]>('/suppliers').then(r => r.data) })
export const useCreateSupplier = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (name: string) => api.post('/suppliers', { name }).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }) }) }

// Receipts
export const useReceipts = () => useQuery({ queryKey: ['receipts'], queryFn: () => api.get<Receipt[]>('/receipts').then(r => r.data) })
export const useCreateReceipt = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (data: { supplierId: string; date?: string; items: { productId: string; quantity: number; costPrice: number }[] }) => api.post('/receipts', data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['receipts'] }); qc.invalidateQueries({ queryKey: ['products'] }) } }) }
export const useUpdateReceipt = () => { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, ...data }: { id: string; date?: string; items?: { productId: string; quantity: number; costPrice: number }[] }) => api.patch(`/receipts/${id}`, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['receipts'] }); qc.invalidateQueries({ queryKey: ['products'] }) } }) }

// Writeoffs
export const useWriteoffs = () => useQuery({ queryKey: ['writeoffs'], queryFn: () => api.get<Writeoff[]>('/writeoffs').then(r => r.data) })
export const useCreateWriteoff = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (data: { reason: string; comment: string; items: { productId: string; quantity: number }[] }) => api.post('/writeoffs', data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['writeoffs'] }); qc.invalidateQueries({ queryKey: ['products'] }) } }) }
