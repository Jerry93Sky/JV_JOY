import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateDeal, Direction, GlassSupply } from '@/api/deals'
import { useContact } from '@/api/contacts'
import { useCompany } from '@/api/companies'
import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'
import ContactPicker from '@/components/ContactPicker'
import CompanyPicker from '@/components/CompanyPicker'

interface FormData {
  direction: Direction; assigneeId: string; comment: string
  isAgentOrder: boolean; agentPercent: number
  glassSupply: GlassSupply; needPainting: boolean
}

interface Props { onClose: () => void; onCreated: (id: string) => void }

export default function CreateDealDialog({ onClose, onCreated }: Props) {
  const { register, handleSubmit, watch, control } = useForm<FormData>({
    defaultValues: { direction: Direction.PRIVATE, glassSupply: GlassSupply.OURS, isAgentOrder: false, needPainting: false },
  })
  const createDeal = useCreateDeal()
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const currentUser = useAuthStore(s => s.user)
  const isAgent = watch('isAgentOrder')

  const [contactId, setContactId] = useState('')
  const [companyId, setCompanyId] = useState('')

  // Загружаем данные выбранного контакта для фильтрации компаний
  const { data: selectedContact } = useContact(contactId)
  // Загружаем данные выбранной компании для фильтрации контактов
  const { data: selectedCompany } = useCompany(companyId)

  // Компании привязанные к выбранному контакту
  const contactCompanies = selectedContact?.companies?.map(c => c.company) || []
  // Контакты привязанные к выбранной компании
  const companyContacts = (selectedCompany as never as { contacts?: { contact: { id: string; firstName: string; lastName: string; phone: string } }[] })?.contacts || []

  async function onSubmit(data: FormData) {
    if (!contactId) return
    const deal = await createDeal.mutateAsync({
      ...data,
      contactId,
      companyId: companyId || undefined,
      agentPercent: isAgent ? data.agentPercent : undefined,
    })
    onCreated(deal.id)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Новая заявка</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

          {/* Контакт */}
          <div>
            <label className="text-xs text-muted-foreground">Контактное лицо *</label>
            {companyId && companyContacts.length > 0 ? (
              // Если выбрана компания — показываем только её контакты
              <div className="space-y-1">
                {contactId ? (
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30 text-sm">
                    <span className="flex-1 font-medium">
                      {companyContacts.find(c => c.contact.id === contactId)?.contact.lastName} {companyContacts.find(c => c.contact.id === contactId)?.contact.firstName}
                    </span>
                    <button type="button" onClick={() => setContactId('')} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                ) : (
                  <select value={contactId} onChange={e => setContactId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Выберите контакт компании</option>
                    {companyContacts.map(cc => (
                      <option key={cc.contact.id} value={cc.contact.id}>
                        {cc.contact.lastName} {cc.contact.firstName} — {cc.contact.phone}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-muted-foreground">Показаны контакты выбранной компании. <button type="button" className="text-primary hover:underline" onClick={() => setContactId('')}>Выбрать другой</button></p>
              </div>
            ) : (
              <ContactPicker value={contactId} onChange={setContactId} />
            )}
          </div>

          {/* Компания */}
          <div>
            <label className="text-xs text-muted-foreground">Компания</label>
            {contactId && contactCompanies.length > 0 ? (
              // Если выбран контакт — показываем только его компании
              <div className="space-y-1">
                {companyId ? (
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30 text-sm">
                    <span className="flex-1 font-medium">{contactCompanies.find(c => c.id === companyId)?.name}</span>
                    <button type="button" onClick={() => setCompanyId('')} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                ) : (
                  <select value={companyId} onChange={e => setCompanyId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Не указана</option>
                    {contactCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <p className="text-xs text-muted-foreground">Показаны компании контакта. <button type="button" className="text-primary hover:underline" onClick={() => setCompanyId('')}>Выбрать другую</button></p>
              </div>
            ) : (
              <CompanyPicker value={companyId} onChange={setCompanyId} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Направление *</label>
              <select {...register('direction', { required: true })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value={Direction.PRIVATE}>Частный заказ</option>
                <option value={Direction.DEALER}>Дилерский заказ</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ответственный *</label>
              <select {...register('assigneeId', { required: true })} defaultValue={currentUser?.id} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {users.map((u: { id: string; firstName: string; lastName: string }) => <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Комментарий</label>
            <textarea {...register('comment')} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Поставка стекла</label>
              <select {...register('glassSupply')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value={GlassSupply.OURS}>Наше</option>
                <option value={GlassSupply.CLIENT}>Заказчика</option>
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...register('needPainting')} />
                Нужна покраска
              </label>
            </div>
          </div>

          <div className="border rounded-md p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
              <input type="checkbox" {...register('isAgentOrder')} />
              Заказ от агента
            </label>
            {isAgent && (
              <div>
                <label className="text-xs text-muted-foreground">Агентский процент %</label>
                <Input type="number" step="0.1" min="0" max="100" {...register('agentPercent', { valueAsNumber: true })} className="w-32" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={!contactId || createDeal.isPending}>Создать заявку</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
