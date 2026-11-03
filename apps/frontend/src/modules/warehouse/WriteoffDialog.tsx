import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateWriteoff, useProducts } from '@/api/warehouse'

interface LineItem { productId: string; quantity: number }
interface Props { onClose: () => void }

export default function WriteoffDialog({ onClose }: Props) {
  const [reason, setReason] = useState<'INVENTORY' | 'DEFECT'>('INVENTORY')
  const [comment, setComment] = useState('')
  const [items, setItems] = useState<LineItem[]>([{ productId: '', quantity: 1 }])
  const { data: products = [] } = useProducts()
  const createWriteoff = useCreateWriteoff()

  function addItem() { setItems(i => [...i, { productId: '', quantity: 1 }]) }
  function removeItem(idx: number) { setItems(i => i.filter((_, j) => j !== idx)) }
  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter(i => i.productId && i.quantity > 0)
    if (!comment.trim() || !validItems.length) return
    await createWriteoff.mutateAsync({ reason, comment, items: validItems })
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Оформить списание</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Причина *</label>
            <select value={reason} onChange={e => setReason(e.target.value as 'INVENTORY' | 'DEFECT')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="INVENTORY">Инвентаризация</option>
              <option value="DEFECT">Брак</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Комментарий *</label>
            <Input value={comment} onChange={e => setComment(e.target.value)} required />
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
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (остаток: {Number(p.quantity).toFixed(2)} {p.unit})</option>)}
                  </select>
                  <Input type="number" step="0.001" min="0.001" placeholder="Кол-во" value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))} className="w-28" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={createWriteoff.isPending}>Сохранить</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
