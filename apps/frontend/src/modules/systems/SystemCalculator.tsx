import { useState } from 'react'
import { AlertTriangle, CheckCircle, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCalculate, type GlazingSystem, type CalcResult } from '@/api/systems'

interface Props { system: GlazingSystem }

export default function SystemCalculator({ system }: Props) {
  const calculate = useCalculate(system.id)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [result, setResult] = useState<CalcResult | null>(null)
  const [error, setError] = useState('')

  const inputParams = system.parameters.filter(p => p.paramKind === 'INPUT')

  function setInput(variable: string, value: string) {
    setInputs(prev => ({ ...prev, [variable]: value }))
  }

  async function handleCalculate() {
    setError('')
    const parsed: Record<string, number | string | boolean> = {}
    for (const p of inputParams) {
      const raw = inputs[p.variable]
      if (p.type === 'NUMBER') parsed[p.variable] = parseFloat(raw || '0') || 0
      else if (p.type === 'BOOLEAN') parsed[p.variable] = raw === 'true'
      else parsed[p.variable] = raw || ''
    }
    try {
      const res = await calculate.mutateAsync(parsed)
      setResult(res)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка расчёта')
    }
  }

  const totalPrice = result?.components.reduce((s, c) => s + c.quantity * c.sellingPrice, 0) || 0

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium">Вводные параметры</h3>
        {inputParams.length === 0 && <p className="text-sm text-muted-foreground">Нет вводных параметров</p>}
        {inputParams.map(p => (
          <div key={p.id} className="flex items-center gap-3">
            <label className="text-sm w-48 shrink-0">{p.name}</label>
            {p.type === 'NUMBER' && (
              <Input type="number" step="any" value={inputs[p.variable] || ''} onChange={e => setInput(p.variable, e.target.value)}
                placeholder={p.defaultValue || '0'} className="w-40" />
            )}
            {p.type === 'BOOLEAN' && (
              <select value={inputs[p.variable] || 'false'} onChange={e => setInput(p.variable, e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-40">
                <option value="false">Нет</option>
                <option value="true">Да</option>
              </select>
            )}
            {p.type === 'SELECT' && (
              <select value={inputs[p.variable] || ''} onChange={e => setInput(p.variable, e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-40">
                <option value="">Выберите...</option>
                {(p.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>
        ))}
        <Button onClick={handleCalculate} disabled={calculate.isPending} className="mt-2">
          <FlaskConical size={15} className="mr-2" />
          {calculate.isPending ? 'Считаем...' : 'Рассчитать'}
        </Button>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      {result && (
        <>
          {result.warnings.length > 0 && (
            <div className="rounded-lg p-4 space-y-1 bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 font-medium text-amber-300 mb-2"><AlertTriangle size={16} />Предупреждения о лимитах</div>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-300/80">
                  {w.paramName}: значение {w.value} выходит за пределы [{w.min ?? '∞'} – {w.max ?? '∞'}]
                </p>
              ))}
            </div>
          )}

          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-medium flex items-center gap-2"><CheckCircle size={16} className="text-green-500" />Рассчитанные параметры</h3>
            {result.displayParams.filter(p => p.paramKind !== 'INPUT').map(p => (
              <div key={p.variable} className="flex justify-between text-sm border-b pb-1 last:border-0">
                <span className="text-muted-foreground">{p.name}</span>
                <span className="font-mono font-medium">{String(p.value)}</span>
              </div>
            ))}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-2 font-medium text-sm">Комплектующие</div>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr>
                  <th className="text-left px-4 py-2">Товар</th>
                  <th className="text-right px-4 py-2">Кол-во</th>
                  <th className="text-left px-4 py-2">Ед.</th>
                  <th className="text-right px-4 py-2">Цена</th>
                  <th className="text-right px-4 py-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {result.components.map((c, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">{c.productName}</td>
                    <td className="px-4 py-2 text-right font-mono">{c.quantity}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.unit}</td>
                    <td className="px-4 py-2 text-right">{c.sellingPrice.toLocaleString('ru-RU')} ₽</td>
                    <td className="px-4 py-2 text-right font-medium">{(c.quantity * c.sellingPrice).toLocaleString('ru-RU')} ₽</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/50 font-semibold">
                  <td colSpan={4} className="px-4 py-2 text-right">Итого:</td>
                  <td className="px-4 py-2 text-right">{totalPrice.toLocaleString('ru-RU')} ₽</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
