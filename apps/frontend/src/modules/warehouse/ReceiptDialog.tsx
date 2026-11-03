import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateReceipt, useUpdateReceipt, useSuppliers, useProducts, useCreateSupplier, type Receipt } from '@/api/warehouse'
import { format } from 'date-fns'
import FileUpload from '@/components/FileUpload'
import { useQueryClient } from '@tanstack/react-query'

interface LineItem { productId: string; quantity: number; costPrice: number }
interface Props { receipt?: Receipt; onClose: () => void }

export default function ReceiptDialog({ receipt, onClose }: Props) {
  const [supplierId, setSupplierId] = useState(receipt?.supplierId || '')
  const [date, setDate] = useState(receipt ? format(new Date(receipt.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
  const [items, setItems] = useState<LineItem[]>(receipt?.items.map(i => ({ productId: i.productId, quantity: Number(i.quantity), costPrice: Number(i.costPrice) })) || [{ productId: '', quantity: 1, costPrice: 0 }])
  const [newSupplier, setNewSupplier] = useState('')
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(receipt?.id || null)
  const qc = useQueryClient()

  const { data: suppliers = [] } = useSuppliers()
  const { data: products = [] } = useProducts()
  const createReceipt = useCreateReceipt()
  const updateReceipt = useUpdateReceipt()
  const createSupplier = useCreateSupplier()

  async function addSupplier() {
    if (!newSupplier.trim()) return
    const s = await createSupplier.mutateAsync(newSupplier.trim())
    setSupplierId(s.id)
    setNewSupplier('')
    setShowNewSupplier(false)
  }

  function addItem() { setItems(i => [...i, { productId: '', quantity: 1, costPrice: 0 }]) }
  function removeItem(idx: number) { setItems(i => i.filter((_, j) => j !== idx)) }
  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter(i => i.productId && i.quantity > 0 && i.costPrice >= 0)
    if (!supplierId || !validItems.length) return
    if (receipt) await updateReceipt.mutateAsync({ id: receipt.id, date, items: validItems })
    else {
      const created = await createReceipt.mutateAsync({ supplierId, date, items: validItems })
      setSavedReceiptId(created.id)
      onClose()
      return
    }
    onClose()
  }

  const total = items.reduce((s, i) => s + (i.quantity || 0) * (i.costPrice || 0), 0)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{receipt ? 'Редактировать приход' : 'Новый приход'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Поставщик *</label>
              {showNewSupplier ? (
                <div className="flex gap-2">
                  <Input value={newSupplier} onChange={e => setNewSupplier(e.target.value)} placeholder="Название поставщика" />
                  <Button type="button" size="sm" onClick={addSupplier}>Добавить</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewSupplier(false)}>✕</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Выберите поставщика</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowNewSupplier(true)}>+ Новый</Button>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Дата</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground font-medium">Позиции</label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus size={13} className="mr-1" />Добавить позицию</Button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Выберите товар</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  <Input type="number" step="0.001" min="0" placeholder="Кол-во" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))} className="w-24" />
                  <Input type="number" step="0.01" min="0" placeholder="Цена ₽" value={item.costPrice} onChange={e => updateItem(idx, 'costPrice', parseFloat(e.target.value))} className="w-28" />
                  <span className="text-sm text-muted-foreground w-24 text-right">{((item.quantity || 0) * (item.costPrice || 0)).toLocaleString('ru-RU')} ₽</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
            <div className="text-right text-sm font-medium mt-2">Итого: {total.toLocaleString('ru-RU')} ₽</div>
          </div>

          {/* Фото накладной */}
          {savedReceiptId && (
            <FileUpload
              endpoint={`/receipts/${savedReceiptId}/upload`}
              accept="image/*,.pdf"
              label="Фото накладной от поставщика"
              existingUrl={(receipt as never as { photoUrl?: string })?.photoUrl || undefined}
              existingName="Накладная"
              onUploaded={() => qc.invalidateQueries({ queryKey: ['receipts'] })}
            />
          )}
          {!savedReceiptId && (
            <p className="text-xs text-muted-foreground">Фото накладной можно загрузить после сохранения прихода</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={createReceipt.isPending || updateReceipt.isPending}>Сохранить</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
