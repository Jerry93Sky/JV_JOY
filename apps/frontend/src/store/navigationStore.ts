import { create } from 'zustand'

type EntityType = 'deal' | 'lead' | 'contact' | 'company'

interface NavigationState {
  // Стек навигации для перехода между сущностями
  stack: { type: EntityType; id: string; label: string }[]
  push: (type: EntityType, id: string, label: string) => void
  pop: () => void
  clear: () => void
  current: () => { type: EntityType; id: string; label: string } | null
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  stack: [],
  push: (type, id, label) => set(s => ({ stack: [...s.stack, { type, id, label }] })),
  pop: () => set(s => ({ stack: s.stack.slice(0, -1) })),
  clear: () => set({ stack: [] }),
  current: () => { const s = get().stack; return s.length > 0 ? s[s.length - 1] : null },
}))
