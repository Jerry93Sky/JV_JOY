import { useState } from 'react'
import { Search, Plus, X, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCompanies, useCreateCompany, type Company } from '@/api/companies'
import { CompanyType } from '@/api/companies'

interface Props {
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

export default function CompanyPicker({ value, onChange, placeholder = 'Поиск компании...' }: Props) {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CompanyType>(CompanyType.OOO)
  const { data: companies = [] } = useCompanies(search || undefined)
  const createCompany = useCreateCompany()

  const selected = companies.find(c => c.id === value) ||
    (value ? { id: value, name: '...', type: CompanyType.OOO } as Company : null)

  async function handleCreate() {
    if (!newName.trim()) return
    const c = await createCompany.mutateAsync({ name: newName.trim(), type: newType })
    onChange(c.id)
    setShowNew(false)
    setNewName('')
    setSearch('')
  }

  if (selected && !showNew) {
    return (
      <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30">
        <Building2 size={14} className="text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-medium">{selected.name}</span>
        <button type="button" onClick={() => { onChange(''); setSearch('') }} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>
    )
  }

  if (showNew) {
    return (
      <div className="border rounded-md p-3 space-y-2 bg-muted/20">
        <p className="text-xs font-medium text-muted-foreground">Новая компания</p>
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название компании" autoFocus />
        <select value={newType} onChange={e => setNewType(e.target.value as CompanyType)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <option value={CompanyType.OOO}>ООО</option>
          <option value={CompanyType.IP}>ИП</option>
          <option value={CompanyType.AO}>АО</option>
          <option value={CompanyType.SZ}>СЗ</option>
          <option value={CompanyType.AGENT}>Агент</option>
        </select>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleCreate} disabled={createCompany.isPending}>Создать и выбрать</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowNew(false)}>Отмена</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder} className="pl-8" />
      </div>
      {search && (
        <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
          {companies.length === 0 && (
            <div className="text-xs text-muted-foreground px-3 py-2">Не найдено</div>
          )}
          {companies.map(c => (
            <button key={c.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-0"
              onClick={() => { onChange(c.id); setSearch('') }}>
              <span className="font-medium">{c.name}</span>
              <span className="text-muted-foreground ml-2 text-xs">{c.type}</span>
            </button>
          ))}
        </div>
      )}
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setShowNew(true)}>
        <Plus size={13} className="mr-1" />Создать новую компанию
      </Button>
    </div>
  )
}
