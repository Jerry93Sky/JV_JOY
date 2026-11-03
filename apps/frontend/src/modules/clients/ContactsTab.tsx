import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Phone, Mail, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useContacts, useDeleteContact, type Contact } from '@/api/contacts'
import ContactDialog from './ContactDialog'

export default function ContactsTab({ search, openContactId }: { search: string; openContactId?: string | null }) {
  const { data: contacts = [], isLoading } = useContacts(search || undefined)
  const deleteContact = useDeleteContact()
  const [editing, setEditing] = useState<Contact | null>(null)
  const [creating, setCreating] = useState(false)

  // Открываем контакт по id из URL
  useEffect(() => {
    if (openContactId && contacts.length > 0) {
      const c = contacts.find(x => x.id === openContactId)
      if (c) setEditing(c)
    }
  }, [openContactId, contacts])

  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка...</div>

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={15} className="mr-1" /> Добавить контакт
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">ФИО</th>
              <th className="text-left px-4 py-2 font-medium">Телефон</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Должность</th>
              <th className="text-left px-4 py-2 font-medium">Компании</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Контакты не найдены</td></tr>
            )}
            {contacts.map(c => (
              <tr key={c.id} className="border-t hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{c.lastName} {c.firstName} {c.middleName}</td>
                <td className="px-4 py-2">
                  <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Phone size={13} />{c.phone}
                  </a>
                </td>
                <td className="px-4 py-2">
                  {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-primary hover:underline"><Mail size={13} />{c.email}</a>}
                </td>
                <td className="px-4 py-2">
                  {c.position && <span className="flex items-center gap-1 text-muted-foreground"><Briefcase size={13} />{c.position}</span>}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {c.companies.map(cc => (
                      <span key={cc.company.id} className="bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-full">{cc.company.name}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(c)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm('Удалить контакт?')) deleteContact.mutate(c.id) }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ContactDialog
          contact={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
