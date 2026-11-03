import { useState } from 'react'
import { TrendingUp, Receipt, BarChart3, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFinanceSummary, useExpenses, useExpenseCategories, useCreateExpense, useCreateExpenseCategory, useAnalytics } from '@/api/finance'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

type Tab = 'summary' | 'expenses' | 'analytics' | 'services'

function fmt(n: number) { return n.toLocaleString('ru-RU') }
function fmtDate(d: Date) { return format(d, 'yyyy-MM-dd') }

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('summary')
  const now = new Date()
  const [from, setFrom] = useState(fmtDate(startOfMonth(now)))
  const [to, setTo] = useState(fmtDate(endOfMonth(now)))
  const [compareMode, setCompareMode] = useState(false)
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo] = useState('')

  const tabs = [
    { id: 'summary' as Tab, label: 'Сводка', icon: TrendingUp },
    { id: 'expenses' as Tab, label: 'Расходы', icon: Receipt },
    { id: 'analytics' as Tab, label: 'Аналитика', icon: BarChart3 },
    { id: 'services' as Tab, label: 'Расч. vs Факт.', icon: TrendingUp },
  ]

  // Автозаполнение периода сравнения при включении
  function toggleCompare() {
    if (!compareMode) {
      const d1 = new Date(from), d2 = new Date(to)
      const diff = d2.getTime() - d1.getTime()
      const cf = new Date(d1.getTime() - diff - 86400000)
      const ct = new Date(d1.getTime() - 86400000)
      setCompareFrom(fmtDate(cf))
      setCompareTo(fmtDate(ct))
    }
    setCompareMode(!compareMode)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Финансы</h1>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex border rounded-md overflow-hidden">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${tab === id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="text-muted-foreground">Период:</span>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 h-8" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36 h-8" />
          <Button size="sm" variant="outline" onClick={() => { setFrom(fmtDate(startOfMonth(now))); setTo(fmtDate(endOfMonth(now))) }}>Месяц</Button>
          <Button size="sm" variant="outline" onClick={() => { setFrom(fmtDate(startOfYear(now))); setTo(fmtDate(endOfYear(now))) }}>Год</Button>
          {tab === 'summary' && (
            <Button size="sm" variant={compareMode ? 'default' : 'outline'} onClick={toggleCompare}>
              Сравнить периоды
            </Button>
          )}
        </div>
        {compareMode && tab === 'summary' && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Сравнить с:</span>
            <Input type="date" value={compareFrom} onChange={e => setCompareFrom(e.target.value)} className="w-36 h-8" />
            <span className="text-muted-foreground">—</span>
            <Input type="date" value={compareTo} onChange={e => setCompareTo(e.target.value)} className="w-36 h-8" />
          </div>
        )}
      </div>

      {tab === 'summary' && <SummaryTab from={from} to={to} compareFrom={compareMode ? compareFrom : undefined} compareTo={compareMode ? compareTo : undefined} />}
      {tab === 'expenses' && <ExpensesTab from={from} to={to} />}
      {tab === 'analytics' && <AnalyticsTab from={from} to={to} />}
      {tab === 'services' && <ServicesComparisonTab from={from} to={to} />}
    </div>
  )
}

function SummaryTab({ from, to, compareFrom, compareTo }: { from: string; to: string; compareFrom?: string; compareTo?: string }) {
  const { data, isLoading } = useFinanceSummary(from, to, compareFrom, compareTo)
  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка...</div>
  if (!data) return null

  const main = data.main
  const compare = data.compare

  function diff(a: number, b: number) {
    if (!b) return null
    const pct = Math.round(((a - b) / b) * 100)
    return <span className={`text-xs ml-1 ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pct >= 0 ? '+' : ''}{pct}%</span>
  }

  const cards = [
    { label: 'Валовой доход', key: 'grossRevenue' as const, color: 'text-green-400' },
    { label: 'Себестоимость', key: 'costOfGoods' as const, color: 'text-red-400' },
    { label: 'Валовая прибыль', key: 'grossProfit' as const, color: main.grossProfit >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: 'Расходы', key: 'totalExpenses' as const, color: 'text-amber-400' },
    { label: 'Чистая прибыль', key: 'netProfit' as const, color: main.netProfit >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: 'Маржинальность', key: 'margin' as const, color: 'text-blue-600', suffix: '%' },
    { label: 'Налоговая нагрузка (УСН 6%)', key: 'taxLoad' as const, color: 'text-purple-600' },
    { label: 'Сделок за период', key: 'dealsCount' as const, color: '', noRub: true },
  ]

  return (
    <div className="space-y-4">
      {compare && (
        <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-1.5">
          Сравнение: основной период vs {compareFrom} — {compareTo}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="border rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
            <div className={`text-xl font-bold ${c.color}`}>
              {fmt(main[c.key])}{!c.noRub && c.key !== 'margin' ? ' ₽' : c.suffix || ''}
              {compare && diff(main[c.key] as number, compare[c.key] as number)}
            </div>
            {compare && (
              <div className="text-xs text-muted-foreground mt-0.5">
                пред.: {fmt(compare[c.key])}{!c.noRub && c.key !== 'margin' ? ' ₽' : c.suffix || ''}
              </div>
            )}
          </div>
        ))}
      </div>

      {Object.keys(main.expensesByCategory).length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-medium text-sm mb-3">Расходы по категориям</h3>
          <div className="space-y-2">
            {Object.entries(main.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{cat}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{fmt(amount)} ₽</span>
                  {compare && compare.expensesByCategory[cat] && diff(amount, compare.expensesByCategory[cat])}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ExpensesTab({ from, to }: { from: string; to: string }) {
  const { data: expenses = [], isLoading } = useExpenses(from, to)
  const { data: categories = [] } = useExpenseCategories()
  const createExpense = useCreateExpense()
  const createCategory = useCreateExpenseCategory()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ categoryId: '', amount: '', comment: '', dealNumber: '', newCatName: '' })
  const [addingCat, setAddingCat] = useState(false)

  async function handleSave() {
    if (!form.categoryId || !form.amount) return
    await createExpense.mutateAsync({ categoryId: form.categoryId, amount: parseFloat(form.amount), comment: form.comment || undefined })
    setModal(false)
    setForm({ categoryId: '', amount: '', comment: '', dealNumber: '', newCatName: '' })
  }

  async function handleAddCat() {
    if (!form.newCatName.trim()) return
    const cat = await createCategory.mutateAsync(form.newCatName.trim())
    setForm(f => ({ ...f, categoryId: cat.id, newCatName: '' }))
    setAddingCat(false)
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setModal(true)}><Plus size={15} className="mr-1" />Оформить расход</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Дата</th>
              <th className="text-left px-4 py-2 font-medium">Категория</th>
              <th className="text-left px-4 py-2 font-medium">Комментарий</th>
              <th className="text-left px-4 py-2 font-medium">Заказ</th>
              <th className="text-right px-4 py-2 font-medium">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Загрузка...</td></tr>}
            {expenses.map(e => (
              <tr key={e.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground">{format(new Date(e.date), 'dd.MM.yyyy')}</td>
                <td className="px-4 py-2">{e.category.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.comment || '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.deal ? `#${e.deal.number}` : '—'}</td>
                <td className="px-4 py-2 text-right font-medium">{fmt(Number(e.amount))} ₽</td>
              </tr>
            ))}
            {!isLoading && expenses.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Расходов нет</td></tr>}
            {expenses.length > 0 && (
              <tr className="border-t bg-muted/50 font-semibold">
                <td colSpan={4} className="px-4 py-2 text-right">Итого:</td>
                <td className="px-4 py-2 text-right">{fmt(total)} ₽</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Dialog open onOpenChange={() => setModal(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Оформить расход</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Категория *</label>
                {addingCat ? (
                  <div className="flex gap-2">
                    <Input value={form.newCatName} onChange={e => setForm(f => ({ ...f, newCatName: e.target.value }))} placeholder="Название категории" autoFocus />
                    <Button size="sm" onClick={handleAddCat}>+</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingCat(false)}>✕</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="">Выберите категорию</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button size="sm" variant="outline" onClick={() => setAddingCat(true)}>+ Новая</Button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Сумма ₽ *</label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Комментарий</label>
                <Input value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModal(false)}>Отмена</Button>
                <Button onClick={handleSave} disabled={createExpense.isPending}>Сохранить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function AnalyticsTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useAnalytics(from, to)
  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка...</div>
  if (!data) return null

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-sm mb-3">Топ систем</h3>
        {data.topSystems.length === 0 && <p className="text-xs text-muted-foreground">Нет данных</p>}
        {data.topSystems.map((s, i) => (
          <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
            <span className="text-muted-foreground truncate">{s.name}</span>
            <span className="font-medium ml-2 shrink-0">{s.count} шт.</span>
          </div>
        ))}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-sm mb-3">Цвета покраски</h3>
        {data.paintColors.length === 0 && <p className="text-xs text-muted-foreground">Нет данных</p>}
        {data.paintColors.map((c, i) => (
          <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
            <span className="font-mono text-muted-foreground">{c.color}</span>
            <span className="font-medium">{c.count} раз</span>
          </div>
        ))}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-sm mb-3">Топ комплектующих</h3>
        {data.topProducts.length === 0 && <p className="text-xs text-muted-foreground">Нет данных</p>}
        {data.topProducts.map((p, i) => (
          <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
            <span className="text-muted-foreground truncate">{p.name}</span>
            <span className="font-medium ml-2 shrink-0">{Math.round(p.totalQty)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ServicesComparisonTab({ from, to }: { from: string; to: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['finance', 'services-comparison', from, to],
    queryFn: () => api.get<{ name: string; estimated: number; actual: number; diff: number }[]>('/finance/services-comparison', { params: { from, to } }).then(r => r.data),
    enabled: !!from && !!to,
  })

  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка...</div>

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Сравнение расчётных расходов на услуги (из сделок) с фактическими (из раздела Расходы).
        Красный — фактические превышают расчётные.
      </p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Услуга / Категория</th>
              <th className="text-right px-4 py-2 font-medium">Расчётные ₽</th>
              <th className="text-right px-4 py-2 font-medium">Фактические ₽</th>
              <th className="text-right px-4 py-2 font-medium">Разница ₽</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Нет данных за период</td></tr>}
            {data.map(row => (
              <tr key={row.name} className={`border-t ${row.diff > 0 ? 'bg-red-500/10' : row.diff < 0 ? 'bg-green-500/10' : ''}`}>
                <td className="px-4 py-2">{row.name}</td>
                <td className="px-4 py-2 text-right">{fmt(row.estimated)}</td>
                <td className="px-4 py-2 text-right">{fmt(row.actual)}</td>
                <td className={`px-4 py-2 text-right font-medium ${row.diff > 0 ? 'text-red-400' : row.diff < 0 ? 'text-green-400' : ''}`}>
                  {row.diff > 0 ? '+' : ''}{fmt(row.diff)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
