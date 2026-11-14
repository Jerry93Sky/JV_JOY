import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSystems, useCalculate, type GlazingSystem, type CalcResult, type SystemParameter } from '@/api/systems'
import { useAddDealSystem, useUpdateDealSystem, type DealSystemEntry } from '@/api/deals'

interface Props {
  dealId: string
  direction: string
  onClose: () => void
  // Для редактирования существующей системы
  editingSystem?: DealSystemEntry
}

interface ComponentRow {
  productId: string
  productName: string
  productSku: string
  unit: string
  sellingPrice: number
  quantity: number
  included: boolean // пользователь может снять галочку
}

function parseOptions(options: unknown): { label: string; value: string }[] {
  if (!options) return []
  if (Array.isArray(options)) return options
  if (typeof options === 'string') { try { return JSON.parse(options) } catch { return [] } }
  return []
}

export default function AddSystemDialog({ dealId, direction, onClose, editingSystem }: Props) {
  const { data: systems = [] } = useSystems()
  const [selectedSystem, setSelectedSystem] = useState<GlazingSystem | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [result, setResult] = useState<CalcResult | null>(null)
  const [components, setComponents] = useState<ComponentRow[]>([])
  const [calcError, setCalcError] = useState('')
  const calculate = useCalculate(selectedSystem?.id || '')
  const addDealSystem = useAddDealSystem(dealId)
  const updateDealSystem = useUpdateDealSystem(dealId)

  // При редактировании — сразу выбираем нужную систему и заполняем параметры
  useEffect(() => {
    if (editingSystem && systems.length > 0) {
      const sys = systems.find(s => s.id === editingSystem.systemId)
      if (sys) {
        setSelectedSystem(sys)
        // Восстанавливаем сохранённые параметры
        const saved = editingSystem.inputParams as Record<string, string>
        setInputs(saved)
      }
    }
  }, [editingSystem, systems])

  function setInput(variable: string, value: string) {
    setInputs(prev => ({ ...prev, [variable]: value }))
    setResult(null)
    setComponents([])
  }

  function selectSystem(s: GlazingSystem) {
    setSelectedSystem(s)
    const defaults: Record<string, string> = {}
    for (const p of s.parameters) {
      if (p.paramKind === 'INPUT' && p.defaultValue) defaults[p.variable] = p.defaultValue
    }
    setInputs(defaults)
    setResult(null)
    setComponents([])
    setCalcError('')
  }

  async function handleCalculate() {
    if (!selectedSystem) return
    setCalcError('')
    const inputParams = selectedSystem.parameters.filter(p => p.paramKind === 'INPUT')
    const parsed: Record<string, number | string | boolean> = {}
    for (const p of inputParams) {
      const raw = inputs[p.variable]
      if (p.type === 'NUMBER') parsed[p.variable] = parseFloat(raw || p.defaultValue || '0') || 0
      else if (p.type === 'BOOLEAN') parsed[p.variable] = raw === 'true'
      else parsed[p.variable] = raw || p.defaultValue || ''
    }
    try {
      const res = await calculate.mutateAsync({ ...parsed, direction })
      setResult(res)
      // Инициализируем список компонентов с возможностью снять галочку
      setComponents(res.components.map(c => ({ ...c, included: c.quantity > 0 })))
    } catch (e: unknown) {
      setCalcError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка расчёта')
    }
  }

  async function handleAddToOrder() {
    if (!selectedSystem) return

    const includedItems = components
      .filter(c => c.included && c.quantity > 0)
      .map(c => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.sellingPrice }))

    const calcParamsForSave = result?.displayParams.reduce((acc, p) => {
      acc[p.variable] = p.value
      return acc
    }, {} as Record<string, unknown>) || {}

    if (editingSystem) {
      // Режим редактирования — обновляем существующую систему
      await updateDealSystem.mutateAsync({
        dsId: editingSystem.id,
        inputParams: inputs as Record<string, unknown>,
        calcParams: calcParamsForSave,
        items: includedItems,
      })
    } else {
      // Режим добавления — создаём новую
      await addDealSystem.mutateAsync({
        systemId: selectedSystem.id,
        systemName: selectedSystem.name,
        inputParams: inputs as Record<string, unknown>,
        calcParams: calcParamsForSave,
        items: includedItems,
      })
    }
    onClose()
  }

  const totalPrice = components.filter(c => c.included).reduce((s, c) => s + c.quantity * c.sellingPrice, 0)
  const categories = selectedSystem?.categories || []

  function getInputParams(): SystemParameter[] {
    if (!selectedSystem) return []
    return selectedSystem.parameters
      .filter(p => p.paramKind === 'INPUT')
      .sort((a, b) => (a.proposalPriority ?? 0) - (b.proposalPriority ?? 0))
  }

  function getBasicParams(params: SystemParameter[]) {
    return params.filter(p => !p.isAdvanced)
  }

  function getAdvancedParams(params: SystemParameter[]) {
    return params.filter(p => p.isAdvanced)
  }

  function renderParamGroup(params: SystemParameter[], label?: string) {
    if (params.length === 0) return null
    const basic = getBasicParams(params)
    const advanced = getAdvancedParams(params)
    return (
      <div>
        {label && <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{label}</p>}
        <div className="space-y-2 pl-2 border-l-2 border-muted">
          {basic.map(renderInputParam)}
        </div>
        {advanced.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground pl-2 py-1 select-none">
              ▸ Дополнительные параметры ({advanced.length})
            </summary>
            <div className="space-y-2 pl-2 border-l-2 border-muted/50 mt-2">
              {advanced.map(renderInputParam)}
            </div>
          </details>
        )}
      </div>
    )
  }

  function renderInputParam(p: SystemParameter) {
    const opts = parseOptions(p.options)
    return (
      <div key={p.id} className="flex items-center gap-3">
        <label className="text-sm w-44 shrink-0">{p.name}</label>
        {p.type === 'NUMBER' && (
          <Input type="number" step="any" value={inputs[p.variable] ?? p.defaultValue ?? ''}
            onChange={e => setInput(p.variable, e.target.value)} className="w-36" />
        )}
        {p.type === 'BOOLEAN' && (
          <select value={inputs[p.variable] ?? 'false'} onChange={e => setInput(p.variable, e.target.value)}
            className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="false">Нет</option>
            <option value="true">Да</option>
          </select>
        )}
        {p.type === 'SELECT' && (
          <select value={inputs[p.variable] ?? p.defaultValue ?? ''} onChange={e => setInput(p.variable, e.target.value)}
            className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Выберите...</option>
            {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSystem ? `Редактировать: ${editingSystem.systemName}` : 'Добавить систему в заказ'}</DialogTitle>
        </DialogHeader>

        {!selectedSystem ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Выберите систему остекления:</p>
            {systems.length === 0 && <p className="text-sm text-muted-foreground">Нет активных систем</p>}
            {systems.map(s => (
              <button key={s.id} type="button" onClick={() => selectSystem(s)}
                className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {s.parameters.filter(p => p.paramKind === 'INPUT').length} вводных параметров · {s.components.length} комплектующих
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {!editingSystem && (
                <button type="button" onClick={() => setSelectedSystem(null)} className="text-sm text-muted-foreground hover:text-foreground">← Назад</button>
              )}
              <span className="font-medium">{selectedSystem.name}</span>
            </div>

            {/* Вводные параметры */}
            <div className="space-y-3">
              {categories.length > 0 ? (
                <>
                  {categories.map(cat => {
                    const params = getInputParams().filter(p => p.categoryId === cat.id)
                    if (params.length === 0) return null
                    return (
                      <div key={cat.id}>
                        {renderParamGroup(params, cat.name)}
                      </div>
                    )
                  })}
                  {getInputParams().filter(p => !p.categoryId).length > 0 && (
                    renderParamGroup(getInputParams().filter(p => !p.categoryId), 'Общие')
                  )}
                </>
              ) : (
                (() => {
                  const all = getInputParams()
                  const basic = getBasicParams(all)
                  const advanced = getAdvancedParams(all)
                  return (
                    <div className="space-y-2">
                      {basic.map(renderInputParam)}
                      {advanced.length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground py-1 select-none">
                            ▸ Дополнительные параметры ({advanced.length})
                          </summary>
                          <div className="space-y-2 pl-2 border-l-2 border-muted/50 mt-2">
                            {advanced.map(renderInputParam)}
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })()
              )}
            </div>

            {getInputParams().length === 0 && (
              <p className="text-sm text-muted-foreground">У этой системы нет вводных параметров</p>
            )}

            <Button onClick={handleCalculate} disabled={calculate.isPending} className="w-full">
              {calculate.isPending ? 'Считаем...' : 'Рассчитать'}
            </Button>

            {calcError && <p className="text-destructive text-sm">{calcError}</p>}

            {result && (
              <div className="space-y-3">
                {result.warnings.length > 0 && (
                  <div className="rounded-lg p-3 space-y-1 bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center gap-2 font-medium text-amber-300 text-sm">
                      <AlertTriangle size={14} />Предупреждения о лимитах
                    </div>
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-300/80">{w.paramName}: {w.value} (допустимо: {w.min ?? '∞'} – {w.max ?? '∞'})</p>
                    ))}
                  </div>
                )}

                {/* Рассчитанные параметры */}
                {result.displayParams.filter(p => p.paramKind !== 'INPUT' && p.showInProposal).length > 0 && (
                  <div className="border rounded-lg p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Рассчитанные параметры</p>
                    {result.displayParams.filter(p => p.paramKind !== 'INPUT' && p.showInProposal).map(p => (
                      <div key={p.variable} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{p.name}</span>
                        <span className="font-mono font-medium">{String(p.value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Комплектующие с возможностью снять галочку */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-3 py-2 text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-500" />
                    Комплектующие
                    {components.length === 0 && <span className="text-muted-foreground font-normal">(формулы не настроены — система будет добавлена без позиций)</span>}
                  </div>
                  {components.length > 0 && (
                    <table className="w-full text-sm">
                      <thead className="text-muted-foreground text-xs border-b">
                        <tr>
                          <th className="px-3 py-2 w-8"></th>
                          <th className="text-left px-3 py-2">Товар</th>
                          <th className="text-right px-3 py-2">Кол-во</th>
                          <th className="text-left px-3 py-2">Ед.</th>
                          <th className="text-right px-3 py-2">Цена</th>
                          <th className="text-right px-3 py-2">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {components.map((c, i) => (
                          <tr key={i} className={`border-t ${!c.included ? 'opacity-40' : ''}`}>
                            <td className="px-3 py-1.5">
                              <input type="checkbox" checked={c.included}
                                onChange={e => setComponents(prev => prev.map((x, j) => j === i ? { ...x, included: e.target.checked } : x))} />
                            </td>
                            <td className="px-3 py-1.5">{c.productName}</td>
                            <td className="px-3 py-1.5 text-right">
                              <Input type="number" step="0.001" value={c.quantity}
                                onChange={e => setComponents(prev => prev.map((x, j) => j === i ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))}
                                className="w-20 h-7 text-right text-xs" />
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">{c.unit}</td>
                            <td className="px-3 py-1.5 text-right">{c.sellingPrice.toLocaleString('ru-RU')} ₽</td>
                            <td className="px-3 py-1.5 text-right font-medium">{(c.quantity * c.sellingPrice).toLocaleString('ru-RU')} ₽</td>
                          </tr>
                        ))}
                        <tr className="border-t bg-muted/50 font-semibold">
                          <td colSpan={5} className="px-3 py-2 text-right">Итого:</td>
                          <td className="px-3 py-2 text-right">{totalPrice.toLocaleString('ru-RU')} ₽</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>

                <Button onClick={handleAddToOrder} disabled={addDealSystem.isPending || updateDealSystem.isPending} className="w-full">
                  <Plus size={15} className="mr-1" />
                  {editingSystem
                    ? 'Сохранить изменения'
                    : components.length > 0
                      ? `Добавить в заказ (${totalPrice.toLocaleString('ru-RU')} ₽)`
                      : 'Добавить систему в заказ (без комплектующих)'}
                </Button>
              </div>
            )}

            {/* Кнопка добавить без расчёта */}
            {!result && (
              <Button variant="outline" onClick={handleAddToOrder} disabled={addDealSystem.isPending || updateDealSystem.isPending} className="w-full">
                {editingSystem ? 'Сохранить без пересчёта' : 'Добавить систему без расчёта комплектующих'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
