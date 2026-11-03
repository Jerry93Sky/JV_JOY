import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface FinanceSummary {
  grossRevenue: number; costOfGoods: number; grossProfit: number
  netProfit: number; margin: number; totalExpenses: number
  taxLoad: number; officialRevenue: number
  expensesByCategory: Record<string, number>; dealsCount: number
}

export interface Expense {
  id: string; categoryId: string; amount: number; comment?: string
  dealId?: string; date: string
  category: { id: string; name: string }
  deal?: { id: string; number: string }
}

export interface ExpenseCategory { id: string; name: string }

export interface Analytics {
  topSystems: { name: string; count: number }[]
  paintColors: { color: string; count: number }[]
  topProducts: { name: string; totalQty: number }[]
  dealsCount: number
}

export const useFinanceSummary = (from: string, to: string, compareFrom?: string, compareTo?: string) => useQuery({
  queryKey: ['finance', 'summary', from, to, compareFrom, compareTo],
  queryFn: () => api.get<{ main: FinanceSummary; compare?: FinanceSummary }>('/finance/summary', { params: { from, to, compareFrom, compareTo } }).then(r => r.data),
  enabled: !!from && !!to,
})

export const useExpenses = (from?: string, to?: string) => useQuery({
  queryKey: ['finance', 'expenses', from, to],
  queryFn: () => api.get<Expense[]>('/finance/expenses', { params: { from, to } }).then(r => r.data),
})

export const useExpenseCategories = () => useQuery({
  queryKey: ['finance', 'categories'],
  queryFn: () => api.get<ExpenseCategory[]>('/finance/expense-categories').then(r => r.data),
})

export const useCreateExpenseCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post('/finance/expense-categories', { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'categories'] }),
  })
}

export const useCreateExpense = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: { categoryId: string; amount: number; comment?: string; dealId?: string; date?: string }) =>
      api.post('/finance/expenses', d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}

export const useAnalytics = (from: string, to: string) => useQuery({
  queryKey: ['finance', 'analytics', from, to],
  queryFn: () => api.get<Analytics>('/finance/analytics', { params: { from, to } }).then(r => r.data),
  enabled: !!from && !!to,
})
