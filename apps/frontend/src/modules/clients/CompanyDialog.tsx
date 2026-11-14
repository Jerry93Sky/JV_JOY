import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateCompany, useUpdateCompany, type Company, type BankAccount } from '@/api/companies'
import { CompanyType } from '@/api/companies'
import ContactPicker from '@/components/ContactPicker'
import CompanyPicker from '@/components/CompanyPicker'

interface Props { company?: Company; onClose: () => void }
interface FormData { name: string; type: CompanyType; inn: string; ogrn: string; manualDiscountPct: string }

const TYPES = [
  { value: CompanyType.OOO, label: 'ООО' },
  { value: CompanyType.IP, label: 'ИП' },
  { value: CompanyType.AO, label: 'АО' },
  { value: CompanyType.SZ, label: 'СЗ' },
  { value: CompanyType.AGENT, label: 'Агент' },
]

export default function CompanyDialog({ company, onClose }: Props) {
  const { register, handleSubmit, reset } = useForm<FormData>()
  const create = useCreateCompany()
  const update = useUpdateCompany()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [contactIds, setContactIds] = useState<string[]>([])
  const [relatedCompanyIds, setRelatedCompanyIds] = useState<string[]>([])
  const [addingContact, setAddingContact] = useState(false)
  const [addingRelated, setAddingRelated] = useState(false)
  const [pickerValue, setPickerValue] = useState('')

  useEffect(() => {
    if (company) {
      reset({ name: company.name, type: company.type, inn: company.inn || '', ogrn: company.ogrn || '', manualDiscountPct: company.manualDiscountPct != null ? String(company.manualDiscountPct) : '' })
      setAccounts(company.bankAccounts || [])
      // TODO: загрузить связанные контакты и компании из полной карточки
    } else {
      reset({ name: '', type: CompanyType.OOO, inn: '', ogrn: '', manualDiscountPct: '' })
      setAccounts([])
      setContactIds([])
      setRelatedCompanyIds([])
    }
  }, [company, reset])

  function addAccount() { setAccounts(a => [...a, { accountNum: '', bik: '' }]) }
  function removeAccount(i: number) { setAccounts(a => a.filter((_, idx) => idx !== i)) }
  function updateAccount(i: number, field: keyof BankAccount, value: string) {
    setAccounts(a => a.map((acc, idx) => idx === i ? { ...acc, [field]: value } : acc))
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      manualDiscountPct: data.manualDiscountPct ? parseFloat(data.manualDiscountPct) : undefined,
      bankAccounts: accounts.filter(a => a.accountNum && a.bik),
    }
    try {
      if (company) await update.mutateAsync({ id: company.id, ...payload })
      else await create.mutateAsync(payload)
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (msg) alert(msg)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{company ? 'Редактировать компанию' : 'Новая компания'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Название *</label>
            <Input {...register('name', { required: true })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Тип *</label>
            <select {...register('type', { required: true })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">ИНН</label>
              <Input {...register('inn')} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ОГРН</label>
              <Input {...register('ogrn')} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Ручная скидка % (если задана — автоматическая не применяется)</label>
            <Input type="number" step="0.1" min="0" max="100" {...register('manualDiscountPct')} placeholder="Оставьте пустым для авто" className="w-40" />
          </div>

          {/* Расчётные счета */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Расчётные счета</label>
              <Button type="button" variant="ghost" size="sm" onClick={addAccount}><Plus size={13} className="mr-1" />Добавить</Button>
            </div>
            {accounts.map((acc, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input placeholder="Номер р/с" value={acc.accountNum} onChange={e => updateAccount(i, 'accountNum', e.target.value)} />
                <Input placeholder="БИК" value={acc.bik} onChange={e => updateAccount(i, 'bik', e.target.value)} className="w-32" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeAccount(i)}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>Сохранить</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
