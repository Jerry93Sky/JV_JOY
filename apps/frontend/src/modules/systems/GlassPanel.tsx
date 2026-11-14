import { useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSystemGlasses, useCreateGlass, useUpdateGlass, useDeleteGlass, type SystemGlass } from '@/api/systems'
import { useGlassTypes } from '@/api/glass'

const COMPLEXITY_LABELS = { PLAIN: 'Прямоугольное', CUTS: 'С вырезами', HOLES: 'С отверстиями' }

interface GlassDialogProps {
  systemId: string
  initial?: SystemGlass
  onClose: () => void
}

function GlassDialog({ systemId, initial, onClose }: GlassDialogProps) {
  const create = useCreateGlass(systemId)
  const update = useUpdateGlass(systemId)
  const { data: glassTypes = [] } = useGlassTypes()

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    widthFormula: initial?.widthFormula ?? '',
    heightFormula: initial?.heightFormula ?? '',
    quantityFormula: initial?.quantityFormula ?? '1',
    complexity: initial?.complexity ?? 'PLAIN' as 'PLAIN' | 'CUTS' | 'HOLES',
    glassTypeId: initial?.glassTypeId ?? null as string | null,
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const busy = create.isPending || update.isPending

  const handleSave = async () => {
    if (!form.name || !form.widthFormula || !form.heightFormula) return
    if (initial) {
      await update.mutateAsync({ id: initial.id, ...form })
    } else {
      await create.mutateAsync(form)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg p-6 w-full max-w-lg shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{initial ? 'Редактировать стекло' : 'Добавить стекло'}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Название (например: Стекло основное)</label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Стекло основное" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Формула ширины (мм)</label>
            <Input value={form.widthFormula} onChange={e => set('widthFormula', e.target.value)} placeholder="width - 10" className="font-mono text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Формула высоты (мм)</label>
            <Input value={form.heightFormula} onChange={e => set('heightFormula', e.target.value)} placeholder="height - 10" className="font-mono text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Формула количества (шт)</label>
            <Input value={form.quantityFormula} onChange={e => set('quantityFormula', e.target.value)} placeholder="1" className="font-mono text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Тип сложности</label>
            <select value={form.complexity} onChange={e => set('complexity', e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              {Object.entries(COMPLEXITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Тип стекла по умолчанию (необязательно)</label>
          <select value={form.glassTypeId ?? ''} onChange={e => set('glassTypeId', e.target.value || null)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">— выбирается при расчёте —</option>
            {glassTypes.filter(t => t.isActive).map(t => (
              <option key={t.id} value={t.id}>{t.glassKind} {t.coating} {t.thickness}мм</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">
          В формулах можно использовать переменные параметров системы (например: <code className="font-mono">width</code>, <code className="font-mono">height</code>).
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={busy || !form.name || !form.widthFormula || !form.heightFormula}>
            {busy ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface Props { systemId: string }

export default function GlassPanel({ systemId }: Props) {
  const { data: glasses = [] } = useSystemGlasses(systemId)
  const deleteGlass = useDeleteGlass(systemId)
  const [editing, setEditing] = useState<SystemGlass | null | 'new'>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Стёкла системы — формулы расчёта размеров и привязка к типам стекла.
        </p>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus size={14} className="mr-1" />Добавить стекло
        </Button>
      </div>

      {glasses.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg">
          Стёкла не добавлены. Нажмите «Добавить стекло».
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground bg-muted">
                <th className="text-left p-3">Название</th>
                <th className="text-left p-3">Ширина (формула)</th>
                <th className="text-left p-3">Высота (формула)</th>
                <th className="text-left p-3">Кол-во</th>
                <th className="text-left p-3">Сложность</th>
                <th className="text-left p-3">Тип стекла</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {glasses.map(g => (
                <tr key={g.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{g.name}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{g.widthFormula}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{g.heightFormula}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{g.quantityFormula}</td>
                  <td className="p-3 text-xs">{COMPLEXITY_LABELS[g.complexity]}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {g.glassType
                      ? `${g.glassType.glassKind} ${g.glassType.coating} ${g.glassType.thickness}мм`
                      : <span className="italic">при расчёте</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditing(g)} className="p-1 hover:text-primary"><Pencil size={13} /></button>
                      <button onClick={() => deleteGlass.mutate(g.id)} className="p-1 hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <GlassDialog
          systemId={systemId}
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
