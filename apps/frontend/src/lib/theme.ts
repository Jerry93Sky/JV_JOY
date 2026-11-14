export type ThemePreference = 'light' | 'dark' | 'system'
const KEY='bms-theme'
export function getThemePreference(): ThemePreference { const v=localStorage.getItem(KEY);return v==='light'||v==='dark'?v:'system' }
function apply(preference:ThemePreference){const dark=preference==='dark'||(preference==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark)}
export function setThemePreference(preference:ThemePreference){localStorage.setItem(KEY,preference);apply(preference)}
export function watchSystemTheme(){const media=window.matchMedia('(prefers-color-scheme: dark)');const update=()=>{if(getThemePreference()==='system')apply('system')};media.addEventListener('change',update);return()=>media.removeEventListener('change',update)}
export function initializeTheme(){apply(getThemePreference());return watchSystemTheme()}
