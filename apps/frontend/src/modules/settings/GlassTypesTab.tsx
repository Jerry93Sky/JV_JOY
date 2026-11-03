import { useState } from 'react'
import { Plus, Pencil, Trash2, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useGlassTypes, useCreateGlassType, useUpdateGlassType, useDeleteGlassType,
  type GlassType,
} from '@/api/glass'

interface GlassTypeDialogProps {
  initial?: GlassType
  onClose: () => void
}

function GlassTypeDialog({ initial, onClose }: GlassTypeDialogProps) {
  const create = useCreateGlassType()
  const update = useUpdateGlassType()

  const initCutsMode = (initial?.costPriceWithCuts != null || initial?.sellingPriceWithCuts != null) ? 'fixed' : 'pct'
  const initHolesMode = (initial?.costPriceWithHoles != null || initial?.sellingPriceWithHoles != null) ? 'fixed' : 'pct'

  const [form, setForm] = useState({
    thickness: initial?.thickness ?? 8,
    coating: initial?.coating ?? '',
    glassKind: initial?.glassKind ?? 'закалённое',
    costPricePerSqm: initial?.costPricePerSqm ?? 0,
    sellingPricePerSqm: initial?.sellingPricePerSqm ?? 0,
    deliveryCostFixed: initial?.deliveryCostFixed ?? 0,
    surchargeWithCutsPct: initial?.surchargeWithCutsPct ?? null as number | null,
    costPriceWithCuts: initial?.costPriceWithCuts ?? null as number | null,
    sellingPriceWithCuts: initial?.sellingPriceWithCuts ?? null as number | null,
    surchargeWithHolesPct: initial?.surchargeWithHolesPct ?? null as number | null,
    costPriceWithHoles: initial?.costPriceWithHoles ?? null as number | null,
    sellingPriceWithHoles: initial?.sellingPriceWithHoles ?? null as number | null,
    isActive: initial?.isActive ?? true,
  })
  const [cutsMode, setCutsMode] = useState<'pct' | 'fixed'>(initCutsMode)
  const [holesMode, setHolesMode] = useState<'pct' | 'fixed'>(initHolesMode)

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const busy = create.isPending || update.isPending

  const handleSave = async () => {
    if (!form.coating || !form.glassKind) return
    const data = {
      ...form,
      surchargeWithCutsPct: cutsMode === 'pct' ? form.surchargeWithCutsPct : null,
      costPriceWithCuts: cutsMode === 'fixed' ? form.costPriceWithCuts : null,
      sellingPriceWithCuts: cutsMode === 'fixed' ? form.sellingPriceWithCuts : null,
      surchargeWithHolesPct: holesMode === 'pct' ? form.surchargeWithHolesPct : null,
      costPriceWithHoles: holesMode === 'fixed' ? form.costPriceWithHoles : null,
      sellingPriceWithHoles: holesMode === 'fixed' ? form.sellingPriceWithHoles : null,
    }
    if (initial) {
      await update.mutateAsync({ id: initial.id, ...data })
    } else {
      await create.mutateAsync(data as never)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg p-6 w-full max-w-lg shadow-xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{initial ? 'Редактировать тип стекла' : 'Новый тип стекла'}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Толщина (мм)</label>
            <Input type="number" value={form.thickness} onChange={e => set('thickness', +e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Вид стекла</label>
            <Input value={form.glassKind} onChange={e => set('glassKind', e.target.value)} placeholder="закалённое" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Покрытие / тонировка</label>
          <Input value={form.coating} onChange={e => set('coating', e.target.value)} placeholder="бесцветное" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Закупочная цена (₽/м²)</label>
            <Input type="number" value={form.costPricePerSqm} onChange={e => set('costPricePerSqm', +e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Цена продажи (₽/м²)</label>
            <Input type="number" value={form.sellingPricePerSqm} onChange={e => set('sellingPricePerSqm', +e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 border rounded p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">С отверстиями</span>
            <div className="flex gap-1 text-xs">
              <button onClick={() => setHolesMode('pct')} className={`px-2 py-0.5 rounded ${holesMode === 'pct' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>% надбавка</button>
              <button onClick={() => setHolesMode('fixed')} className={`px-2 py-0.5 rounded ${holesMode === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Фикс. цена</button>
            </div>
          </div>
          {holesMode === 'pct' ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Надбавка (%)</label>
              <Input type="number" placeholder="не задано" value={form.surchargeWithHolesPct ?? ''} onChange={e => set('surchargeWithHolesPct', e.target.value ? +e.target.value : null)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Закупочная (₽/м²)</label>
                <Input type="number" placeholder="не задано" value={form.costPriceWithHoles ?? ''} onChange={e => set('costPriceWithHoles', e.target.value ? +e.target.value : null)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Продажная (₽/м²)</label>
                <Input type="number" placeholder="не задано" value={form.sellingPriceWithHoles ?? ''} onChange={e => set('sellingPriceWithHoles', e.target.value ? +e.target.value : null)} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 border rounded p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">С вырезами</span>
            <div className="flex gap-1 text-xs">
              <button onClick={() => setCutsMode('pct')} className={`px-2 py-0.5 rounded ${cutsMode === 'pct' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>% надбавка</button>
              <button onClick={() => setCutsMode('fixed')} className={`px-2 py-0.5 rounded ${cutsMode === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Фикс. цена</button>
            </div>
          </div>
          {cutsMode === 'pct' ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Надбавка (%)</label>
              <Input type="number" placeholder="не задано" value={form.surchargeWithCutsPct ?? ''} onChange={e => set('surchargeWithCutsPct', e.target.value ? +e.target.value : null)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Закупочная (₽/м²)</label>
                <Input type="number" placeholder="не задано" value={form.costPriceWithCuts ?? ''} onChange={e => set('costPriceWithCuts', e.target.value ? +e.target.value : null)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Продажная (₽/м²)</label>
                <Input type="number" placeholder="не задано" value={form.sellingPriceWithCuts ?? ''} onChange={e => set('sellingPriceWithCuts', e.target.value ? +e.target.value : null)} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Фикс. доставка (₽)</label>
          <Input type="number" value={form.deliveryCostFixed} onChange={e => set('deliveryCostFixed', +e.target.value)} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
          <label htmlFor="isActive" className="text-sm">Активен</label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={busy || !form.coating}>{busy ? 'Сохранение...' : 'Сохранить'}</Button>
        </div>
      </div>
    </div>
  )
}

export default function GlassTypesTab() {
  const { data: types = [] } = useGlassTypes()
  const deleteType = useDeleteGlassType()
  const [editing, setEditing] = useState<GlassType | null | 'new'>(null)

  const grouped = types.reduce<Record<string, GlassType[]>>((acc, t) => {
    const key = `${t.glassKind} — ${t.coating}`
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Типы стекла используются при расчёте стоимости стёкол в системах.</p>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus size={14} className="mr-1" />Добавить
        </Button>
      </div>

      {types.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <FileText size={40} />
          <p className="text-sm">Типы стекла не добавлены. Нажмите «Добавить» чтобы создать первый тип.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([groupName, items]) => (
            <div key={groupName} className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 text-sm font-medium">{groupName}</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left p-3">Толщина</th>
                    <th className="text-right p-3">Закупка ₽/м²</th>
                    <th className="text-right p-3">Продажа ₽/м²</th>
                    <th className="text-right p-3">С вырезами</th>
                    <th className="text-right p-3">С отверстиями</th>
                    <th className="text-center p-3">Статус</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.sort((a, b) => a.thickness - b.thickness).map(t => (
                    <tr key={t.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{t.thickness} мм</td>
                      <td className="p-3 text-right font-mono">{Number(t.costPricePerSqm).toLocaleString('ru')} ₽</td>
                      <td className="p-3 text-right font-mono">{Number(t.sellingPricePerSqm).toLocaleString('ru')} ₽</td>
                      <td className="p-3 text-right text-muted-foreground">
                        {t.costPriceWithCuts != null ? `${Number(t.costPriceWithCuts).toLocaleString('ru')} ₽`
                          : t.surchargeWithCutsPct != null ? `+${t.surchargeWithCutsPct}%` : '—'}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {t.costPriceWithHoles != null ? `${Number(t.costPriceWithHoles).toLocaleString('ru')} ₽`
                          : t.surchargeWithHolesPct != null ? `+${t.surchargeWithHolesPct}%` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                          {t.isActive ? 'активен' : 'неактивен'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setEditing(t)} className="p-1 hover:text-primary"><Pencil size={13} /></button>
                          <button onClick={() => deleteType.mutate(t.id)} className="p-1 hover:text-destructive"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <GlassTypeDialog
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
