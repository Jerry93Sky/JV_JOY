import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDiscountThresholds, useCreateThreshold, useDeleteThreshold } from '@/api/settings'

export default function DiscountThresholdsTab() {
  const { data: thresholds = [] } = useDiscountThresholds()
  const create = useCreateThreshold()
  const remove = useDeleteThreshold()
  const [minTurnover, setMinTurnover] = useState('')
  const [discountPct, setDiscountPct] = useState('')

  async function handleAdd() {
    if (!minTurnover || !discountPct) return
    await create.mutateAsync({ minTurnover: parseFloat(minTurnover), discountPct: parseFloat(discountPct) })
    setMinTurnover(''); setDiscountPct('')
  }

  const sorted = [...thresholds].sort((a, b) => Number(a.minTurnover) - Number(b.minTurnover))

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Скидки применяются к дилерским заказам на основе оборота компании за предыдущий год.
      </p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Оборот от ₽</th>
              <th className="text-left px-4 py-2 font-medium">Скидка %</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => (
              <tr key={t.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2">{Number(t.minTurnover).toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-2 font-medium text-green-600">{Number(t.discountPct)}%</td>
                <td className="px-4 py-2">
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                    onClick={() => remove.mutate(t.id)}>
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
            {thresholds.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-muted-foreground">Пороги не заданы</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Оборот от ₽</label>
          <Input type="number" value={minTurnover} onChange={e => setMinTurnover(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Скидка %</label>
          <Input type="number" step="0.1" value={discountPct} onChange={e => setDiscountPct(e.target.value)} className="w-24" />
        </div>
        <Button size="sm" onClick={handleAdd}><Plus size={15} className="mr-1" />Добавить</Button>
      </div>
    </div>
  )
}
