import type { MouseEvent, PointerEvent } from 'react'
import { useAuthStore } from '@/store/authStore'

/** Mirrors the existing OWNER/ADMIN server guards for administration records. */
export function useCanAdminRowEdit() {
  return useAuthStore(state => state.user?.role === 'OWNER' || state.user?.role === 'ADMIN')
}

const interactive = 'button, a, input, select, textarea, label, summary, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [contenteditable="true"], [data-no-row-edit]'
const pointerTypes = new WeakMap<HTMLElement, string>()

/** Reuse the existing edit action; never turn a nested control or touch gesture into an edit. */
export function rowEdit<T extends HTMLElement>(edit: () => void) {
  return {
    onPointerDownCapture: (event: PointerEvent<T>) => { pointerTypes.set(event.currentTarget, event.pointerType) },
    onDoubleClick: (event: MouseEvent<T>) => {
      const pointerType = pointerTypes.get(event.currentTarget)
      const sourceCapabilities = (event.nativeEvent as MouseEvent['nativeEvent'] & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities
      if (event.button !== 0 || pointerType === 'touch' || sourceCapabilities?.firesTouchEvents || event.defaultPrevented) return
      if (event.target instanceof Element && event.target.closest(interactive)) return
      edit()
    },
  }
}
