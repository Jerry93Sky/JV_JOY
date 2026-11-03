// Единые классы для тёмной темы

// Бейджи статусов
export const badge = {
  // Нейтральные
  default: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
  secondary: 'bg-white/8 text-muted-foreground border border-white/10',

  // Цветные
  blue: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  sky: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  indigo: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  green: 'bg-green-500/20 text-green-300 border border-green-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  amber: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  orange: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  red: 'bg-red-500/20 text-red-300 border border-red-500/30',
  purple: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  pink: 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
  teal: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  lime: 'bg-lime-500/20 text-lime-300 border border-lime-500/30',
  violet: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
}

// Предупреждения / алерты
export const alert = {
  warning: 'bg-amber-500/10 border border-amber-500/30 text-amber-300',
  error: 'bg-red-500/10 border border-red-500/30 text-red-300',
  info: 'bg-blue-500/10 border border-blue-500/30 text-blue-300',
  success: 'bg-green-500/10 border border-green-500/30 text-green-300',
}

// Роли пользователей
export const roleBadge: Record<string, string> = {
  OWNER: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  ADMIN: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  USER: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
  GUEST: 'bg-green-500/20 text-green-300 border border-green-500/30',
}

// Статусы лидов
export const leadStatusBadge: Record<string, string> = {
  NEW: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  CONVERTED: 'bg-green-500/20 text-green-300 border border-green-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 border border-red-500/30',
}

// Типы компаний
export const companyTypeBadge = 'bg-white/8 text-muted-foreground border border-white/10'

// Статусы активности
export const activeBadge = 'text-green-400'
export const inactiveBadge = 'text-muted-foreground'
