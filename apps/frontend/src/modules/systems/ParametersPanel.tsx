import { useState } from 'react'
import { Plus, Pencil, Trash2, FolderPlus, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDeleteParameter, useCreateCategory, useDeleteCategory, useReorderParameters, type GlazingSystem, type SystemParameter } from '@/api/systems'
import ParameterDialog from './ParameterDialog'

const KIND_LABELS: Record<string, string> = { INPUT: 'Вводные', CALCULATED: 'Рассчитываемые', CONSTANT: 'Константы' }
const KIND_ORDER: Record<string, number> = { INPUT: 0, CALCULATED: 1, CONSTANT: 2 }
const KIND_COLORS: Record<string, string> = {
  INPUT:      'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  CALCULATED: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  CONSTANT:   'bg-slate-500/20 text-slate-300 border border-slate-500/30',
}
const KIND_HEADER_BG: Record<string, string> = {
  INPUT:      'bg-blue-500/15 border-l-4 border-l-blue-500 text-blue-300',
  CALCULATED: 'bg-amber-500/15 border-l-4 border-l-amber-500 text-amber-300',
  CONSTANT:   'bg-slate-500/15 border-l-4 border-l-slate-400 text-slate-300',
}
const KIND_ROW_BG: Record<string, string> = {
  INPUT:      '',
  CALCULATED: 'bg-amber-500/5',
  CONSTANT:   'bg-slate-500/5',
}
const TYPE_LABELS: Record<string, string> = { NUMBER: 'Число', SELECT: 'Список', BOOLEAN: 'Чекбокс' }

interface Props { system: GlazingSystem }

export default function ParametersPanel({ system }: Props) {
  const [editing, setEditing] = useState<SystemParameter | null>(null)
  const [creating, setCreating] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const deleteParam = useDeleteParameter(system.id)
  const createCat = useCreateCategory(system.id)
  const deleteCat = useDeleteCategory(system.id)
  const reorder = useReorderParameters(system.id)

  // Перемещение параметра вверх/вниз внутри его группы (по proposalPriority)
  function moveParam(params: SystemParameter[], paramId: string, dir: 'up' | 'down') {
    const sorted = [...params].sort((a, b) => (a.proposalPriority ?? 0) - (b.proposalPriority ?? 0))
    const idx = sorted.findIndex(p => p.id === paramId)
    if (idx < 0) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const priorities = sorted.map((p, i) => ({ id: p.id, proposalPriority: i }))
    // Меняем местами
    const tmp = priorities[idx].proposalPriority
    priorities[idx].proposalPriority = priorities[swapIdx].proposalPriority
    priorities[swapIdx].proposalPriority = tmp
    reorder.mutate(priorities)
  }

  const categories = system.categories || []
  const uncategorized = system.parameters.filter(p => !p.categoryId)

  async function handleAddCategory() {
    if (!newCatName.trim()) return
    await createCat.mutateAsync({ name: newCatName.trim(), order: categories.length })
    setNewCatName('')
    setAddingCat(false)
  }

  function renderParamTable(params: SystemParameter[]) {
    if (params.length === 0) return <div className="text-xs text-muted-foreground px-4 py-2">Нет параметров</div>

    // Группируем по paramKind в порядке INPUT → CALCULATED → CONSTANT
    // Внутри каждой группы сортируем по proposalPriority
    const grouped = params.reduce<Record<string, SystemParameter[]>>((acc, p) => {
      if (!acc[p.paramKind]) acc[p.paramKind] = []
      acc[p.paramKind].push(p)
      return acc
    }, {})
    const kinds = Object.keys(grouped).sort((a, b) => (KIND_ORDER[a] ?? 9) - (KIND_ORDER[b] ?? 9))
    // Сортируем каждую группу по proposalPriority
    for (const k of kinds) {
      grouped[k].sort((a, b) => (a.proposalPriority ?? 0) - (b.proposalPriority ?? 0))
    }

    return (
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-1.5 font-medium text-xs">Название</th>
            <th className="text-left px-4 py-1.5 font-medium text-xs">Переменная</th>
            <th className="text-left px-4 py-1.5 font-medium text-xs">Тип</th>
            <th className="text-left px-4 py-1.5 font-medium text-xs">Формула / Значение</th>
            <th className="text-left px-4 py-1.5 font-medium text-xs">Лимиты</th>
            <th className="text-left px-4 py-1.5 font-medium text-xs">КП / Компл.</th>
            <th className="px-4 py-1.5 text-xs text-muted-foreground text-center">Порядок</th>
            <th className="px-4 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {kinds.map(kind => (
            <>
              <tr key={`kind-${kind}`}>
                <td colSpan={8} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest ${KIND_HEADER_BG[kind] ?? 'bg-muted/30 text-muted-foreground'}`}>
                  {KIND_LABELS[kind] ?? kind}
                </td>
              </tr>
              {grouped[kind].map((p, idx) => (
                <tr key={p.id} className={`border-t hover:brightness-110 ${KIND_ROW_BG[p.paramKind] ?? ''}`}>
                  <td className="px-4 py-2 font-medium">
                    {p.name}
                    {p.isAdvanced && <span className="ml-1.5 text-xs text-muted-foreground">(доп.)</span>}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{p.variable}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${KIND_COLORS[p.paramKind] ?? ''}`}>
                      {KIND_LABELS[p.paramKind]}
                    </span>
                    <span className="text-muted-foreground ml-1">/ {TYPE_LABELS[p.type]}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs max-w-xs truncate">{p.formula || p.defaultValue || '—'}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {p.limits.length > 0 ? p.limits.map(l => `${l.minValue ?? '∞'}–${l.maxValue ?? '∞'}`).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className={p.showInProposal ? 'text-green-600' : 'text-muted-foreground'}>КП</span>
                    {' / '}
                    <span className={p.showInAssembly ? 'text-green-600' : 'text-muted-foreground'}>Компл.</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-0.5 justify-center">
                      <button disabled={idx === 0}
                        onClick={() => moveParam(grouped[kind], p.id, 'up')}
                        className="p-0.5 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed">
                        <ArrowUp size={13} />
                      </button>
                      <button disabled={idx === grouped[kind].length - 1}
                        onClick={() => moveParam(grouped[kind], p.id, 'down')}
                        className="p-0.5 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed">
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm('Удалить параметр?')) deleteParam.mutate(p.id) }}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setAddingCat(true)}><FolderPlus size={15} className="mr-1" />Добавить категорию</Button>
        <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} className="mr-1" />Добавить параметр</Button>
      </div>

      {addingCat && (
        <div className="flex gap-2 items-center border rounded-md p-3 bg-muted/30">
          <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Название категории" className="max-w-xs"
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()} autoFocus />
          <Button size="sm" onClick={handleAddCategory}>Создать</Button>
          <Button size="sm" variant="ghost" onClick={() => setAddingCat(false)}>Отмена</Button>
        </div>
      )}

      {/* Категории */}
      {categories.map(cat => {
        const params = system.parameters.filter(p => p.categoryId === cat.id)
        return (
          <div key={cat.id} className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-2 flex items-center justify-between">
              <span className="font-medium text-sm">{cat.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => { if (confirm(`Удалить категорию "${cat.name}"? Параметры останутся без категории.`)) deleteCat.mutate(cat.id) }}>
                <Trash2 size={13} />
              </Button>
            </div>
            {renderParamTable(params)}
          </div>
        )
      })}

      {/* Без категории */}
      {(uncategorized.length > 0 || categories.length === 0) && (
        <div className="border rounded-lg overflow-hidden">
          {categories.length > 0 && (
            <div className="bg-muted/50 px-4 py-2">
              <span className="font-medium text-sm text-muted-foreground">Общие</span>
            </div>
          )}
          {renderParamTable(uncategorized)}
        </div>
      )}

      {system.parameters.length === 0 && (
        <div className="text-center py-10 text-muted-foreground border rounded-lg">
          Параметров нет. Добавьте первый параметр.
        </div>
      )}

      {(creating || editing) && (
        <ParameterDialog
          systemId={system.id}
          categories={categories}
          parameter={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
