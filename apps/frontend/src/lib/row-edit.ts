import type { MouseEvent, PointerEvent } from 'react'
import { useAuthStore } from '@/store/authStore'

/** Mirrors the existing OWNER/ADMIN server guards for administration records. */
export function useCanAdminRowEdit() {
  return useAuthStore(state => state.user?.role === 'OWNER' || state.user?.role === 'ADMIN')
}

const interactive = 'button, a, input, select, textarea, label, summary, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [contenteditable="true"], [data-no-row-edit]'
let lastPointerType = ''

/** Reuse the existing edit action; never turn a nested control or touch gesture into an edit. */
export function rowEdit<T extends HTMLElement>(edit: () => void) {
  return {
    onPointerDownCapture: (event: PointerEvent<T>) => { lastPointerType = event.pointerType },
    onDoubleClick: (event: MouseEvent<T>) => {
      if (event.button !== 0 || lastPointerType === 'touch' || event.defaultPrevented) return
      if (event.target instanceof Element && event.target.closest(interactive)) return
      edit()
    },
  }
}
