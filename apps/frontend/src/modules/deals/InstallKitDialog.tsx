import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { type Deal } from '@/api/deals'

interface KitItem {
  itemId: string
  name: string
  sku: string
  unit: string
  totalQty: number
  alreadyShipped: number
  toShip: number
  checked: boolean
}

interface Props {
  deal: Deal
  stage: 'first' | 'second'
  onClose: () => void
  onDone: () => void
}

export default function InstallKitDialog({ deal, stage, onClose, onDone }: Props) {
  const qc = useQueryClient()

  // Собираем все позиции с остатком к отгрузке
  const [items, setItems] = useState<KitItem[]>(() =>
    deal.items.map(i => ({
      itemId: i.id,
      name: i.product.name,
      sku: i.product.sku,
      unit: i.product.unit,
      totalQty: Number(i.quantity),
      alreadyShipped: Number(i.shippedQty || 0),
      toShip: Math.max(0, Number(i.quantity) - Number(i.shippedQty || 0)),
      checked: Number(i.quantity) - Number(i.shippedQty || 0) > 0,
    })).filter(i => i.totalQty > 0)
  )

  const kitMutation = useMutation({
    mutationFn: (data: { items: { itemId: string; qty: number }[] }) =>
      api.post(`/deals/${deal.id}/install-kit`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', deal.id] })
      onDone()
    },
  })

  const toggleItem = (idx: number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it))

  const setQty = (idx: number, val: string) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, toShip: Math.max(0, parseFloat(val) || 0) } : it))

  const handleSubmit = () => {
    const toSend = items
      .filter(i => i.checked && i.toShip > 0)
      .map(i => ({ itemId: i.itemId, qty: i.toShip }))
    if (toSend.length === 0) { onClose(); return }
    kitMutation.mutate({ items: toSend })
  }

  const checkedCount = items.filter(i => i.checked && i.toShip > 0).length
  const remaining = items.filter(i => {
    const afterShip = i.alreadyShipped + (i.checked ? i.toShip : 0)
    return afterShip < i.totalQty
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg p-6 w-full max-w-2xl shadow-xl space-y-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            Скомплектовать на монтаж — {stage === 'first' ? '1-й этап' : '2-й этап'}
          </h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <p className="text-sm text-muted-foreground">
          Отметьте позиции и укажите количество, которое везёте на объект.
          Остальное останется на складе как неотгруженное.
        </p>

        <div className="overflow-auto flex-1 border rounded">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="p-2 w-8">
                  <input type="checkbox"
                    checked={items.every(i => i.checked)}
                    onChange={e => setItems(prev => prev.map(it => ({ ...it, checked: e.target.checked })))} />
                </th>
                <th className="text-left p-2">Наименование</th>
                <th className="text-center p-2 w-20">Всего</th>
                <th className="text-center p-2 w-24">Уже отгружено</th>
                <th className="text-center p-2 w-28">Везём сейчас</th>
                <th className="text-center p-2 w-24">Остаток</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const afterShip = item.alreadyShipped + (item.checked ? item.toShip : 0)
                const leftover = item.totalQty - afterShip
                return (
                  <tr key={item.itemId} className={`border-t ${!item.checked ? 'opacity-50' : ''}`}>
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={item.checked} onChange={() => toggleItem(idx)} />
                    </td>
                    <td className="p-2">
                      <div>{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.sku}</div>
                    </td>
                    <td className="p-2 text-center text-muted-foreground">
                      {item.totalQty} {item.unit}
                    </td>
                    <td className="p-2 text-center text-muted-foreground">
                      {item.alreadyShipped > 0 ? `${item.alreadyShipped} ${item.unit}` : '—'}
                    </td>
                    <td className="p-2 text-center">
                      {item.checked ? (
                        <Input type="number" value={item.toShip}
                          onChange={e => setQty(idx, e.target.value)}
                          className="h-7 w-20 text-center text-xs mx-auto"
                          min={0} max={item.totalQty - item.alreadyShipped} />
                      ) : '—'}
                    </td>
                    <td className={`p-2 text-center text-xs font-medium ${leftover > 0 ? 'text-amber-400' : 'text-green-500'}`}>
                      {leftover > 0 ? `${leftover} ${item.unit}` : '✓'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {remaining.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            {remaining.length} позиций останутся на складе как неотгруженные
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-muted-foreground">
            Выбрано позиций: {checkedCount}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Отмена</Button>
            <Button onClick={handleSubmit} disabled={kitMutation.isPending}>
              {kitMutation.isPending ? 'Сохранение...' : 'Подтвердить комплектацию'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
