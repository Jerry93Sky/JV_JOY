import { useState } from 'react'
import { Plus, Trash2, AlertTriangle, Layers, Pencil, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type Deal, DealStage, useAddDealItem, useRemoveDealItem, useAddDealService, useRemoveDealService, useDeleteDealSystem, useUpdateItemPaint, useUpdateDealItem, type DealSystemEntry, type DealItem } from '@/api/deals'
import { useProducts } from '@/api/warehouse'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'
import AddSystemDialog from './AddSystemDialog'
import RalColorPicker from '@/components/RalColorPicker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RAL_COLORS } from '@/lib/ral'

// Ячейка с редактируемой ценой/кол-вом и подсказкой при наведении
function EditableCell({ value, calcValue, overridden, onSave, suffix = '₽', type = 'price' }:
  { value: number; calcValue?: number; overridden: boolean; onSave: (v: number) => void; suffix?: string; type?: 'price' | 'qty' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  const handleBlur = () => {
    const v = parseFloat(draft)
    if (!isNaN(v) && v !== value) onSave(v)
    setEditing(false)
  }

  if (editing) {
    return (
      <Input type="number" value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur} onKeyDown={e => { if (e.key === 'Enter') handleBlur(); if (e.key === 'Escape') setEditing(false) }}
        className="h-6 w-24 text-right text-xs px-1" autoFocus />
    )
  }

  return (
    <span className="relative group cursor-pointer" onClick={() => { setDraft(String(value)); setEditing(true) }}>
      <span className={`${overridden ? 'text-amber-400 underline decoration-dotted' : ''}`}>
        {type === 'price' ? value.toLocaleString('ru-RU') : value} {suffix}
      </span>
      {overridden && calcValue !== undefined && (
        <span className="absolute bottom-full right-0 mb-1 hidden group-hover:block z-10 bg-popover border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
          Расчётное: {type === 'price' ? calcValue.toLocaleString('ru-RU') : calcValue} {suffix}
        </span>
      )}
      {!overridden && (
        <span className="absolute bottom-full right-0 mb-1 hidden group-hover:block z-10 bg-popover border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg text-muted-foreground">
          Нажмите для редактирования
        </span>
      )}
    </span>
  )
}

interface Props { deal: Deal }

export default function DealItemsPanel({ deal }: Props) {
  const { data: products = [] } = useProducts()
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: () => api.get('/settings/services').then(r => r.data) })
  const addItem = useAddDealItem(deal.id)
  const removeItem = useRemoveDealItem(deal.id)
  const updateItem = useUpdateDealItem(deal.id)
  const addService = useAddDealService(deal.id)
  const removeService = useRemoveDealService(deal.id)
  const deleteDealSystem = useDeleteDealSystem(deal.id)
  const updatePaint = useUpdateItemPaint(deal.id)

  const [addingItem, setAddingItem] = useState(false)
  const [addingSystem, setAddingSystem] = useState(false)
  const [editingSystem, setEditingSystem] = useState<DealSystemEntry | null>(null)
  const [colorPickerItem, setColorPickerItem] = useState<string | null>(null)
  const [expandedSystems, setExpandedSystems] = useState<Record<string, boolean>>({})
  const [newProductId, setNewProductId] = useState('')
  const [newQty, setNewQty] = useState('1')
  const [newPrice, setNewPrice] = useState('')
  const [addingSvc, setAddingSvc] = useState(false)
  const [newSvcId, setNewSvcId] = useState('')
  const [newSvcPrice, setNewSvcPrice] = useState('')

  // Редактирование разрешено до этапа PAID (включительно для лидов и до оплаты для сделок)
  const canEdit = ![DealStage.ASSEMBLY, DealStage.PAINTING, DealStage.INSTALL_FIRST,
    DealStage.INSTALL_SECOND, DealStage.SHIPMENT, DealStage.DOCS, DealStage.COMPLETED, DealStage.FAILED].includes(deal.stage)

  const stockWarnings = deal.items.filter(item => {
    const product = products.find(p => p.id === item.productId)
    if (!product) return false
    return Number(product.quantity) - Number(product.reservedQty) < Number(item.quantity)
  })

  function toggleSystem(id: string) {
    setExpandedSystems(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleAddItem() {
    if (!newProductId || !newQty) return
    const product = products.find(p => p.id === newProductId)
    await addItem.mutateAsync({
      productId: newProductId,
      quantity: parseFloat(newQty),
      unitPrice: newPrice ? parseFloat(newPrice) : Number(deal.direction === 'DEALER' ? product?.priceWholesale : product?.priceRetail || 0),
    })
    setNewProductId(''); setNewQty('1'); setNewPrice(''); setAddingItem(false)
  }

  async function handleAddService() {
    if (!newSvcId) return
    const svc = services.find((s: { id: string; price?: number | null }) => s.id === newSvcId)
    const price = newSvcPrice ? parseFloat(newSvcPrice) : (svc?.price ? Number(svc.price) : 0)
    await addService.mutateAsync({ serviceId: newSvcId, unitPrice: price })
    setNewSvcId(''); setNewSvcPrice(''); setAddingSvc(false)
  }

  const standaloneItems = deal.items.filter(i => !i.systemId)
  const dealSystems = deal.systems || []

  function renderItemRow(item: DealItem, compact = false) {
    const px = compact ? 'px-6' : 'px-4'
    const notShipped = Number(item.shippedQty || 0) < Number(item.quantity) &&
      Number(item.shippedQty || 0) > 0
    return (
      <tr key={item.id} className={`border-t hover:bg-muted/20 ${notShipped ? 'bg-amber-500/5' : ''}`}>
        <td className={`${px} py-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          {item.product.name}
          {notShipped && (
            <span className="ml-2 text-xs text-amber-400">
              (отгружено {Number(item.shippedQty)} из {Number(item.quantity)})
            </span>
          )}
        </td>
        <td className={`${px} py-1.5 text-right`}>
          {canEdit ? (
            <EditableCell value={Number(item.quantity)} calcValue={item.calcQty ? Number(item.calcQty) : undefined}
              overridden={item.qtyOverridden} suffix={item.product.unit} type="qty"
              onSave={v => updateItem.mutateAsync({ id: item.id, quantity: v })} />
          ) : (
            <span className="text-muted-foreground text-xs">{Number(item.quantity)} {item.product.unit}</span>
          )}
        </td>
        <td className={`${px} py-1.5 text-right`}>
          {canEdit ? (
            <EditableCell value={Number(item.unitPrice)} calcValue={item.calcPrice ? Number(item.calcPrice) : undefined}
              overridden={item.priceOverridden} suffix="₽" type="price"
              onSave={v => updateItem.mutateAsync({ id: item.id, unitPrice: v })} />
          ) : (
            <span className={`text-xs ${item.priceOverridden ? 'text-amber-400' : 'text-muted-foreground'}`}>
              {Number(item.unitPrice).toLocaleString('ru-RU')} ₽
            </span>
          )}
        </td>
        <td className={`${px} py-1.5 text-right ${compact ? 'text-xs' : ''}`}>
          {(Number(item.quantity) * Number(item.unitPrice)).toLocaleString('ru-RU')} ₽
        </td>
        {canEdit && (
          <td className={`${px} py-1.5`}>
            <div className="flex gap-1 items-center justify-end">
              {deal.needPainting && item.product.isPaintable && (
                <button type="button" onClick={() => setColorPickerItem(item.id)}
                  className="flex items-center gap-1 px-1 py-0.5 rounded border border-input hover:border-primary text-xs">
                  <span className="w-3 h-3 rounded-sm border shrink-0"
                    style={{ backgroundColor: item.paintColor ? RAL_COLORS.find(c => c.code === item.paintColor)?.hex || '#ccc' : '#e5e7eb' }} />
                  {item.paintColor ? item.paintColor.replace('RAL ', '') : '—'}
                </button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem.mutate(item.id)}>
                <Trash2 size={11} />
              </Button>
            </div>
          </td>
        )}
      </tr>
    )
  }

  return (
    <div className="space-y-4">
      {stockWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg p-3 text-sm bg-amber-500/10 border border-amber-500/30 text-amber-300">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
          <div>Недостаточно на складе: {stockWarnings.map(w => w.product.name).join(', ')}</div>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setAddingSystem(true)}>
            <Layers size={14} className="mr-1" />Добавить систему
          </Button>
        </div>
      )}

      {/* Системы в составе заказа */}
      {dealSystems.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2">
            <span className="font-medium text-sm">Системы остекления</span>
          </div>
          {dealSystems.map(ds => {
            const sysItems = deal.items.filter(i => i.systemId === ds.id)
            const sysTotal = sysItems.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
            const params = ds.inputParams as Record<string, unknown>
            const isExpanded = !!expandedSystems[ds.id]

            return (
              <div key={ds.id} className="border-t">
                {/* Заголовок системы — всегда виден */}
                <div className="px-4 py-2.5 bg-muted/30 flex items-center gap-2">
                  {/* Стрелка сворачивания */}
                  <button type="button" onClick={() => toggleSystem(ds.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    {isExpanded
                      ? <ChevronDown size={16} />
                      : <ChevronRight size={16} />}
                  </button>

                  {/* Название и параметры */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleSystem(ds.id)}>
                    <span className="text-sm font-medium">{ds.systemName}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {Object.entries(params)
                        .filter(([, v]) => v !== undefined && v !== null && v !== '')
                        .slice(0, 4)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </span>
                    {!isExpanded && sysItems.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        · {sysItems.length} поз.
                      </span>
                    )}
                  </div>

                  {/* Сумма и кнопки */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium">{sysTotal.toLocaleString('ru-RU')} ₽</span>
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingSystem(ds)}>
                          <Pencil size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Удалить систему из заказа?')) deleteDealSystem.mutate(ds.id) }}>
                          <Trash2 size={12} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Комплектующие — только если развёрнуто */}
                {isExpanded && (
                  <>
                    {sysItems.length > 0 ? (
                      <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground border-b bg-muted/10">
                          <tr>
                            <th className="text-left px-6 py-1.5">Наименование</th>
                            <th className="text-right px-4 py-1.5">Кол-во</th>
                            <th className="text-right px-4 py-1.5">Цена</th>
                            <th className="text-right px-4 py-1.5">Сумма</th>
                            {canEdit && <th className="px-4 py-1.5" />}
                          </tr>
                        </thead>
                        <tbody>
                          {sysItems.map(item => renderItemRow(item, true))}
                        </tbody>
                      </table>
                      </div>
                    ) : (
                      <div className="px-6 py-2 text-xs text-muted-foreground">Комплектующие не добавлены</div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Отдельные комплектующие */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted px-4 py-2 flex items-center justify-between">
          <span className="font-medium text-sm">Отдельные комплектующие</span>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setAddingItem(true)}>
              <Plus size={13} className="mr-1" />Добавить позицию
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs border-b">
            <tr>
              <th className="text-left px-4 py-2">Наименование</th>
              <th className="text-right px-4 py-2">Кол-во</th>
              <th className="text-right px-4 py-2">Цена</th>
              <th className="text-right px-4 py-2">Сумма</th>
              {canEdit && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {standaloneItems.length === 0 && !addingItem && (
              <tr><td colSpan={5} className="text-center py-4 text-muted-foreground text-xs">Нет позиций</td></tr>
            )}
            {standaloneItems.map(item => renderItemRow(item, false))}
            {addingItem && (
              <tr className="border-t bg-muted/20">
                <td className="px-4 py-2">
                  <select value={newProductId}
                    onChange={e => { setNewProductId(e.target.value); const p = products.find(x => x.id === e.target.value); if (p) setNewPrice(String(deal.direction === 'DEALER' ? p.priceWholesale : p.priceRetail)) }}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Выберите товар</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2"><Input type="number" step="1" value={newQty} onChange={e => setNewQty(e.target.value)} className="w-20 h-8 text-right" /></td>
                <td className="px-4 py-2"><Input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-28 h-8 text-right" /></td>
                <td className="px-4 py-2 text-right text-xs text-muted-foreground">{((parseFloat(newQty) || 0) * (parseFloat(newPrice) || 0)).toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleAddItem}>+</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingItem(false)}>✕</Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Дополнительные работы */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted px-4 py-2 flex items-center justify-between">
          <span className="font-medium text-sm">Дополнительные работы</span>
          {canEdit && <Button size="sm" variant="ghost" onClick={() => setAddingSvc(true)}><Plus size={13} className="mr-1" />Добавить</Button>}
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs border-b">
            <tr>
              <th className="text-left px-4 py-2">Услуга</th>
              <th className="text-right px-4 py-2">Кол-во</th>
              <th className="text-right px-4 py-2">Цена</th>
              <th className="text-right px-4 py-2">Сумма</th>
              {canEdit && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {deal.services.length === 0 && !addingSvc && (
              <tr><td colSpan={5} className="text-center py-4 text-muted-foreground text-xs">Нет услуг</td></tr>
            )}
            {deal.services.map(svc => (
              <tr key={svc.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2">{svc.service.name}</td>
                <td className="px-4 py-2 text-right">{svc.quantity}</td>
                <td className="px-4 py-2 text-right">{Number(svc.unitPrice).toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-2 text-right font-medium">{(svc.quantity * Number(svc.unitPrice)).toLocaleString('ru-RU')} ₽</td>
                {canEdit && <td className="px-4 py-2 text-right"><Button variant="ghost" size="icon" onClick={() => removeService.mutate(svc.id)}><Trash2 size={13} /></Button></td>}
              </tr>
            ))}
            {addingSvc && (
              <tr className="border-t bg-muted/20">
                <td className="px-4 py-2" colSpan={2}>
                  <select value={newSvcId}
                    onChange={e => { setNewSvcId(e.target.value); const s = services.find((x: { id: string; price?: number | null }) => x.id === e.target.value); if (s?.price) setNewSvcPrice(String(s.price)); else setNewSvcPrice('') }}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Выберите услугу</option>
                    {services.map((s: { id: string; name: string; priceFormula?: string | null }) => (
                      <option key={s.id} value={s.id}>{s.name}{s.priceFormula ? ' ⚡' : ''}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <Input type="number" step="0.01" value={newSvcPrice} onChange={e => setNewSvcPrice(e.target.value)} placeholder="Цена ₽" className="w-28 h-8 text-right" />
                </td>
                <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                  {newSvcPrice ? `${parseFloat(newSvcPrice).toLocaleString('ru-RU')} ₽` : ''}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleAddService}>+</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingSvc(false)}>✕</Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {addingSystem && (
        <AddSystemDialog dealId={deal.id} direction={deal.direction} onClose={() => setAddingSystem(false)} />
      )}

      {editingSystem && (
        <AddSystemDialog dealId={deal.id} direction={deal.direction} editingSystem={editingSystem} onClose={() => setEditingSystem(null)} />
      )}

      {colorPickerItem && (() => {
        const item = deal.items.find(i => i.id === colorPickerItem)
        if (!item) return null
        return (
          <Dialog open onOpenChange={() => setColorPickerItem(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Цвет покраски: {item.product.name}
                  {deal.paintAllOneColor && <span className="text-xs font-normal text-amber-600 ml-2">(применится ко всем окрашиваемым)</span>}
                </DialogTitle>
              </DialogHeader>
              <RalColorPicker
                value={item.paintColor || ''}
                finish={item.paintFinish || 'matte'}
                onChange={async (code, finish) => {
                  await updatePaint.mutateAsync({ itemId: item.id, paintColor: code, paintFinish: finish, applyToAll: deal.paintAllOneColor })
                  setColorPickerItem(null)
                }}
              />
            </DialogContent>
          </Dialog>
        )
      })()}
    </div>
  )
}
