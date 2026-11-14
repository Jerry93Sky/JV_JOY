import { Outlet, NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard, Users, Package, Settings,
  BarChart3, Layers, LogOut, Inbox, Truck, FlaskConical
} from 'lucide-react'

const nav = [
  { to: '/leads', label: 'Лиды', icon: Inbox },
  { to: '/deals', label: 'Сделки', icon: LayoutDashboard },
  { to: '/clients', label: 'Клиенты', icon: Users },
  { to: '/warehouse', label: 'Склад', icon: Package },
  { to: '/vendors', label: 'Поставщики', icon: Truck },
  { to: '/systems', label: 'Системы', icon: Layers },
  { to: '/jv/orders/new', label: 'JV-заказы', icon: Layers },
  { to: '/jv-line-lab', label: 'JV-Line Lab', icon: FlaskConical },
  { to: '/finance', label: 'Финансы', icon: BarChart3 },
  { to: '/settings', label: 'Настройки', icon: Settings },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const visibleNav = nav.filter(item => item.to !== '/jv/orders/new' || user?.role === 'OWNER' || user?.role === 'ADMIN')

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Сайдбар — только на десктопе */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-card text-card-foreground">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Layers size={16} className="text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-foreground">BMS</h1>
              <p className="text-xs text-muted-foreground leading-none">{user?.firstName} {user?.lastName}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/25 shadow-sm shadow-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border/30">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <div className="p-3 md:p-6">
          <Outlet />
        </div>
      </main>

      {/* Нижняя навигация — только на мобильных */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/50 bg-card text-card-foreground flex overflow-x-auto z-50">
        {visibleNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `min-w-16 flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-all ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={logout}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs text-muted-foreground"
        >
          <LogOut size={20} />
          <span className="text-[10px]">Выйти</span>
        </button>
      </nav>
    </div>
  )
}
