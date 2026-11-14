import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCreateLead, type LeadSource } from '@/api/leads'
import { useCompanies } from '@/api/companies'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import ContactPicker from '@/components/ContactPicker'

interface FormData {
  contactId: string; companyId: string; assigneeId: string
  comment: string; leadSource: LeadSource
}
interface Props { onClose: () => void; onCreated: (id: string) => void }

// Два пути создания лида
type CreateMode = 'contact' | 'calculation'

export default function CreateLeadDialog({ onClose, onCreated }: Props) {
  const [mode, setMode] = useState<CreateMode>('contact')
  const { register, handleSubmit, control } = useForm<FormData>({ defaultValues: { leadSource: 'MANUAL' } })
  const createLead = useCreateLead()
  const { data: companies = [] } = useCompanies()
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const currentUser = useAuthStore(s => s.user)

  async function onSubmit(data: FormData) {
    const lead = await createLead.mutateAsync({
      ...data,
      contactId: mode === 'contact' ? data.contactId : undefined,
      companyId: data.companyId || undefined,
    })
    onCreated(lead.id)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Новый лид</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Выбор пути создания */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('contact')}
              className={`p-3 rounded-lg border text-sm text-left transition-colors ${mode === 'contact' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>
              <div className="font-medium">С контакта</div>
              <div className="text-xs text-muted-foreground mt-0.5">Сначала клиент, потом расчёт</div>
            </button>
            <button type="button" onClick={() => setMode('calculation')}
              className={`p-3 rounded-lg border text-sm text-left transition-colors ${mode === 'calculation' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>
              <div className="font-medium">С расчёта</div>
              <div className="text-xs text-muted-foreground mt-0.5">Сначала расчёт, контакт позже</div>
            </button>
          </div>

          {/* Контакт — только в режиме "с контакта" */}
          {mode === 'contact' && (
            <div>
              <label className="text-xs text-muted-foreground">Контактное лицо *</label>
              <Controller name="contactId" control={control} rules={{ required: mode === 'contact' }}
                render={({ field }) => <ContactPicker value={field.value} onChange={field.onChange} />}
              />
            </div>
          )}

          {mode === 'calculation' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400">
              Лид будет создан без контакта. Не забудьте добавить контакт перед выставлением счёта.
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">Компания</label>
            <select {...register('companyId')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Не указана</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Источник</label>
              <select {...register('leadSource')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="MANUAL">Вручную</option>
                <option value="CALL">Звонок</option>
                <option value="WEBSITE">Сайт</option>
                <option value="OTHER">Другое</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ответственный *</label>
              <select {...register('assigneeId', { required: true })} defaultValue={currentUser?.id}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {users.map((u: { id: string; firstName: string; lastName: string }) => (
                  <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Комментарий</label>
            <textarea {...register('comment')} rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={createLead.isPending}>
              {createLead.isPending ? 'Создание...' : 'Создать лид'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
