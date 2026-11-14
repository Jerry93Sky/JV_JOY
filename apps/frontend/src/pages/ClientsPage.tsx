import { useState, useEffect } from 'react'
import { Users, Building2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import ContactsTab from '@/modules/clients/ContactsTab'
import CompaniesTab from '@/modules/clients/CompaniesTab'
import { useOpenEntity } from '@/hooks/useOpenEntity'
import { useClearOpenEntity } from '@/hooks/useOpenEntity'

type Tab = 'contacts' | 'companies'

export default function ClientsPage() {
  const [tab, setTab] = useState<Tab>('contacts')
  const [search, setSearch] = useState('')

  // Читаем параметры из URL для прямой навигации
  const openContactId = useOpenEntity('contact')
  const openCompanyId = useOpenEntity('company')
  const clearOpen = useClearOpenEntity()

  useEffect(() => {
    if (openContactId) {
      setTab('contacts')
    } else if (openCompanyId) {
      setTab('companies')
    }
  }, [openContactId, openCompanyId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Клиентская база</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex border rounded-md overflow-hidden">
          <button onClick={() => { setTab('contacts'); clearOpen() }}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${tab === 'contacts' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <Users size={15} /> Контакты
          </button>
          <button onClick={() => { setTab('companies'); clearOpen() }}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${tab === 'companies' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <Building2 size={15} /> Компании
          </button>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input placeholder="Поиск..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {tab === 'contacts'
        ? <ContactsTab search={search} openContactId={openContactId} />
        : <CompaniesTab search={search} openCompanyId={openCompanyId} />}
    </div>
  )
}
