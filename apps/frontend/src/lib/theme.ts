export type ThemePreference = 'light' | 'dark' | 'system'
const KEY = 'bms-theme'
export function getThemePreference(): ThemePreference {
  try { const value = localStorage.getItem(KEY); return value === 'light' || value === 'dark' ? value : 'system' } catch { return 'system' }
}
function apply(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
export function setThemePreference(preference: ThemePreference) {
  try { localStorage.setItem(KEY, preference) } catch { /* Theme remains active for this page view. */ }
  apply(preference)
}
export function initializeTheme() {
  apply(getThemePreference())
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const update = () => { if (getThemePreference() === 'system') apply('system') }
  media.addEventListener('change', update)
  return () => media.removeEventListener('change', update)
}
