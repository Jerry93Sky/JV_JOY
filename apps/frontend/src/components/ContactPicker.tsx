import { useState } from 'react'
import { Plus, X, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useContacts, useCreateContact, type Contact } from '@/api/contacts'

interface Props {
  value: string
  onChange: (id: string) => void
}

export default function ContactPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newData, setNewData] = useState({ lastName: '', firstName: '', middleName: '', phone: '' })
  const { data: contacts = [] } = useContacts(search || undefined)
  const createContact = useCreateContact()

  const selected = contacts.find(c => c.id === value)

  async function handleCreate() {
    if (!newData.lastName || !newData.firstName || !newData.phone) return
    try {
      const c = await createContact.mutateAsync(newData)
      onChange(c.id)
      setShowNew(false)
      setNewData({ lastName: '', firstName: '', middleName: '', phone: '' })
      setSearch('')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (msg) alert(msg)
    }
  }

  if (selected && !showNew) {
    return (
      <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30">
        <div className="flex-1 text-sm">
          <span className="font-medium">{selected.lastName} {selected.firstName} {selected.middleName}</span>
          <span className="text-muted-foreground ml-2">{selected.phone}</span>
        </div>
        <button type="button" onClick={() => { onChange(''); setSearch('') }} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>
    )
  }

  if (showNew) {
    return (
      <div className="border rounded-md p-3 space-y-2 bg-muted/20">
        <p className="text-xs font-medium text-muted-foreground">Новый контакт</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Фамилия *</label>
            <Input value={newData.lastName} onChange={e => setNewData(d => ({ ...d, lastName: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Имя *</label>
            <Input value={newData.firstName} onChange={e => setNewData(d => ({ ...d, firstName: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Отчество</label>
            <Input value={newData.middleName} onChange={e => setNewData(d => ({ ...d, middleName: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Телефон *</label>
            <Input value={newData.phone} onChange={e => setNewData(d => ({ ...d, phone: e.target.value }))} placeholder="+7..." />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleCreate} disabled={createContact.isPending}>Создать и выбрать</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowNew(false)}>Отмена</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону..."
          className="pl-8"
        />
      </div>
      {search && (
        <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
          {contacts.length === 0 && (
            <div className="text-xs text-muted-foreground px-3 py-2">Не найдено</div>
          )}
          {contacts.map(c => (
            <button key={c.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-0"
              onClick={() => { onChange(c.id); setSearch('') }}>
              <span className="font-medium">{c.lastName} {c.firstName} {c.middleName}</span>
              <span className="text-muted-foreground ml-2">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setShowNew(true)}>
        <Plus size={13} className="mr-1" />Создать новый контакт
      </Button>
    </div>
  )
}
