import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { X, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateContact, useUpdateContact, type Contact } from '@/api/contacts'
import { useCompanies } from '@/api/companies'
import CompanyPicker from '@/components/CompanyPicker'

interface Props { contact?: Contact; onClose: () => void }
interface FormData {
  lastName: string; firstName: string; middleName: string
  phone: string; email: string; position: string
}

export default function ContactDialog({ contact, onClose }: Props) {
  const { register, handleSubmit, reset } = useForm<FormData>()
  const create = useCreateContact()
  const update = useUpdateContact()
  const { data: allCompanies = [] } = useCompanies()
  const [companyIds, setCompanyIds] = useState<string[]>([])
  const [addingCompany, setAddingCompany] = useState(false)
  const [pickerValue, setPickerValue] = useState('')

  // Получаем название компании по id из загруженного списка
  function getCompanyName(id: string) {
    return allCompanies.find(c => c.id === id)?.name || id
  }

  useEffect(() => {
    if (contact) {
      reset({
        lastName: contact.lastName, firstName: contact.firstName,
        middleName: contact.middleName || '', phone: contact.phone,
        email: contact.email || '', position: contact.position || '',
      })
      const ids = contact.companies.map(c => c.company.id)
      setCompanyIds(ids)
      // Имена берутся из allCompanies автоматически
    } else {
      reset({ lastName: '', firstName: '', middleName: '', phone: '', email: '', position: '' })
      setCompanyIds([])
    }
  }, [contact, reset])

  function handlePickerChange(id: string) {
    if (!id) { setPickerValue(''); return }
    if (!companyIds.includes(id)) setCompanyIds(prev => [...prev, id])
    setPickerValue('')
    setAddingCompany(false)
  }

  function removeCompany(id: string) {
    setCompanyIds(prev => prev.filter(x => x !== id))
  }

  async function onSubmit(data: FormData) {
    const payload = { ...data, companyIds }
    try {
      if (contact) await update.mutateAsync({ id: contact.id, ...payload })
      else await create.mutateAsync(payload)
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (msg) alert(msg)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? 'Редактировать контакт' : 'Новый контакт'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Фамилия *</label>
              <Input {...register('lastName', { required: true })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Имя *</label>
              <Input {...register('firstName', { required: true })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Отчество</label>
              <Input {...register('middleName')} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Телефон *</label>
            <Input {...register('phone', { required: true })} placeholder="+7..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <Input {...register('email')} type="email" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Должность</label>
            <Input {...register('position')} />
          </div>

          {/* Компании */}
          <div>
            <label className="text-xs text-muted-foreground">Компании</label>
            {/* Список привязанных */}
            {companyIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 mb-2">
                {companyIds.map(id => (
                  <span key={id} className="flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full">
                    {getCompanyName(id)}
                    <button type="button" onClick={() => removeCompany(id)} className="hover:text-destructive">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Добавить компанию */}
            {addingCompany ? (
              <CompanyPicker value={pickerValue} onChange={handlePickerChange} placeholder="Найти компанию..." />
            ) : (
              <Button type="button" size="sm" variant="outline" className="w-full mt-1" onClick={() => setAddingCompany(true)}>
                <Plus size={13} className="mr-1" />Привязать компанию
              </Button>
            )}
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
