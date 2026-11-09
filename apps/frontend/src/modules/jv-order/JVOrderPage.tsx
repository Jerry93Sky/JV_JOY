import { useState } from 'react'
import type { UnifiedFamily } from '@bms/shared/jv'
import { canCalculateJv } from '@/api/jv'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const families: { value: UnifiedFamily; label: string }[] = [
  { value: 'LINE', label: 'JV-Line' }, { value: 'ZIGZAG', label: 'JV-Zigzag' },
  { value: 'SLIDER_L3', label: 'Slider L3' }, { value: 'SLIDER_L5', label: 'Slider L5' },
  { value: 'SLIDER_X3', label: 'Slider X3' }, { value: 'SLIDER_X5', label: 'Slider X5' },
  { value: 'FRONT', label: 'JV-Front' },
]
type DraftPosition = { id: string; family: UnifiedFamily; slot: number; quantity: string }
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'

export default function JVOrderPage() {
  const role = useAuthStore(s => s.user?.role)
  const [positions, setPositions] = useState<DraftPosition[]>([])
  const [profile, setProfile] = useState<'COMPLETATION' | 'RETAIL'>('COMPLETATION')
  const [notice, setNotice] = useState('')

  if (!canCalculateJv(role)) return <div role="alert" className="rounded-lg border p-5">Раздел JV-заказов доступен владельцу и администратору.</div>

  function add(copy?: DraftPosition) {
    const used = new Set(positions.map(p => p.slot))
    const slot = [1, 2, 3, 4, 5, 6, 7].find(s => !used.has(s))
    if (!slot) { setNotice('Доступно не более семи позиций: все слоты заняты.'); return }
    setPositions(old => [...old, { id: crypto.randomUUID(), slot, family: copy?.family ?? 'LINE', quantity: copy?.quantity ?? '1' }])
    setNotice('')
  }
  function update(id: string, change: Partial<Pick<DraftPosition, 'slot' | 'family' | 'quantity'>>) {
    setPositions(old => old.map(p => p.id === id ? { ...p, ...change } : p))
  }
  function move(index: number, delta: number) {
    setPositions(old => {
      const next = [...old], target = index + delta
      if (target < 0 || target >= next.length) return old
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return <div className="mx-auto max-w-5xl space-y-5 pb-8">
    <header><h1 className="text-2xl font-semibold">Новый JV-заказ</h1><p className="mt-1 text-sm text-muted-foreground">Черновик в текущем сеансе. Сохранение заказов пока не поддерживается.</p></header>
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="status">Редактор находится в разработке. Формы параметров и расчёт через сервер ещё не подключены; цена не формируется.</div>
    <label className="block max-w-xs space-y-1 text-sm">Ценовой профиль
      <select className={selectClass} value={profile} onChange={e => setProfile(e.target.value as 'COMPLETATION' | 'RETAIL')}>
        <option value="COMPLETATION">Комплектация</option><option value="RETAIL">Розница</option>
      </select>
    </label>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium">Конструкции ({positions.length}/7)</h2><Button onClick={() => add()} disabled={positions.length >= 7}>Добавить конструкцию</Button></div>
    {positions.length === 7 && <p className="text-sm text-muted-foreground">Все семь слотов заняты. Для новой позиции удалите одну из существующих.</p>}
    {notice && <p role="alert" className="text-sm text-destructive">{notice}</p>}
    {positions.length === 0 && <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Добавьте первую конструкцию. Доступно до семи отдельных слотов.</p>}
    {positions.map((p, index) => <section key={p.id} className="space-y-4 rounded-lg border bg-card p-4">
      <h3 className="font-medium">Позиция {index + 1} · слот {p.slot}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">Семейство<select className={selectClass} value={p.family} onChange={e => update(p.id, { family: e.target.value as UnifiedFamily })}>{families.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
        <label className="space-y-1 text-sm">Слот<select className={selectClass} value={p.slot} onChange={e => update(p.id, { slot: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(s => <option key={s} value={s} disabled={s !== p.slot && positions.some(other => other.slot === s)}>{s}</option>)}</select></label>
        <label className="space-y-1 text-sm">Количество, шт.<Input inputMode="numeric" value={p.quantity} aria-invalid={!/^[1-9]\d{0,5}$/.test(p.quantity)} onChange={e => update(p.id, { quantity: e.target.value })}/>{!/^[1-9]\d{0,5}$/.test(p.quantity) && <span className="block text-xs text-destructive">Введите целое число от 1 до 999999.</span>}</label>
      </div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => move(index, -1)} disabled={index === 0}>Выше</Button><Button variant="outline" onClick={() => move(index, 1)} disabled={index === positions.length - 1}>Ниже</Button><Button variant="outline" onClick={() => add(p)} disabled={positions.length >= 7}>Дублировать</Button><Button variant="outline" onClick={() => setPositions(old => old.filter(item => item.id !== p.id))}>Удалить</Button></div>
    </section>)}
    <Button disabled>Рассчитать</Button>
  </div>
}
