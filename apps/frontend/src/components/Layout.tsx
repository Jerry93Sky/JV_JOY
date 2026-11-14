import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
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
  const navigate=useNavigate()
  const [open,setOpen]=useState(false)
  const [query,setQuery]=useState('')
  const [selected,setSelected]=useState(0)
  const priorFocus=useRef<HTMLElement|null>(null)
  const navigating=useRef(false)
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(open)return;priorFocus.current=document.activeElement as HTMLElement;navigating.current=false;setQuery('');setSelected(0);setOpen(true)}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[open])
  const visibleNav = nav.filter(item => item.to !== '/jv/orders/new' || user?.role === 'OWNER' || user?.role === 'ADMIN')

  const matches=visibleNav.filter(item=>(item.label+' '+item.to).toLowerCase().includes(query.toLowerCase()))
  function run(index:number){const item=matches[index];if(item){navigating.current=true;setOpen(false);navigate(item.to)}}
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Dialog open={open} onOpenChange={setOpen}><DialogContent aria-describedby={undefined} onCloseAutoFocus={e=>{e.preventDefault();if(!navigating.current&&priorFocus.current?.isConnected)priorFocus.current.focus();else document.querySelector<HTMLElement>('main')?.focus()}}><DialogTitle>Быстрый переход</DialogTitle><input role="combobox" aria-expanded="true" aria-controls="command-results" aria-activedescendant={matches[selected]?`command-option-${selected}`:undefined} aria-autocomplete="list" aria-label="Поиск раздела" className="rounded border bg-background p-2" value={query} onChange={e=>{setQuery(e.target.value);setSelected(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setSelected(i=>Math.min(i+1,matches.length-1))}else if(e.key==='ArrowUp'){e.preventDefault();setSelected(i=>Math.max(i-1,0))}else if(e.key==='Enter'){e.preventDefault();run(selected)}}}/><div id="command-results" role="listbox" aria-label="Разделы">{matches.map((item,i)=><button key={item.to} id={`command-option-${i}`} role="option" aria-selected={i===selected} className={`block w-full rounded p-2 text-left ${i===selected?'bg-accent':'hover:bg-muted'}`} onMouseMove={()=>setSelected(i)} onClick={()=>run(i)}>{item.label}</button>)}{!matches.length&&<p>Ничего не найдено.</p>}</div></DialogContent></Dialog>
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      <main tabIndex={-1} className="flex-1 overflow-auto pb-16 md:pb-0">
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
