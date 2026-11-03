import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateParameter, useUpdateParameter, useSaveLimit, type SystemParameter, type SystemParamCategory } from '@/api/systems'

interface Props { systemId: string; parameter?: SystemParameter; categories: SystemParamCategory[]; onClose: () => void }
interface FormData {
  name: string; variable: string; type: 'NUMBER' | 'SELECT' | 'BOOLEAN'
  paramKind: 'INPUT' | 'CALCULATED' | 'CONSTANT'
  formula: string; defaultValue: string
  showInProposal: boolean; showInAssembly: boolean
  isAdvanced: boolean
  categoryId: string
}

export default function ParameterDialog({ systemId, parameter, categories, onClose }: Props) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>()
  const create = useCreateParameter(systemId)
  const update = useUpdateParameter(systemId)
  const saveLimit = useSaveLimit(systemId, parameter?.id || '')
  const [options, setOptions] = useState<{ label: string; value: string }[]>([])
  const [limitMin, setLimitMin] = useState<string>('')
  const [limitMax, setLimitMax] = useState<string>('')

  const paramKind = watch('paramKind')
  const paramType = watch('type')

  useEffect(() => {
    if (parameter) {
      reset({
        name: parameter.name, variable: parameter.variable,
        type: parameter.type, paramKind: parameter.paramKind,
        formula: parameter.formula || '', defaultValue: parameter.defaultValue || '',
        showInProposal: parameter.showInProposal, showInAssembly: parameter.showInAssembly,
        isAdvanced: parameter.isAdvanced ?? false,
        categoryId: parameter.categoryId || '',
      })
      setOptions(parameter.options || [])
      if (parameter.limits[0]) {
        setLimitMin(parameter.limits[0].minValue?.toString() || '')
        setLimitMax(parameter.limits[0].maxValue?.toString() || '')
      }
    } else {
      reset({ name: '', variable: '', type: 'NUMBER', paramKind: 'INPUT', formula: '', defaultValue: '', showInProposal: false, showInAssembly: false, isAdvanced: false, categoryId: '' })
    }
  }, [parameter, reset])

  async function onSubmit(data: FormData) {
    const payload = { ...data, categoryId: data.categoryId || undefined, options: data.type === 'SELECT' ? options : undefined }
    if (parameter) {
      await update.mutateAsync({ id: parameter.id, ...payload })
      // Сохраняем лимит если заполнен
      if (limitMin || limitMax) {
        await saveLimit.mutateAsync({
          id: parameter.limits[0]?.id,
          minValue: limitMin ? parseFloat(limitMin) : undefined,
          maxValue: limitMax ? parseFloat(limitMax) : undefined,
        })
      }
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parameter ? 'Редактировать параметр' : 'Новый параметр'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Название (рус) *</label>
              <Input {...register('name', { required: true })} placeholder="Ширина проёма" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Переменная (eng) *</label>
              <Input
                {...register('variable', {
                  required: true,
                  validate: v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v) || 'Только латиница, цифры и _ (не начинать с цифры)',
                })}
                placeholder="width"
                className={`font-mono ${errors.variable ? 'border-destructive' : ''}`}
              />
              {errors.variable && <p className="text-xs text-destructive mt-0.5">{errors.variable.message || 'Обязательное поле'}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Вид параметра</label>
              <select {...register('paramKind')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="INPUT">Вводной</option>
                <option value="CALCULATED">Рассчитываемый</option>
                <option value="CONSTANT">Константа</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Тип данных</label>
              <select {...register('type')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="NUMBER">Число</option>
                <option value="SELECT">Выпадающий список</option>
                <option value="BOOLEAN">Чекбокс (да/нет)</option>
              </select>
            </div>
          </div>

          {paramKind === 'CALCULATED' && (
            <div>
              <label className="text-xs text-muted-foreground">Формула</label>
              <Input {...register('formula')} placeholder="width * height / 1000000" className="font-mono text-xs" />
            </div>
          )}

          {paramKind === 'CONSTANT' && (
            <div>
              <label className="text-xs text-muted-foreground">Значение константы</label>
              <Input {...register('defaultValue')} placeholder="3.14" />
            </div>
          )}

          {paramKind === 'INPUT' && paramType === 'SELECT' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground">Варианты списка</label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setOptions(o => [...o, { label: '', value: '' }])}>
                  <Plus size={13} className="mr-1" />Добавить
                </Button>
              </div>
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <Input placeholder="Метка" value={opt.label} onChange={e => setOptions(o => o.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <Input placeholder="Значение" value={opt.value} onChange={e => setOptions(o => o.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} className="font-mono" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setOptions(o => o.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
          )}

          {paramKind === 'INPUT' && paramType === 'NUMBER' && (
            <div>
              <label className="text-xs text-muted-foreground">Значение по умолчанию</label>
              <Input {...register('defaultValue')} type="number" step="any" />
            </div>
          )}

          <div className="border rounded-md p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Лимиты (предупреждение при выходе за пределы)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Минимум</label>
                <Input type="number" step="any" value={limitMin} onChange={e => setLimitMin(e.target.value)} placeholder="не задан" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Максимум</label>
                <Input type="number" step="any" value={limitMax} onChange={e => setLimitMax(e.target.value)} placeholder="не задан" />
              </div>
            </div>
          </div>

          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register('showInProposal')} />
              Отображать в КП
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register('showInAssembly')} />
              Отображать в комплектации
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register('isAdvanced')} />
              <span className="text-muted-foreground">Дополнительный</span>
              <span className="text-xs text-muted-foreground">(скрыт под катом)</span>
            </label>
          </div>

          {categories.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground">Категория</label>
              <select {...register('categoryId')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">Без категории (Общие)</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>Сохранить</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
