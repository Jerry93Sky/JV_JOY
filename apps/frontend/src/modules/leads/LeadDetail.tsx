import { useState } from 'react'
import { ArrowLeft, Phone, MessageSquare, ArrowRightCircle, XCircle, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLead, useChangeLeadStatus, useAddLeadEvent, type LeadStatus, type LeadEventType } from '@/api/leads'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import DealItemsPanel from '@/modules/deals/DealItemsPanel'
import TasksBlock from '@/modules/deals/TasksBlock'
import ContactPicker from '@/components/ContactPicker'
import { useUpdateDeal, type Deal } from '@/api/deals'
import FileUpload from '@/components/FileUpload'

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: '1.1 Новый', IN_PROGRESS: '1.2 В работе', CONVERTED: 'Конвертирован', REJECTED: 'Отклонён',
}
const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  CONVERTED: 'bg-green-500/20 text-green-300 border border-green-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 border border-red-500/30',
}
const EVENT_ICONS: Partial<Record<LeadEventType, React.ReactNode>> = {
  CREATED: <CheckCircle2 size={14} className="text-green-500" />,
  COMMENT_ADDED: <MessageSquare size={14} className="text-blue-500" />,
  CALL_INBOUND: <Phone size={14} className="text-green-600" />,
  CALL_OUTBOUND: <Phone size={14} className="text-blue-600" />,
  CONVERTED: <ArrowRightCircle size={14} className="text-green-600" />,
  REJECTED: <XCircle size={14} className="text-red-500" />,
  STATUS_CHANGED: <ArrowRightCircle size={14} className="text-amber-500" />,
}

// ── Диалог выставления счёта ──────────────────────────────────────────────────
interface InvoiceDialogProps {
  lead: Deal
  onClose: () => void
  onConverted: (dealId: string) => void
}

function InvoiceDialog({ lead, onClose, onConverted }: InvoiceDialogProps) {
  const qc = useQueryClient()
  const [noInvoice, setNoInvoice] = useState(false)
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [installType, setInstallType] = useState('NONE')
  const [direction, setDirection] = useState<string>((lead.direction as string) || 'PRIVATE')
  const [glassSupply, setGlassSupply] = useState<string>((lead.glassSupply as string) || 'OURS')
  const [needPainting, setNeedPainting] = useState(lead.needPainting || false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = noInvoice || !!invoiceUrl

  const handleSubmit = async () => {
    if (!canSubmit) { setError('Прикрепите файл счёта или отметьте "Без счёта"'); return }
    setLoading(true)
    try {
      const res = await api.post(`/leads/${lead.id}/invoice`, {
        noInvoice, invoiceUrl: invoiceUrl || null,
        installType, direction, glassSupply, needPainting,
      })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
      onConverted(res.data.dealId)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Выставить счёт — #{lead.number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            После выставления счёта лид конвертируется в сделку. Укажите параметры заказа.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Направление</label>
              <select value={direction} onChange={e => setDirection(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1">
                <option value="PRIVATE">Частный заказ</option>
                <option value="DEALER">Дилерский заказ</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Тип монтажа</label>
              <select value={installType} onChange={e => setInstallType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1">
                <option value="NONE">Без монтажа</option>
                <option value="SINGLE">Монтаж в один этап</option>
                <option value="TWO_STAGE">Монтаж в два этапа</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Поставка стекла</label>
              <select value={glassSupply} onChange={e => setGlassSupply(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1">
                <option value="OURS">Наше стекло</option>
                <option value="CLIENT">Стекло заказчика</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={needPainting} onChange={e => setNeedPainting(e.target.checked)} />
              Нужна покраска
            </label>
          </div>

          <div className="border-t pt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={noInvoice} onChange={e => setNoInvoice(e.target.checked)} />
              Без счёта (устная договорённость)
            </label>
            {!noInvoice && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Файл счёта <span className="text-destructive">*</span>
                </label>
                {invoiceUrl ? (
                  <div className="flex items-center gap-2 text-sm text-green-500">
                    <CheckCircle2 size={14} />Файл загружен
                    <button onClick={() => setInvoiceUrl('')} className="text-xs text-muted-foreground hover:text-destructive">удалить</button>
                  </div>
                ) : (
                  <FileUpload
                    endpoint={`/deals/${lead.id}/upload?type=INVOICE`}
                    accept=".pdf,.jpg,.jpeg,.png"
                    label=""
                    onUploaded={(f) => setInvoiceUrl(f.url)}
                  />
                )}
                {!invoiceUrl && (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertCircle size={12} />Загрузите файл счёта или отметьте «Без счёта»
                  </p>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Отмена</Button>
            <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
              {loading ? 'Выставляю...' : 'Выставить счёт'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Основной компонент ────────────────────────────────────────────────────────
interface Props { leadId: string; onBack: () => void }

export default function LeadDetail({ leadId, onBack }: Props) {
  const { data: lead, isLoading } = useLead(leadId)
  const changeStatus = useChangeLeadStatus(leadId)
  const addEvent = useAddLeadEvent(leadId)
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const updateLead = useUpdateDeal(leadId)

  const [comment, setComment] = useState('')
  const [callType, setCallType] = useState<'CALL_INBOUND' | 'CALL_OUTBOUND'>('CALL_INBOUND')
  const [modal, setModal] = useState<'reject' | 'call' | 'invoice' | 'contact' | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Загрузка...</div>
  if (!lead) return <div className="text-destructive p-4">Лид не найден</div>

  const canAct = lead.leadStatus !== 'CONVERTED' && lead.leadStatus !== 'REJECTED'
  const noContact = !lead.contact
  const leadAsDeal = lead as unknown as Deal

  async function handleComment() {
    if (!comment.trim()) return
    await addEvent.mutateAsync({ content: comment, type: 'COMMENT_ADDED' })
    setComment('')
  }

  async function handleCall() {
    await addEvent.mutateAsync({
      content: callType === 'CALL_INBOUND' ? 'Входящий звонок' : 'Исходящий звонок',
      type: callType,
    })
    setModal(null)
  }

  async function handleReject() {
    await changeStatus.mutateAsync({ status: 'REJECTED', rejectReason })
    setModal(null)
  }

  return (
    <div className="space-y-4">
      {/* Шапка */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} className="mr-1" />Назад</Button>
        <span className="font-mono font-semibold text-muted-foreground">#{lead.number}</span>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[lead.leadStatus]}`}>
          {STATUS_LABELS[lead.leadStatus]}
        </span>
        {noContact && (
          <span className="flex items-center gap-1 text-xs text-amber-400 font-medium bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-full">
            <AlertCircle size={12} />Нет контакта — укажите перед выставлением счёта
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Задачи — вверху */}
          <TasksBlock dealId={leadId} />

          {/* Информация */}
          <div className="border rounded-lg p-4 space-y-2 text-sm">
            <h3 className="font-medium">Информация</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="text-muted-foreground">Контакт</div>
              <div className="flex items-center gap-2">
                {lead.contact
                  ? <span>{lead.contact.lastName} {lead.contact.firstName} · {lead.contact.phone}</span>
                  : <span className="text-amber-400 italic">Не указан</span>}
                {canAct && (
                  <button onClick={() => setModal('contact')} className="text-xs text-primary hover:underline">
                    {noContact ? 'добавить' : 'сменить'}
                  </button>
                )}
              </div>
              {lead.company && <><div className="text-muted-foreground">Компания</div><div>{lead.company.name}</div></>}
              <div className="text-muted-foreground">Ответственный</div>
              <div>{lead.assignee.lastName} {lead.assignee.firstName}</div>
              <div className="text-muted-foreground">Создан</div>
              <div>{format(new Date(lead.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</div>
            </div>
            {lead.comment && <div className="mt-2 bg-muted rounded p-2 text-sm">{lead.comment}</div>}
          </div>

          {/* Состав заказа */}
          <DealItemsPanel deal={leadAsDeal} />

          {/* Таймлайн */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-sm">Комментарии и события</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lead.events.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 shrink-0">{EVENT_ICONS[ev.type] || <MessageSquare size={14} />}</div>
                  <div className="flex-1">
                    <span>{ev.content}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {format(new Date(ev.createdAt), 'dd.MM HH:mm', { locale: ru })}
                    </span>
                  </div>
                </div>
              ))}
              {lead.events.length === 0 && <div className="text-muted-foreground text-xs">Нет событий</div>}
            </div>
            {canAct && (
              <div className="flex gap-2 pt-2 border-t">
                <Input value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Добавить комментарий..."
                  onKeyDown={e => e.key === 'Enter' && handleComment()}
                  className="flex-1" />
                <Button size="sm" onClick={handleComment} disabled={!comment.trim()}>Добавить</Button>
                <Button size="sm" variant="outline" onClick={() => setModal('call')}><Phone size={14} /></Button>
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка */}
        <div className="space-y-3">
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-medium text-sm">Действия</h3>
            {lead.leadStatus === 'NEW' && (
              <Button className="w-full" size="sm" onClick={() => changeStatus.mutate({ status: 'IN_PROGRESS' })}>
                Взять в работу
              </Button>
            )}
            {lead.leadStatus === 'IN_PROGRESS' && (
              <Button className="w-full" size="sm"
                disabled={noContact}
                title={noContact ? 'Сначала укажите контакт' : ''}
                onClick={() => setModal('invoice')}>
                <ArrowRightCircle size={15} className="mr-1" />Выставить счёт
              </Button>
            )}
            {canAct && (
              <Button className="w-full" size="sm" variant="destructive" onClick={() => setModal('reject')}>
                <XCircle size={15} className="mr-1" />Отклонить
              </Button>
            )}
          </div>

          {/* Итого */}
          {leadAsDeal.items && leadAsDeal.items.length > 0 && (() => {
            const totalItems = leadAsDeal.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
            const totalServices = (leadAsDeal.services || []).reduce((s, sv) => s + sv.quantity * Number(sv.unitPrice), 0)
            const total = totalItems + totalServices
            return (
              <div className="border rounded-lg p-4 space-y-2 text-sm">
                <h3 className="font-medium">Итого</h3>
                <div className="flex justify-between"><span className="text-muted-foreground">Товары</span><span>{totalItems.toLocaleString('ru-RU')} ₽</span></div>
                {totalServices > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Услуги</span><span>{totalServices.toLocaleString('ru-RU')} ₽</span></div>}
                <div className="flex justify-between font-semibold border-t pt-2"><span>Итого</span><span>{total.toLocaleString('ru-RU')} ₽</span></div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Модалки */}
      {modal === 'call' && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Зафиксировать звонок</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant={callType === 'CALL_INBOUND' ? 'default' : 'outline'} onClick={() => setCallType('CALL_INBOUND')}>Входящий</Button>
                <Button size="sm" variant={callType === 'CALL_OUTBOUND' ? 'default' : 'outline'} onClick={() => setCallType('CALL_OUTBOUND')}>Исходящий</Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModal(null)}>Отмена</Button>
                <Button onClick={handleCall}>Сохранить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {modal === 'reject' && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Отклонить лид</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Причина</label>
                <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Укажите причину..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModal(null)}>Отмена</Button>
                <Button variant="destructive" onClick={handleReject}>Отклонить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {modal === 'contact' && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{noContact ? 'Добавить контакт' : 'Сменить контакт'}</DialogTitle></DialogHeader>
            <ContactPicker
              value={lead.contact?.id || ''}
              onChange={async (id) => {
                await updateLead.mutateAsync({ contactId: id } as never)
                setModal(null)
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {modal === 'invoice' && (
        <InvoiceDialog
          lead={leadAsDeal}
          onClose={() => setModal(null)}
          onConverted={() => { setModal(null); onBack() }}
        />
      )}
    </div>
  )
}
