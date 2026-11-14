import { useState } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProductTypes, useCreateProductType } from '@/api/warehouse'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export default function ProductTypesTab() {
  const { data: types = [] } = useProductTypes()
  const create = useCreateProductType()
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')

  const deleteType = useMutation({
    mutationFn: (id: string) => api.delete(`/products/types/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productTypes'] }),
  })

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.post('/products/types/reorder', { ids }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productTypes'] }),
  })

  // Сортируем по полю order
  const sorted = [...types].sort((a, b) => ((a as { order?: number }).order ?? 0) - ((b as { order?: number }).order ?? 0))

  function move(idx: number, dir: 'up' | 'down') {
    const newOrder = [...sorted]
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= newOrder.length) return
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
    reorder.mutate(newOrder.map(t => t.id))
  }

  async function handleAdd() {
    if (!newName.trim()) return
    await create.mutateAsync(newName.trim())
    setNewName('')
  }

  return (
    <div className="space-y-3 max-w-sm">
      <div className="flex gap-2">
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название типа..."
          onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Button size="sm" onClick={handleAdd}><Plus size={15} /></Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {sorted.map((t, idx) => (
          <div key={t.id} className="flex items-center justify-between px-3 py-2 border-b last:border-0 hover:bg-muted/30">
            {/* Кнопки порядка */}
            <div className="flex flex-col gap-0 mr-2">
              <button onClick={() => move(idx, 'up')} disabled={idx === 0}
                className="p-0.5 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed">
                <ArrowUp size={12} />
              </button>
              <button onClick={() => move(idx, 'down')} disabled={idx === sorted.length - 1}
                className="p-0.5 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed">
                <ArrowDown size={12} />
              </button>
            </div>

            <span className="text-sm flex-1">{t.name}</span>

            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
              onClick={() => { if (confirm('Удалить тип?')) deleteType.mutate(t.id) }}>
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        {types.length === 0 && <div className="text-center py-4 text-muted-foreground text-sm">Нет типов</div>}
      </div>

      <p className="text-xs text-muted-foreground">
        Порядок типов используется при отображении товаров в разделе склада и в составе заказов.
      </p>
    </div>
  )
}
