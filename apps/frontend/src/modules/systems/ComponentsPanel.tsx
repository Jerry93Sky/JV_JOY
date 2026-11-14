import { useState } from 'react'
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateComponent, useUpdateComponent, useDeleteComponent, type GlazingSystem, type SystemComponent } from '@/api/systems'
import { useProducts } from '@/api/warehouse'

interface Props { system: GlazingSystem }

export default function ComponentsPanel({ system }: Props) {
  const { data: products = [] } = useProducts()
  const createComp = useCreateComponent(system.id)
  const updateComp = useUpdateComponent(system.id)
  const deleteComp = useDeleteComponent(system.id)

  const [adding, setAdding] = useState(false)
  const [newProductId, setNewProductId] = useState('')
  const [newFormula, setNewFormula] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormula, setEditFormula] = useState('')

  async function handleAdd() {
    if (!newProductId || !newFormula.trim()) return
    await createComp.mutateAsync({ productId: newProductId, formula: newFormula.trim() })
    setNewProductId('')
    setNewFormula('')
    setAdding(false)
  }

  async function handleSave(id: string) {
    await updateComp.mutateAsync({ id, formula: editFormula })
    setEditingId(null)
  }

  // Переменные системы для подсказки
  const vars = system.parameters.map(p => p.variable).join(', ')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Доступные переменные: <span className="font-mono">{vars || 'нет параметров'}</span>
        </p>
        <Button size="sm" onClick={() => setAdding(true)}><Plus size={15} className="mr-1" />Добавить комплектующее</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Товар</th>
              <th className="text-left px-4 py-2 font-medium">Артикул</th>
              <th className="text-left px-4 py-2 font-medium">Ед.</th>
              <th className="text-left px-4 py-2 font-medium">Формула количества</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {system.components.length === 0 && !adding && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Комплектующих нет</td></tr>
            )}
            {system.components.map(c => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{c.product.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{c.product.sku}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.product.unit}</td>
                <td className="px-4 py-2">
                  {editingId === c.id ? (
                    <Input value={editFormula} onChange={e => setEditFormula(e.target.value)}
                      className="font-mono text-xs h-7" autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(c.id); if (e.key === 'Escape') setEditingId(null) }} />
                  ) : (
                    <span className="font-mono text-xs">{c.formula}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    {editingId === c.id ? (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleSave(c.id)}><Save size={14} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}><X size={14} /></Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setEditFormula(c.formula) }}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Удалить?')) deleteComp.mutate(c.id) }}>
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {adding && (
              <tr className="border-t bg-muted/20">
                <td colSpan={3} className="px-4 py-2">
                  <select value={newProductId} onChange={e => setNewProductId(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Выберите товар</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <Input value={newFormula} onChange={e => setNewFormula(e.target.value)}
                    placeholder="Например: width * 2 + 100" className="font-mono text-xs h-8"
                    onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={handleAdd}><Save size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setAdding(false)}><X size={14} /></Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
