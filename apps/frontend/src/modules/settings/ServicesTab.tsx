import { useState } from 'react'
import { Plus, Pencil, Power, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useServices, useCreateService, useUpdateService } from '@/api/settings'

interface ServiceForm {
  id?: string
  name: string
  priceType: 'fixed' | 'formula'
  price: string
  priceFormula: string
  unit: string
}

const FORMULA_HINTS = [
  { label: 'По ширине проёма (за п.м.)', formula: 'width / 1000 * 1500' },
  { label: 'По периметру', formula: '(width + height) * 2 / 1000 * 800' },
  { label: 'По площади', formula: 'width * height / 1000000 * 2000' },
  { label: 'По кол-ву створок', formula: 'panels * 500' },
]

export default function ServicesTab() {
  const { data: services = [] } = useServices()
  const create = useCreateService()
  const update = useUpdateService()
  const [modal, setModal] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const [form, setForm] = useState<ServiceForm>({ name: '', priceType: 'fixed', price: '', priceFormula: '', unit: 'шт' })

  function openCreate() {
    setForm({ name: '', priceType: 'fixed', price: '', priceFormula: '', unit: 'шт' })
    setModal(true)
  }

  function openEdit(s: { id: string; name: string; price?: number | null; priceFormula?: string | null; unit?: string }) {
    setForm({
      id: s.id,
      name: s.name,
      priceType: s.priceFormula ? 'formula' : 'fixed',
      price: s.price != null ? String(s.price) : '',
      priceFormula: s.priceFormula || '',
      unit: s.unit || 'шт',
    })
    setModal(true)
  }

  async function handleSave() {
    const data = {
      name: form.name,
      unit: form.unit,
      price: form.priceType === 'fixed' && form.price ? parseFloat(form.price) : undefined,
      priceFormula: form.priceType === 'formula' ? form.priceFormula : undefined,
    }
    if (form.id) await update.mutateAsync({ id: form.id, ...data })
    else await create.mutateAsync(data)
    setModal(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus size={15} className="mr-1" />Добавить услугу</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Название</th>
              <th className="text-left px-4 py-2 font-medium">Цена / Формула</th>
              <th className="text-left px-4 py-2 font-medium">Ед.</th>
              <th className="text-left px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {services.map(s => (
              <tr key={s.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2">
                  {s.priceFormula ? (
                    <span className="font-mono text-xs bg-purple-500/15 border border-purple-500/25 px-2 py-0.5 rounded text-purple-300">{s.priceFormula}</span>
                  ) : (
                    <span>{s.price != null ? `${Number(s.price).toLocaleString('ru-RU')} ₽` : '—'}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{s.unit}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs ${s.isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {s.isActive ? 'Активна' : 'Отключена'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => update.mutate({ id: s.id, isActive: !s.isActive })}>
                      <Power size={14} className={s.isActive ? 'text-green-500' : 'text-muted-foreground'} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Услуг нет</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Dialog open onOpenChange={() => setModal(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{form.id ? 'Редактировать услугу' : 'Новая услуга'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Название *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Единица измерения</label>
                <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="шт, п.м., кв.м..." className="w-32" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Тип цены</label>
                <div className="flex gap-2 mt-1">
                  <button type="button"
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${form.priceType === 'fixed' ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}
                    onClick={() => setForm(f => ({ ...f, priceType: 'fixed' }))}>
                    Фиксированная
                  </button>
                  <button type="button"
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${form.priceType === 'formula' ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}
                    onClick={() => setForm(f => ({ ...f, priceType: 'formula' }))}>
                    По формуле
                  </button>
                </div>
              </div>

              {form.priceType === 'fixed' ? (
                <div>
                  <label className="text-xs text-muted-foreground">Цена ₽</label>
                  <Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">Формула расчёта цены</label>
                    <button type="button" onClick={() => setShowHints(!showHints)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <HelpCircle size={13} />Примеры
                    </button>
                  </div>
                  <Input value={form.priceFormula} onChange={e => setForm(f => ({ ...f, priceFormula: e.target.value }))}
                    placeholder="width / 1000 * 1500" className="font-mono text-xs" />
                  {showHints && (
                    <div className="mt-2 border rounded-md overflow-hidden">
                      {FORMULA_HINTS.map(h => (
                        <button key={h.formula} type="button"
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted border-b last:border-0"
                          onClick={() => { setForm(f => ({ ...f, priceFormula: h.formula })); setShowHints(false) }}>
                          <div className="text-muted-foreground">{h.label}</div>
                          <div className="font-mono text-purple-300">{h.formula}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Доступные переменные из системы: <span className="font-mono">width, height, panels, glassArea</span> и любые другие параметры системы.
                    При добавлении услуги в заказ цена рассчитается автоматически.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setModal(false)}>Отмена</Button>
                <Button onClick={handleSave} disabled={create.isPending || update.isPending}>Сохранить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
