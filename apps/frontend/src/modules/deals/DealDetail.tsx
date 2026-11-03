import { useState } from 'react'
import { ArrowLeft, AlertTriangle, CheckCircle2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDeal, useUpdateDeal, DealStage, PaymentStatus, GlassSupply, Direction } from '@/api/deals'
import { STAGE_LABELS, STAGE_COLORS } from '@/pages/DealsPage'
import DealStageActions from './DealStageActions'
import DealItemsPanel from './DealItemsPanel'
import DealTimeline from './DealTimeline'
import DealFilesPanel from './DealFilesPanel'
import TasksBlock from './TasksBlock'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useUsers } from '@/api/settings'
import { useCompanies } from '@/api/companies'
import ContactPicker from '@/components/ContactPicker'
import EntityLink from '@/components/EntityLink'

function ChangeAssigneeButton({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false)
  const { data: users = [] } = useUsers()
  const update = useUpdateDeal(dealId)
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs text-primary hover:underline">сменить</button>
      {open && (
        <Dialog open onOpenChange={() => setOpen(false)}>
          <DialogContent className="max-w-xs">
            <DialogHeader><DialogTitle>Сменить ответственного</DialogTitle></DialogHeader>
            <div className="space-y-1">
              {users.map(u => (
                <button key={u.id} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm"
                  onClick={async () => { await update.mutateAsync({ assigneeId: u.id } as never); setOpen(false) }}>
                  {u.lastName} {u.firstName}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

interface Props { dealId: string; onBack: () => void }

export default function DealDetail({ dealId, onBack }: Props) {
  const { data: deal, isLoading } = useDeal(dealId)
  const update = useUpdateDeal(dealId)
  const { data: companies = [] } = useCompanies()
  const [editingContact, setEditingContact] = useState(false)
  const [editingParams, setEditingParams] = useState(false)
  const [paramsForm, setParamsForm] = useState({ glassSupply: '', needPainting: false, paintAllOneColor: true, companyId: '' })
  const [discountModal, setDiscountModal] = useState(false)
  const [discountVal, setDiscountVal] = useState('')

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Загрузка...</div>
  if (!deal) return <div className="text-destructive p-4">Сделка не найдена</div>

  const totalItems = deal.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
  const totalServices = deal.services.reduce((s, sv) => s + sv.quantity * Number(sv.unitPrice), 0)
  const subtotal = totalItems + totalServices
  const agentFee = deal.isAgentOrder && deal.agentPercent ? subtotal * (Number(deal.agentPercent) / 100) : 0
  const manualDiscount = deal.direction === Direction.PRIVATE && deal.manualDiscountPct
    ? subtotal * (Number(deal.manualDiscountPct) / 100)
    : 0
  const total = subtotal + agentFee - manualDiscount

  const remainingToPay = deal!.paymentStatus === PaymentStatus.PARTIAL && deal!.paidAmount
    ? total - Number(deal!.paidAmount) : 0

  const canEditParams = !['PAID', 'ASSEMBLY', 'PAINTING', 'INSTALL_FIRST',
    'INSTALL_SECOND', 'SHIPMENT', 'DOCS', 'COMPLETED', 'FAILED'].includes(deal!.stage)

  function openEditParams() {
    setParamsForm({ glassSupply: deal!.glassSupply, needPainting: deal!.needPainting, paintAllOneColor: deal!.paintAllOneColor, companyId: deal!.company?.id || '' })
    setEditingParams(true)
  }

  async function saveParams() {
    await update.mutateAsync({
      glassSupply: paramsForm.glassSupply as GlassSupply,
      needPainting: paramsForm.needPainting,
      paintAllOneColor: paramsForm.paintAllOneColor,
      companyId: paramsForm.companyId || undefined,
    } as never)
    setEditingParams(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} className="mr-1" />Назад</Button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-semibold text-muted-foreground">#{deal.number}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STAGE_COLORS[deal.stage] || ''}`}>{STAGE_LABELS[deal.stage]}</span>
          {deal.paintingOverdue && (
            <span className="flex items-center gap-1 text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/30 px-2 py-1 rounded-full">
              <AlertTriangle size={12} />Покраска просрочена
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Задачи — вверху */}
          <TasksBlock dealId={deal.id} />

          {/* Основная информация */}
          <div className="border rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Информация о заявке</h3>
              {canEditParams && (
                <Button variant="ghost" size="sm" onClick={openEditParams}><Pencil size={13} className="mr-1" />Изменить</Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="text-muted-foreground">Контакт</div>
              <div className="flex items-center gap-2">
                {deal.contact
                  ? <EntityLink type="contact" id={deal.contact.id} label={`${deal.contact.lastName} ${deal.contact.firstName} · ${deal.contact.phone}`} />
                  : <span className="text-amber-400 italic text-sm">Не указан</span>}
                {canEditParams && (
                  <button onClick={() => setEditingContact(true)} className="text-xs text-primary hover:underline">
                    {deal.contact ? 'сменить' : 'добавить'}
                  </button>
                )}
              </div>
              {deal.company && <><div className="text-muted-foreground">Компания</div>
              <EntityLink type="company" id={deal.company.id} label={deal.company.name} className="font-medium" /></>}
              <div className="text-muted-foreground">Направление</div>
              <div>{deal.direction === 'DEALER' ? 'Дилерский' : 'Частный'}</div>
              <div className="text-muted-foreground">Ответственный</div>
              <div className="flex items-center gap-2">
                {deal.assignee.lastName} {deal.assignee.firstName}
                <ChangeAssigneeButton dealId={deal.id} />
              </div>
              <div className="text-muted-foreground">Создатель</div>
              <div>{deal.creator.lastName} {deal.creator.firstName}</div>
              <div className="text-muted-foreground">Стекло</div>
              <div>{deal.glassSupply === GlassSupply.OURS ? 'Наше' : 'Заказчика'}</div>
              <div className="text-muted-foreground">Покраска</div>
              <div>{deal.needPainting ? (deal.paintAllOneColor ? 'Да, один цвет' : 'Да, разные цвета') : 'Нет'}</div>
              {deal.installType && <><div className="text-muted-foreground">Монтаж</div>
              <div>{{ NONE: 'Без монтажа', SINGLE: 'Один этап', TWO_STAGE: 'Два этапа' }[deal.installType] || deal.installType}</div></>}
              {deal.invoiceSentAt && <><div className="text-muted-foreground">Счёт выставлен</div><div>{format(new Date(deal.invoiceSentAt), 'dd.MM.yyyy', { locale: ru })}</div></>}
              {deal.paidAt && <><div className="text-muted-foreground">Дата оплаты</div><div>{format(new Date(deal.paidAt), 'dd.MM.yyyy', { locale: ru })}</div></>}
              {deal.paintingCompany && <><div className="text-muted-foreground">Покрасочная</div><div>{deal.paintingCompany}</div></>}
              {deal.paintingSentAt && <><div className="text-muted-foreground">Отправлено в покраску</div><div>{format(new Date(deal.paintingSentAt), 'dd.MM.yyyy', { locale: ru })}</div></>}
              {deal.isAgentOrder && <><div className="text-muted-foreground">Агентский %</div><div>{deal.agentPercent}%</div></>}
            </div>
            {deal.comment && <div className="mt-2 text-sm bg-muted rounded p-2">{deal.comment}</div>}
          </div>

          {/* Параллельный процесс: заказ стекла */}
          {deal.glassSupply === GlassSupply.OURS && deal.stage !== DealStage.APPLICATION && deal.stage !== DealStage.IN_PROGRESS && (
            <div className={`border rounded-lg p-3 text-sm ${
              deal.glassOrderStatus === 'COMPLETED'
                ? 'border-green-500/30 bg-green-500/10 text-green-300'
                : deal.glassOrderStatus === 'IN_PROGRESS'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}>
              <div className="flex items-center gap-2 font-medium mb-1">
                {deal.glassOrderStatus === 'COMPLETED' ? <CheckCircle2 size={15} className="text-green-600" /> : <AlertTriangle size={15} className="text-amber-500" />}
                Заказ стекла
              </div>
              {deal.glassOrderStatus === 'NOT_STARTED' && (
                <div className="text-amber-300 text-xs">Стекло ещё не заказано</div>
              )}
              {deal.glassOrderStatus === 'IN_PROGRESS' && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mt-1">
                  {(deal as never as { glassSupplier?: string }).glassSupplier && (
                    <><span className="text-muted-foreground">Поставщик</span><span>{(deal as never as { glassSupplier?: string }).glassSupplier}</span></>
                  )}
                  <span className="text-muted-foreground">Стоимость закупки</span>
                  <span className="font-medium">{Number(deal.glassCostPrice || 0).toLocaleString('ru-RU')} ₽</span>
                  {(deal as never as { glassOrderDate?: string }).glassOrderDate && (
                    <><span className="text-muted-foreground">Дата заказа</span><span>{format(new Date((deal as never as { glassOrderDate: string }).glassOrderDate), 'dd.MM.yyyy', { locale: ru })}</span></>
                  )}
                  {(deal as never as { glassExpectedDate?: string }).glassExpectedDate && (
                    <><span className="text-muted-foreground">Ожидается</span><span>{format(new Date((deal as never as { glassExpectedDate: string }).glassExpectedDate), 'dd.MM.yyyy', { locale: ru })}</span></>
                  )}
                  {(deal as never as { glassComment?: string }).glassComment && (
                    <><span className="text-muted-foreground">Комментарий</span><span>{(deal as never as { glassComment?: string }).glassComment}</span></>
                  )}
                </div>
              )}
              {deal.glassOrderStatus === 'COMPLETED' && (
                <div className="text-green-400 text-xs">Стекло получено · {Number(deal.glassCostPrice || 0).toLocaleString('ru-RU')} ₽</div>
              )}
            </div>
          )}

          <DealItemsPanel deal={deal} />
          <DealTimeline dealId={deal.id} events={(deal as never as { dealEvents: { id: string; type: string; content?: string; userId?: string; createdAt: string }[] }).dealEvents || []} />

          {/* Файлы сделки */}
          <DealFilesPanel deal={deal} />
        </div>

        {/* Правая колонка */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-2 text-sm">
            <h3 className="font-medium">Итого</h3>
            <div className="flex justify-between"><span className="text-muted-foreground">Товары</span><span>{totalItems.toLocaleString('ru-RU')} ₽</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Услуги</span><span>{totalServices.toLocaleString('ru-RU')} ₽</span></div>
            {agentFee > 0 && <div className="flex justify-between text-amber-600"><span>Агентское</span><span>+{agentFee.toLocaleString('ru-RU')} ₽</span></div>}
            {manualDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Скидка {deal.manualDiscountPct}%</span>
                <span>−{manualDiscount.toLocaleString('ru-RU')} ₽</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2"><span>Итого</span><span>{total.toLocaleString('ru-RU')} ₽</span></div>
            {deal.paymentStatus === PaymentStatus.PARTIAL && (
              <div className="flex justify-between text-destructive font-medium"><span>К доплате</span><span>{remainingToPay.toLocaleString('ru-RU')} ₽</span></div>
            )}
            {deal.paymentStatus === PaymentStatus.FULL && (
              <div className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 size={14} />Оплачен полностью</div>
            )}
            {deal.direction === Direction.PRIVATE && canEditParams && (
              <button onClick={() => { setDiscountVal(String(deal.manualDiscountPct || '')); setDiscountModal(true) }}
                className="text-xs text-primary hover:underline w-full text-left">
                {deal.manualDiscountPct ? `Скидка: ${deal.manualDiscountPct}%` : '+ Добавить скидку'}
              </button>
            )}
            {/* Справочная дилерская цена для частных заказов */}
            {deal.direction === Direction.PRIVATE && (() => {
              // Справочная оптовая стоимость: все комплектующие (и системные и отдельные)
              // исключаем услуги, стекло (glass_cost) и покраску
              const EXCLUDE_VARS = ['glass_cost', 'glass_type']
              const wholesaleTotal = deal.items
                .filter(i => {
                  // Исключаем позиции стекла по названию
                  const name = i.product.name.toLowerCase()
                  return !name.includes('стекл') && !name.includes('активатор') && !name.includes('клей')
                })
                .reduce((s, i) => {
                  const wp = (i.product as never as { priceWholesale?: number })?.priceWholesale
                  return s + Number(i.quantity) * Number(wp ?? i.unitPrice)
                }, 0)
              if (wholesaleTotal === 0) return null
              return (
                <div className="border-t pt-2 mt-1">
                  <div className="text-xs text-muted-foreground">Справочно: комплектующие по опт. цене (без стекла, сборки, покраски)</div>
                  <div className="text-xs font-semibold text-blue-600">{wholesaleTotal.toLocaleString('ru-RU')} ₽</div>
                </div>
              )
            })()}
          </div>

          {/* КП файлы */}
          {deal.proposals.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-sm">Коммерческие предложения</h3>
              {deal.proposals.map(p => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline">
                  КП v{p.version} · {format(new Date(p.createdAt), 'dd.MM.yyyy', { locale: ru })}
                </a>
              ))}
            </div>
          )}

          <DealStageActions deal={deal} />
        </div>
      </div>

      {/* Смена контакта */}
      {editingContact && (
        <Dialog open onOpenChange={() => setEditingContact(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Сменить контакт</DialogTitle></DialogHeader>
            <ContactPicker value={deal.contactId} onChange={async (id) => { await update.mutateAsync({ contactId: id } as never); setEditingContact(false) }} />
          </DialogContent>
        </Dialog>
      )}

      {/* Редактирование параметров */}
      {editingParams && (
        <Dialog open onOpenChange={() => setEditingParams(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Параметры заявки</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Компания</label>
                <select value={paramsForm.companyId} onChange={e => setParamsForm(f => ({ ...f, companyId: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">Не указана</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Поставка стекла</label>
                <select value={paramsForm.glassSupply} onChange={e => setParamsForm(f => ({ ...f, glassSupply: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="OURS">Наше</option>
                  <option value="CLIENT">Заказчика</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={paramsForm.needPainting} onChange={e => setParamsForm(f => ({ ...f, needPainting: e.target.checked }))} />
                Нужна покраска
              </label>
              {paramsForm.needPainting && (
                <label className="flex items-center gap-2 text-sm cursor-pointer ml-4">
                  <input type="checkbox" checked={paramsForm.paintAllOneColor} onChange={e => setParamsForm(f => ({ ...f, paintAllOneColor: e.target.checked }))} />
                  Все в один цвет
                </label>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingParams(false)}>Отмена</Button>
                <Button onClick={saveParams}>Сохранить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Ручная скидка */}
      {discountModal && (
        <Dialog open onOpenChange={() => setDiscountModal(false)}>
          <DialogContent className="max-w-xs">
            <DialogHeader><DialogTitle>Скидка для заказа</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Скидка % (0 — без скидки)</label>
                <Input type="number" step="0.1" min="0" max="100" value={discountVal} onChange={e => setDiscountVal(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDiscountModal(false)}>Отмена</Button>
                <Button onClick={async () => {
                  await update.mutateAsync({ manualDiscountPct: discountVal ? parseFloat(discountVal) : null } as never)
                  setDiscountModal(false)
                }}>Применить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
