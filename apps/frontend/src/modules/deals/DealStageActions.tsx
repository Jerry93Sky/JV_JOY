import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useDealAction, useUpdateDeal, type Deal, DealStage, PaymentStatus, FailReason, GlassSupply, InstallType } from '@/api/deals'
import FileUpload from '@/components/FileUpload'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { differenceInDays } from 'date-fns'
import api from '@/api/client'
import InstallKitDialog from './InstallKitDialog'

const FAIL_REASONS = [
  { value: FailReason.PRICE, label: 'Отказ из-за цены' },
  { value: FailReason.TECHNICAL, label: 'Техническая невозможность' },
  { value: FailReason.COMPETITOR, label: 'Конкурент предложил лучше' },
  { value: FailReason.STOCK_SHORTAGE, label: 'Недостаток комплектующих' },
]

interface Props { deal: Deal }

export default function DealStageActions({ deal }: Props) {
  const action = useDealAction(deal.id)
  const updateDeal = useUpdateDeal(deal.id)
  const qc = useQueryClient()
  const [modal, setModal] = useState<string | null>(null)
  const [installKitStage, setInstallKitStage] = useState<'first' | 'second'>('first')

  // Оплата
  const [paymentType, setPaymentType] = useState<'FULL' | 'PARTIAL'>('FULL')
  const [paidAmount, setPaidAmount] = useState('')
  const [isOfficial, setIsOfficial] = useState(false)

  // Покраска
  const [paintingVendorId, setPaintingVendorId] = useState('')
  const [paintingCost, setPaintingCost] = useState('')
  const [profileRows, setProfileRows] = useState<{ name: string; length: string; qty: string }[]>([
    { name: '', length: '', qty: '1' }
  ])

  // Загружаем покрасочные компании
  const { data: paintingVendors = [] } = useQuery({
    queryKey: ['vendors', { isPainting: true }],
    queryFn: () => api.get('/vendors', { params: { isPainting: true } }).then(r => r.data),
  })

  // Стекло
  const [glassCost, setGlassCost] = useState('')
  const [glassSupplier, setGlassSupplier] = useState('')
  const [glassExpectedDate, setGlassExpectedDate] = useState('')
  const [glassComment, setGlassComment] = useState('')

  // Провал
  const [failReason, setFailReason] = useState<FailReason>(FailReason.PRICE)

  const s = deal.stage

  // Предупреждение о просроченном счёте (5 дней)
  const invoiceOverdue = deal.invoiceSentAt && deal.paymentStatus !== PaymentStatus.FULL
    ? differenceInDays(new Date(), new Date(deal.invoiceSentAt)) >= 5
    : false

  async function run(act: string, body?: object) {
    await action.mutateAsync({ action: act, body })
    setModal(null)
  }

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <h3 className="font-medium text-sm mb-3">Действия</h3>

      {/* Предупреждение о просроченном счёте */}
      {invoiceOverdue && s === DealStage.INVOICE_SENT && (
        <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400 mb-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          Счёт не оплачен более 5 дней. Свяжитесь с клиентом повторно.
        </div>
      )}

      {/* Таймер на этапе INVOICE_SENT */}
      {s === DealStage.INVOICE_SENT && deal.invoiceSentAt && !invoiceOverdue && (() => {
        const daysLeft = 5 - differenceInDays(new Date(), new Date(deal.invoiceSentAt))
        return (
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs text-muted-foreground mb-2">
            <Clock size={12} />
            До истечения срока оплаты: {daysLeft} дн.
          </div>
        )
      })()}

      {/* Доплата — всегда видна при частичной оплате */}
      {deal.paymentStatus === PaymentStatus.PARTIAL && (
        <Button className="w-full" size="sm" variant="outline" onClick={() => setModal('payment')}>
          Принять доплату
        </Button>
      )}

      {/* 2.1 INVOICE_SENT → Оплата */}
      {s === DealStage.INVOICE_SENT && (
        <Button className="w-full" size="sm" onClick={() => setModal('payment')}>
          Оплата
        </Button>
      )}

      {/* 2.2 PAID → Сформировать разблюдовку */}
      {s === DealStage.PAID && (
        <Button className="w-full" size="sm" onClick={() => run('assemble')}>
          Сформировать разблюдовку
        </Button>
      )}

      {/* Открыть разблюдовку — доступна с этапа ASSEMBLY */}
      {[DealStage.ASSEMBLY, DealStage.PAINTING, DealStage.INSTALL_FIRST, DealStage.INSTALL_SECOND, DealStage.SHIPMENT, DealStage.DOCS, DealStage.COMPLETED].includes(s) && (
        <a href={`/api/deals/${deal.id}/assembly-sheet`} target="_blank" rel="noreferrer"
          className="flex items-center justify-center w-full h-8 px-3 text-sm rounded-md border border-input hover:bg-muted transition-colors gap-1">
          📋 Открыть разблюдовку
        </a>
      )}

      {/* 2.3 ASSEMBLY → Покраска или Отгрузка */}
      {s === DealStage.ASSEMBLY && deal.needPainting && (
        <Button className="w-full" size="sm" onClick={() => setModal('painting')}>
          Накладная на покраску
        </Button>
      )}
      {s === DealStage.ASSEMBLY && !deal.needPainting && (
        <Button className="w-full" size="sm" onClick={() => setModal('shipment-doc')}>
          Отгрузка
        </Button>
      )}

      {/* Ссылка на накладную покраски */}
      {[DealStage.PAINTING, DealStage.INSTALL_FIRST, DealStage.INSTALL_SECOND, DealStage.SHIPMENT, DealStage.DOCS, DealStage.COMPLETED].includes(s) && deal.needPainting && (
        <a href={`/api/deals/${deal.id}/painting-note`} target="_blank" rel="noreferrer"
          className="flex items-center justify-center w-full h-8 px-3 text-sm rounded-md border border-input hover:bg-muted transition-colors gap-1">
          🎨 Накладная на покраску
        </a>
      )}

      {/* Монтаж 1 — если тип монтажа задан */}
      {s === DealStage.ASSEMBLY && deal.installType && deal.installType !== InstallType.NONE && (
        <Button className="w-full" size="sm" variant="outline" onClick={() => run('install-1')}>
          Монтаж 1-й этап
        </Button>
      )}

      {/* 2.4 PAINTING → Пришёл с покраски */}
      {s === DealStage.PAINTING && (
        <Button className="w-full" size="sm" onClick={() => run('painting-done')}>
          Заказ пришёл с покраски
        </Button>
      )}

      {/* Заказ стекла — доступен на нескольких этапах */}
      {deal.glassSupply === GlassSupply.OURS && deal.glassOrderStatus === 'NOT_STARTED' &&
        [DealStage.ASSEMBLY, DealStage.PAINTING, DealStage.INSTALL_FIRST].includes(s) && (
        <Button className="w-full" size="sm" variant="outline" onClick={() => setModal('glass')}>
          Заказать стекло
        </Button>
      )}
      {deal.glassOrderStatus === 'IN_PROGRESS' && (
        <Button className="w-full" size="sm" variant="outline" onClick={() => run('glass-done')}>
          <CheckCircle2 size={14} className="mr-1" />Стекло получено
        </Button>
      )}

      {/* 2.5 INSTALL_FIRST */}
      {s === DealStage.INSTALL_FIRST && (
        <>
          <Button className="w-full" size="sm" variant="outline"
            onClick={() => { setInstallKitStage('first'); setModal('install-kit') }}>
            Скомплектовать на монтаж
          </Button>
          {deal.installType === InstallType.TWO_STAGE && (
            <Button className="w-full" size="sm" onClick={() => run('install-2')}>
              Монтаж 2-й этап
            </Button>
          )}
          {deal.installType !== InstallType.TWO_STAGE && (
            <Button className="w-full" size="sm" onClick={() => run('ship')}>
              Завершение монтажа
            </Button>
          )}
        </>
      )}

      {/* 2.6 INSTALL_SECOND */}
      {s === DealStage.INSTALL_SECOND && (
        <>
          <Button className="w-full" size="sm" variant="outline"
            onClick={() => { setInstallKitStage('second'); setModal('install-kit') }}>
            Скомплектовать на монтаж 2
          </Button>
          <Button className="w-full" size="sm" onClick={() => run('ship')}>
            Завершение монтажа
          </Button>
        </>
      )}

      {/* 3.1 SHIPMENT → Документы */}
      {s === DealStage.SHIPMENT && (
        <Button className="w-full" size="sm"
          disabled={deal.paymentStatus !== PaymentStatus.FULL}
          title={deal.paymentStatus !== PaymentStatus.FULL ? 'Необходима полная оплата' : ''}
          onClick={() => run('docs')}>
          Подписание документов
        </Button>
      )}
      {s === DealStage.SHIPMENT && deal.paymentStatus !== PaymentStatus.FULL && (
        <div className="flex items-center gap-1 text-xs text-amber-400">
          <AlertTriangle size={12} />Требуется полная оплата для перехода к документам
        </div>
      )}

      {/* 3.2 DOCS → Завершить */}
      {s === DealStage.DOCS && (
        <Button className="w-full" size="sm" onClick={() => run('complete')}>
          <CheckCircle2 size={14} className="mr-1" />Завершить заказ
        </Button>
      )}

      {/* Провал — до оплаты */}
      {[DealStage.INVOICE_SENT].includes(s) && (
        <Button className="w-full" size="sm" variant="destructive" onClick={() => setModal('fail')}>
          Отменить заказ
        </Button>
      )}

      {/* ── Модальные окна ─────────────────────────────────────────────────── */}

      {modal === 'payment' && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{deal.paymentStatus === PaymentStatus.PARTIAL ? 'Принять доплату' : 'Оплата'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant={paymentType === 'FULL' ? 'default' : 'outline'} onClick={() => setPaymentType('FULL')}>
                  {deal.paymentStatus === PaymentStatus.PARTIAL ? 'Полная доплата' : 'Полная оплата'}
                </Button>
                <Button size="sm" variant={paymentType === 'PARTIAL' ? 'default' : 'outline'} onClick={() => setPaymentType('PARTIAL')}>Частичная</Button>
              </div>
              {paymentType === 'PARTIAL' && (
                <div>
                  <label className="text-xs text-muted-foreground">Сумма ₽</label>
                  <Input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isOfficial} onChange={e => setIsOfficial(e.target.checked)} />
                Официальная оплата
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModal(null)}>Отмена</Button>
                <Button onClick={() => run('payment', {
                  paymentStatus: paymentType,
                  paidAmount: paymentType === 'PARTIAL' ? parseFloat(paidAmount) : undefined,
                  isOfficialPayment: isOfficial,
                })}>Подтвердить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {modal === 'painting' && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Накладная на покраску</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Покрасочная компания</label>
                <select value={paintingVendorId} onChange={e => setPaintingVendorId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1">
                  <option value="">— выбрать —</option>
                  {(paintingVendors as { id: string; name: string }[]).map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {paintingVendors.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Нет покрасочных компаний. Добавьте в разделе «Поставщики».
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Стоимость покраски ₽</label>
                <Input type="number" value={paintingCost} onChange={e => setPaintingCost(e.target.value)} className="mt-1" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Профили на покраску</label>
                  <button onClick={() => setProfileRows(r => [...r, { name: '', length: '', qty: '1' }])}
                    className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus size={12} />добавить строку
                  </button>
                </div>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Наименование</th>
                        <th className="text-center p-2 w-24">Длина (мм)</th>
                        <th className="text-center p-2 w-16">Кол-во</th>
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {profileRows.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-1">
                            <Input value={row.name} onChange={e => setProfileRows(r => r.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                              placeholder="Профиль створочный..." className="h-7 text-xs" />
                          </td>
                          <td className="p-1">
                            <Input type="number" value={row.length} onChange={e => setProfileRows(r => r.map((x, j) => j === i ? { ...x, length: e.target.value } : x))}
                              placeholder="2400" className="h-7 text-xs text-center" />
                          </td>
                          <td className="p-1">
                            <Input type="number" value={row.qty} onChange={e => setProfileRows(r => r.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                              className="h-7 text-xs text-center" />
                          </td>
                          <td className="p-1 text-center">
                            <button onClick={() => setProfileRows(r => r.filter((_, j) => j !== i))}
                              className="hover:text-destructive"><Trash2 size={12} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModal(null)}>Отмена</Button>
                <Button onClick={() => {
                  const vendorName = (paintingVendors as { id: string; name: string }[]).find(v => v.id === paintingVendorId)?.name || paintingVendorId
                  run('painting', {
                    paintingCompany: vendorName,
                    paintingCost: paintingCost ? parseFloat(paintingCost) : undefined,
                    profileRows: profileRows.filter(r => r.name),
                  })
                }}>Отправить в покраску</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {modal === 'shipment-doc' && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Отгрузка</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {deal.paymentType === 'BANK' && (
                <FileUpload
                  endpoint={`/deals/${deal.id}/upload?type=SHIPMENT_DOC`}
                  accept=".pdf,.jpg,.jpeg,.png"
                  label="Документы на отгрузку"
                  onUploaded={() => { qc.invalidateQueries({ queryKey: ['deals', deal.id] }) }}
                />
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModal(null)}>Отмена</Button>
                <Button onClick={() => run('ship')}>Подтвердить отгрузку</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {modal === 'glass' && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Заказ стекла</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <FileUpload
                endpoint={`/deals/${deal.id}/upload?type=GLASS_DRAWING`}
                accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
                label="Чертежи стёкол"
                onUploaded={() => qc.invalidateQueries({ queryKey: ['deals', deal.id] })}
              />
              <div>
                <label className="text-xs text-muted-foreground">Поставщик стекла</label>
                <Input value={glassSupplier} onChange={e => setGlassSupplier(e.target.value)} placeholder="Название компании" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Закупочная стоимость ₽ *</label>
                <Input type="number" value={glassCost} onChange={e => setGlassCost(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ожидаемая дата получения</label>
                <Input type="date" value={glassExpectedDate} onChange={e => setGlassExpectedDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Комментарий</label>
                <Input value={glassComment} onChange={e => setGlassComment(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModal(null)}>Отмена</Button>
                <Button disabled={!glassCost} onClick={() => run('glass-order', {
                  glassCostPrice: parseFloat(glassCost),
                  glassSupplier: glassSupplier || undefined,
                  glassExpectedDate: glassExpectedDate || undefined,
                  glassComment: glassComment || undefined,
                })}>Заказать</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {modal === 'fail' && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Отменить заказ</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Причина</label>
                <select value={failReason} onChange={e => setFailReason(e.target.value as FailReason)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {FAIL_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModal(null)}>Отмена</Button>
                <Button variant="destructive" onClick={() => run('fail', { failReason })}>Отменить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {modal === 'install-kit' && (
        <InstallKitDialog
          deal={deal}
          stage={installKitStage}
          onClose={() => setModal(null)}
          onDone={() => setModal(null)}
        />
      )}
    </div>
  )
}
