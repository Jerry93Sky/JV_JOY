import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { rationalToDecimalExact, type ExactRational, type UnifiedFamily } from '@bms/shared/jv'
import { calculateJvPreview, canCalculateJv, getJvUiConfig, type JvPreviewResponse, type JvUiConfig, type JvUiValue } from '@/api/jv'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const families: { value: UnifiedFamily; label: string }[] = [
  { value: 'LINE', label: 'JV-Line' }, { value: 'ZIGZAG', label: 'JV-Zigzag' },
  { value: 'SLIDER_L3', label: 'Slider L3' }, { value: 'SLIDER_L5', label: 'Slider L5' },
  { value: 'SLIDER_X3', label: 'Slider X3' }, { value: 'SLIDER_X5', label: 'Slider X5' },
  { value: 'FRONT', label: 'JV-Front' },
]
type DraftPosition = { id: string; family: UnifiedFamily; slot: number; quantity: string; inputs: Record<string, JvUiValue> }
type Profile = 'COMPLETATION' | 'RETAIL'
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
const labels: Record<string, string> = {
  widthMm: 'Ширина, мм', heightMm: 'Высота, мм', leaves: 'Количество створок', leafCount: 'Количество створок', leafSelector: 'Количество створок', sectionDemand: 'Количество секций',
  openingSelector: 'Вариант открывания', direction: 'Направление открывания', sideCount: 'Количество сторон', profileCount: 'Количество профилей', connectorAngle: 'Угол соединения, °',
  glassSelectionIndex: 'Вариант стекла', glassSelector: 'Вариант стекла', glassTypeSelector: 'Вариант стекла', finishSelectionIndex: 'Вариант отделки', finishSelector: 'Вариант отделки', commercialModeIndex: 'Режим расчёта', priceMode: 'Режим расчёта', mainSurchargeSelector: 'Режим надбавки', F28: 'Режим надбавки',
  frameState: 'Монтажная рама', knobState: 'Ручка-кноб', latchState: 'Защёлка', weatherSealState: 'Уплотнитель', floorLockState: 'Замок в пол', bottomPivotState: 'Напольный доводчик', specialSashEnabled: 'Специальное полотно', specialSashWidthMm: 'Ширина специального полотна, мм', rollerAxisToEdgeMm: 'Ось ролика до края, мм', parkedDoorSelected: 'Паркуемая дверь', parkedDoorPosition: 'Позиция паркуемой двери', parkedDoorReuseOpening: 'Использовать ширину проёма', parkedDoorWidthMm: 'Ширина паркуемой двери, мм',
  interlockState: 'Замковый профиль', meetingSealState: 'Уплотнение притвора', jointPairSelection: 'Выбор пары соединений', glassEnabled: 'Стекло', finishingEnabled: 'Отделка', glassServiceEnabled: 'Обработка стекла', installationEnabled: 'Монтаж', frameOverrideIndex: 'Вариант рамы', c8: 'Параметр комплектации C8', N40: 'Ручное количество N40', N41: 'Ручное количество N41', D18: 'Размер D18, мм', D19: 'Размер D19, мм', C18: 'Выбор ширины двери', C19: 'Выбор высоты двери', C20: 'Примыкание двери', C21: 'Вариант доводчика', C22: 'Вариант ручки', C23: 'Вариант замка', C24: 'Вариант дополнительного замка',
}
const keyOf = (path: string) => { const parts = path.split('.'); return parts[parts.length - 1] || path }
const fieldLabel = (path: string) => labels[keyOf(path)] ?? `Выбор ${path}`
const exact = (value?: ExactRational) => value ? rationalToDecimalExact(value) ?? `${value.numerator}/${value.denominator}` : 'не подтверждено'
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const glassNames = ['6 мм прозрачное','6 мм осветлённое','6 мм тонированное','6 мм матовое','8 мм прозрачное','8 мм осветлённое','8 мм тонированное','8 мм матовое','10 мм прозрачное','10 мм осветлённое','10 мм тонированное','10 мм матовое']
function optionLabel(path: string, option: JvUiValue): string {
  const key = keyOf(path)
  if (typeof option === 'number' && ['glassSelectionIndex','glassSelector','glassTypeSelector'].includes(key)) return glassNames[option - 1] ?? String(option)
  if (typeof option === 'number' && ['finishSelectionIndex','finishSelector','priceMode'].includes(key)) return ['Некрашеное','Глянец','Матовый','Муар'][option - 1] ?? String(option)
  if (path === 'construction.controls.C20' && typeof option === 'number') return ['Стекло — дверь — стекло','Стена — дверь — стекло','Стена — дверь — стена'][option - 1] ?? String(option)
  return String(option)
}

function choices(path: string, value: JvUiValue, family: UnifiedFamily): JvUiValue[] | null {
  const key = keyOf(path)
  if (typeof value === 'boolean') return null
  if (key === 'direction') return ['НАЛЕВО', 'НАПРАВО', 'ДВУХСТОР']
  if (typeof value === 'string' && (value === 'ДА' || value === 'НЕТ')) return ['ДА', 'НЕТ']
  if (key === 'sideCount') return ['1', '2']
  if (key === 'connectorAngle') return ['90', '135']
  if (key === 'frameOverrideIndex' || key === 'overrideIndex') return [1, 2]
  if (key === 'openingSelector') return family === 'FRONT' ? [1, 2, 3, 4] : [1, 2, 3]
  if (['glassSelectionIndex','glassSelector','glassTypeSelector'].includes(key)) return Array.from({ length: 12 }, (_, i) => i + 1)
  if (['finishSelectionIndex','finishSelector','priceMode'].includes(key)) return [1, 2, 3, 4]
  if (key === 'mainSurchargeSelector' || key === 'F28') return [1, 2]
  if (family === 'FRONT' && path === 'construction.controls.C18') return [1, 2]
  if (family === 'FRONT' && path === 'construction.controls.C19') return [1, 2]
  if (family === 'FRONT' && path === 'construction.controls.C20') return [1, 2, 3]
  // Other selectors are kept at their source-backed example value until their choices are mapped.
  if (typeof value === 'number') return [value]
  if (key === 'jointPairSelection') return [value]
  return null
}
function fieldDisabled(path: string, inputs: Record<string, JvUiValue>): boolean {
  if (path === 'input.specialSashWidthMm') return inputs['input.specialSashEnabled'] !== true
  if (path === 'input.parkedDoorPosition' || path === 'input.parkedDoorReuseOpening') return inputs['input.parkedDoorSelected'] !== true
  if (path === 'input.parkedDoorWidthMm') return inputs['input.parkedDoorSelected'] !== true || inputs['input.parkedDoorReuseOpening'] !== true
  if (path === 'construction.controls.D18') return inputs['construction.controls.C18'] !== 2
  if (path === 'construction.controls.D19') return inputs['construction.controls.C19'] !== 2
  return false
}

export default function JVOrderPage() {
  const role = useAuthStore(s => s.user?.role)
  const [positions, setPositions] = useState<DraftPosition[]>([])
  const [profile, setProfile] = useState<Profile>('COMPLETATION')
  const [config, setConfig] = useState<JvUiConfig | null>(null)
  const [result, setResult] = useState<JvPreviewResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const generation = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  const allowed = canCalculateJv(role)

  function invalidate() { generation.current++; activeRequest.current?.abort(); activeRequest.current = null; setLoading(false); setResult(null); setError('') }
  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    setConfig(null)
    getJvUiConfig(profile, controller.signal).then(value => {
      if (controller.signal.aborted) return
      setConfig(value)
      setPositions(old => old.map(p => ({ ...p, inputs: Object.fromEntries(Object.entries(value.families[p.family]).map(([path, initial]) => [path, typeof p.inputs[path] === typeof initial ? p.inputs[path] : initial])) })))
    }).catch(e => { if (!controller.signal.aborted) setError(axios.isAxiosError(e) && e.response?.status === 403 ? 'Недостаточно прав для расчёта.' : 'Не удалось загрузить параметры форм.') })
    return () => controller.abort()
  }, [profile, allowed])
  useEffect(() => () => { generation.current++; activeRequest.current?.abort() }, [])

  if (!allowed) return <div role="alert" className="rounded-lg border p-5">Раздел JV-заказов доступен владельцу и администратору.</div>

  function add(copy?: DraftPosition) {
    if (!config) return
    const used = new Set(positions.map(p => p.slot)), slot = [1, 2, 3, 4, 5, 6, 7].find(s => !used.has(s))
    if (!slot) return
    invalidate()
    setPositions(old => [...old, { id: crypto.randomUUID(), slot, family: copy?.family ?? 'LINE', quantity: copy?.quantity ?? '1', inputs: { ...(copy?.inputs ?? config.families.LINE) } }])
  }
  function update(id: string, change: Partial<Pick<DraftPosition, 'slot' | 'family' | 'quantity' | 'inputs'>>) {
    invalidate(); setPositions(old => old.map(p => p.id === id ? { ...p, ...change } : p))
  }
  function move(index: number, delta: number) {
    setPositions(old => { const next = [...old], target = index + delta; if (target < 0 || target >= next.length) return old; [next[index], next[target]] = [next[target], next[index]]; return next })
  }
  async function calculate() {
    if (!config || !positions.length) return
    for (const p of positions) {
      if (!/^[1-9]\d{0,5}$/.test(p.quantity)) { setError(`Слот ${p.slot}: количество должно быть целым от 1 до 999999.`); return }
      for (const [path, value] of Object.entries(p.inputs)) {
        const key = keyOf(path)
        if (typeof value === 'string' && ['widthMm','heightMm','leaves','leafCount','leafSelector','sectionDemand','sideCount','profileCount','connectorAngle','specialSashWidthMm','rollerAxisToEdgeMm','parkedDoorPosition','parkedDoorWidthMm','D18','D19','N40','N41','c8'].includes(key) && (!decimal.test(value) || value.length > 64 || (value.split('.')[1]?.length ?? 0) > 30)) { setError(`Слот ${p.slot}: проверьте поле «${fieldLabel(path)}».`); return }
        if (typeof value === 'string' && ['widthMm','heightMm','leaves','leafCount','leafSelector','sectionDemand'].includes(key) && (value.startsWith('-') || !/[1-9]/.test(value))) { setError(`Слот ${p.slot}: поле «${fieldLabel(path)}» должно быть больше нуля.`); return }
      }
    }
    invalidate(); const requestGeneration = generation.current, controller = new AbortController(); activeRequest.current = controller; setLoading(true)
    try {
      const response = await calculateJvPreview({ profile, rulesVersion: config.rulesVersion, uiSchemaVersion: config.schemaVersion, positions: positions.map(p => ({ id: p.id, family: p.family, slot: p.slot, quantity: p.quantity, calculation: p.inputs })) }, controller.signal)
      if (generation.current === requestGeneration && !controller.signal.aborted) setResult(response)
    } catch (e) {
      if (generation.current !== requestGeneration || controller.signal.aborted) return
      if (axios.isAxiosError(e)) {
        const status = e.response?.status
        const issues = e.response?.data?.error?.issues
        const details = Array.isArray(issues) ? issues.filter((x): x is string => typeof x === 'string').slice(0, 5).join('; ') : ''
        setError(status === 400 || status === 422 ? `Проверьте параметры конструкций: сервер отклонил ввод. ${details}` : status === 401 ? 'Сессия истекла. Войдите снова.' : status === 403 ? 'Недостаточно прав для расчёта.' : status === 409 ? 'Версия правил или настроек изменилась. Обновите страницу.' : status ? 'Ошибка сервера расчёта.' : 'Нет соединения с сервером.')
      } else setError('Не удалось выполнить расчёт.')
    } finally { if (generation.current === requestGeneration) { activeRequest.current = null; setLoading(false) } }
  }

  return <div className="mx-auto max-w-5xl space-y-5 pb-8">
    <header><h1 className="text-2xl font-semibold">Новый JV-заказ</h1><p className="mt-1 text-sm text-muted-foreground">Черновик хранится только в текущем сеансе.</p></header>
    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">Начальные значения получены из контрольного сценария выбранного профиля. Проверьте параметры каждой конструкции перед расчётом. Некоторые переключатели пока доступны только в подтверждённом варианте.</p>
    <label className="block max-w-xs space-y-1 text-sm">Ценовой профиль<select className={selectClass} value={profile} onChange={e => { invalidate(); setConfig(null); setProfile(e.target.value as Profile) }}><option value="COMPLETATION">Комплектация</option><option value="RETAIL">Розница</option></select></label>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium">Конструкции ({positions.length}/7)</h2><Button onClick={() => add()} disabled={!config || positions.length >= 7}>Добавить конструкцию</Button></div>
    {positions.length === 7 && <p className="text-sm text-muted-foreground">Все семь слотов заняты. Для новой позиции удалите одну из существующих.</p>}
    {positions.length === 0 && <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Добавьте первую конструкцию. Доступно до семи отдельных слотов.</p>}
    {positions.map((p, index) => <section key={p.id} className="space-y-4 rounded-lg border bg-card p-4">
      <h3 className="font-medium">Позиция {index + 1} · слот {p.slot}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">Семейство<select className={selectClass} value={p.family} onChange={e => { const family = e.target.value as UnifiedFamily; if (config) update(p.id, { family, inputs: { ...config.families[family] } }) }}>{families.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
        <label className="space-y-1 text-sm">Слот<select className={selectClass} value={p.slot} onChange={e => update(p.id, { slot: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(s => <option key={s} value={s} disabled={s !== p.slot && positions.some(other => other.slot === s)}>{s}</option>)}</select></label>
        <label className="space-y-1 text-sm">Количество, шт.<Input inputMode="numeric" value={p.quantity} aria-invalid={!/^[1-9]\d{0,5}$/.test(p.quantity)} onChange={e => update(p.id, { quantity: e.target.value })}/></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(p.inputs).map(([path, value]) => {
        const options = choices(path, value, p.family)
        const disabled = fieldDisabled(path, p.inputs)
        return <label key={path} className="space-y-1 text-sm"><span className="block">{fieldLabel(path)}</span>{typeof value === 'boolean' ? <input type="checkbox" checked={value} disabled={disabled} onChange={e => update(p.id, { inputs: { ...p.inputs, [path]: e.target.checked } })}/> : options ? <select className={selectClass} value={String(value)} disabled={disabled || options.length === 1} onChange={e => update(p.id, { inputs: { ...p.inputs, [path]: typeof value === 'number' ? Number(e.target.value) : e.target.value } })}>{options.map(option => <option key={String(option)} value={String(option)}>{optionLabel(path, option)}</option>)}</select> : <Input value={String(value)} inputMode="decimal" disabled={disabled} onChange={e => update(p.id, { inputs: { ...p.inputs, [path]: e.target.value } })}/>}</label>
      })}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => move(index, -1)} disabled={index === 0}>Выше</Button><Button variant="outline" onClick={() => move(index, 1)} disabled={index === positions.length - 1}>Ниже</Button><Button variant="outline" onClick={() => add(p)} disabled={positions.length >= 7}>Дублировать</Button><Button variant="outline" onClick={() => { invalidate(); setPositions(old => old.filter(item => item.id !== p.id)) }}>Удалить</Button></div>
    </section>)}
    <Button onClick={calculate} disabled={!config || !positions.length || loading}>{loading ? 'Выполняется расчёт…' : 'Рассчитать'}</Button>
    {error && <p role="alert" className="rounded border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    {result && <section className="space-y-3 rounded-lg border p-4" aria-live="polite"><h2 className="text-lg font-medium">{result.status === 'COMPLETE' ? 'Расчёт завершён' : 'Частичный расчёт'}</h2><p>Профиль: {result.profile === 'COMPLETATION' ? 'Комплектация' : 'Розница'} · позиций: {result.calculation.positions.length} · конструкций: {positions.reduce((sum, p) => sum + Number(p.quantity), 0)}</p>{result.status === 'COMPLETE' && result.calculation.status === 'COMPLETE' && result.calculation.totalSalePrice ? <p className="text-xl font-semibold">Итог: {exact(result.calculation.totalSalePrice)} ₽</p> : <p>Итоговая цена не подтверждена.</p>}{result.calculation.positions.map(p => <div key={p.id} className="rounded border p-3"><div>Слот {p.slot} · {families.find(f => f.value === p.family)?.label} · количество {exact(p.quantity)} · {p.status}</div>{p.confirmedUnitAmount && <div>Подтверждённая цена за конструкцию: {exact(p.confirmedUnitAmount)} ₽</div>}{p.diagnostics.map((d, i) => <p key={i} className="text-sm text-muted-foreground">{d}</p>)}</div>)}{result.calculation.diagnostics.map((d, i) => <p key={i} className="text-sm text-muted-foreground">{d}</p>)}</section>}
  </div>
}
