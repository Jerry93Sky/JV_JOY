import { useState } from 'react'
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme'
import { Users, Package, Wrench, Percent, Building2, Layers } from 'lucide-react'
import UsersTab from '@/modules/settings/UsersTab'
import ServicesTab from '@/modules/settings/ServicesTab'
import ProductTypesTab from '@/modules/settings/ProductTypesTab'
import DiscountThresholdsTab from '@/modules/settings/DiscountThresholdsTab'
import GeneralSettingsTab from '@/modules/settings/GeneralSettingsTab'
import GlassTypesTab from '@/modules/settings/GlassTypesTab'

type Tab = 'users' | 'services' | 'productTypes' | 'discounts' | 'general' | 'glass'

const tabs = [
  { id: 'users' as Tab, label: 'Пользователи', icon: Users },
  { id: 'services' as Tab, label: 'Услуги', icon: Wrench },
  { id: 'productTypes' as Tab, label: 'Типы товаров', icon: Package },
  { id: 'discounts' as Tab, label: 'Скидки дилеров', icon: Percent },
  { id: 'glass' as Tab, label: 'Типы стекла', icon: Layers },
  { id: 'general' as Tab, label: 'Общие', icon: Building2 },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('users')
  const [theme,setTheme]=useState<ThemePreference>(()=>getThemePreference())

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Настройки</h1>
      <div className="flex border-b gap-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${tab === id ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      <section className="rounded-lg border bg-card p-4"><label className="flex items-center justify-between gap-4"><span><strong>Оформление</strong><span className="block text-sm text-muted-foreground">Светлая, тёмная или системная тема</span></span><select aria-label="Тема интерфейса" className="rounded-md border bg-background px-3 py-2" value={theme} onChange={e=>{const value=e.target.value as ThemePreference;setTheme(value);setThemePreference(value)}}><option value="system">Как в системе</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label></section>
      {tab === 'services' && <ServicesTab />}
      {tab === 'productTypes' && <ProductTypesTab />}
      {tab === 'discounts' && <DiscountThresholdsTab />}
      {tab === 'glass' && <GlassTypesTab />}
      {tab === 'general' && <GeneralSettingsTab />}
    </div>
  )
}
