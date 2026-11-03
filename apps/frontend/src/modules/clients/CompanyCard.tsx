import { useState } from 'react'
import { ArrowLeft, Building2, Phone, Percent, TrendingUp, Plus, X, UserPlus, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCompany, useUpdateCompany } from '@/api/companies'
import { useUpdateContact } from '@/api/contacts'
import EntityLink from '@/components/EntityLink'
import ContactPicker from '@/components/ContactPicker'
import CompanyPicker from '@/components/CompanyPicker'
import { STAGE_LABELS } from '@/pages/DealsPage'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

const COMPANY_TYPE_LABELS: Record<string, string> = {
  OOO: 'ООО', IP: 'ИП', AO: 'АО', SZ: 'СЗ', AGENT: 'Агент',
}

interface Props { companyId: string; onBack: () => void; onEdit: () => void }

export default function CompanyCard({ companyId, onBack, onEdit }: Props) {
  const { data: company, isLoading } = useCompany(companyId)
  const qc = useQueryClient()
  const [addingContact, setAddingContact] = useState(false)
  const [addingRelated, setAddingRelated] = useState(false)

  // Привязать контакт к компании
  const linkContact = useMutation({
    mutationFn: (contactId: string) => api.patch(`/contacts/${contactId}`, { companyIds: [...(company?.contacts?.map(c => c.contact.id) || []), contactId] }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies', companyId] }); setAddingContact(false) },
  })

  // Привязать связанную компанию
  const linkRelated = useMutation({
    mutationFn: (relatedId: string) => api.post(`/companies/${companyId}/related`, { relatedId }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies', companyId] }); setAddingRelated(false) },
  })

  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка...</div>
  if (!company) return <div className="text-destructive">Компания не найдена</div>

  const fullCompany = company as never as {
    contacts?: { contact: { id: string; firstName: string; lastName: string; phone: string; position?: string } }[]
    relatedFrom?: { to: { id: string; name: string } }[]
    relatedTo?: { from: { id: string; name: string } }[]
    deals?: { id: string; number: string; stage: string; createdAt: string; isLead?: boolean }[]
  }

  const contacts = fullCompany.contacts || []
  const deals = fullCompany.deals || []
  const relatedCompanies = [
    ...(fullCompany.relatedFrom || []).map(r => r.to),
    ...(fullCompany.relatedTo || []).map(r => r.from),
  ]
  const activeDeals = deals.filter(d => !d.isLead && !['COMPLETED', 'FAILED'].includes(d.stage))
  const completedDeals = deals.filter(d => !d.isLead && ['COMPLETED', 'FAILED'].includes(d.stage))
  const leads = deals.filter(d => d.isLead)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} className="mr-1" />Назад</Button>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 size={18} />
          {company.name}
          <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {COMPANY_TYPE_LABELS[company.type] || company.type}
          </span>
        </h2>
        <Button size="sm" variant="outline" onClick={onEdit}>Редактировать</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">

          {/* Реквизиты */}
          <div className="border rounded-lg p-4 space-y-2 text-sm">
            <h3 className="font-medium">Реквизиты</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {company.inn && <><div className="text-muted-foreground">ИНН</div><div>{company.inn}</div></>}
              {company.ogrn && <><div className="text-muted-foreground">ОГРН</div><div>{company.ogrn}</div></>}
              {company.bankAccounts?.map((acc, i) => (
                <>
                  <div key={`l${i}`} className="text-muted-foreground">Р/с {i + 1}</div>
                  <div key={`v${i}`} className="font-mono text-xs">{acc.accountNum} · БИК {acc.bik}</div>
                </>
              ))}
            </div>
          </div>

          {/* Контакты */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Контакты ({contacts.length})</h3>
              <Button size="sm" variant="ghost" onClick={() => setAddingContact(!addingContact)}>
                <UserPlus size={13} className="mr-1" />Привязать
              </Button>
            </div>
            {addingContact && (
              <div className="border rounded-md p-2 bg-muted/20">
                <ContactPicker value="" onChange={id => { if (id) linkContact.mutate(id) }} />
              </div>
            )}
            {contacts.length === 0 && !addingContact && (
              <p className="text-xs text-muted-foreground">Нет привязанных контактов</p>
            )}
            {contacts.map(cc => (
              <div key={cc.contact.id} className="flex items-center gap-3 text-sm py-1 border-b last:border-0">
                <div className="flex-1">
                  <EntityLink type="contact" id={cc.contact.id} label={`${cc.contact.lastName} ${cc.contact.firstName}`} className="font-medium" />
                  {cc.contact.position && <span className="text-xs text-muted-foreground ml-2">{cc.contact.position}</span>}
                </div>
                <span className="flex items-center gap-1 text-muted-foreground text-xs"><Phone size={11} />{cc.contact.phone}</span>
              </div>
            ))}
          </div>

          {/* Связанные компании */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Связанные компании ({relatedCompanies.length})</h3>
              <Button size="sm" variant="ghost" onClick={() => setAddingRelated(!addingRelated)}>
                <Link size={13} className="mr-1" />Привязать
              </Button>
            </div>
            {addingRelated && (
              <div className="border rounded-md p-2 bg-muted/20">
                <CompanyPicker value="" onChange={id => { if (id) linkRelated.mutate(id) }} placeholder="Найти компанию для связи..." />
              </div>
            )}
            {relatedCompanies.length === 0 && !addingRelated && (
              <p className="text-xs text-muted-foreground">Нет связанных компаний</p>
            )}
            {relatedCompanies.map(rc => (
              <div key={rc.id} className="text-sm py-1 border-b last:border-0">
                <EntityLink type="company" id={rc.id} label={rc.name} className="font-medium" />
              </div>
            ))}
          </div>

          {/* Активные сделки */}
          {activeDeals.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-sm">Активные сделки ({activeDeals.length})</h3>
              {activeDeals.map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <EntityLink type="deal" id={d.id} label={`#${d.number}`} className="font-mono font-medium" />
                  <span className="text-xs text-muted-foreground">{STAGE_LABELS[d.stage as never] || d.stage}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(d.createdAt), 'dd.MM.yyyy', { locale: ru })}</span>
                </div>
              ))}
            </div>
          )}

          {/* Завершённые сделки */}
          {completedDeals.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-sm">Завершённые сделки ({completedDeals.length})</h3>
              {completedDeals.map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <EntityLink type="deal" id={d.id} label={`#${d.number}`} className="font-mono font-medium" />
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${d.stage === 'COMPLETED' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                    {d.stage === 'COMPLETED' ? 'Завершён' : 'Провален'}
                  </span>
                  <span className="text-xs text-muted-foreground">{format(new Date(d.createdAt), 'dd.MM.yyyy', { locale: ru })}</span>
                </div>
              ))}
            </div>
          )}

          {/* Лиды */}
          {leads.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-sm">Лиды ({leads.length})</h3>
              {leads.map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <EntityLink type="lead" id={d.id} label={`#${d.number}`} className="font-mono font-medium" />
                  <span className="text-xs text-muted-foreground">{format(new Date(d.createdAt), 'dd.MM.yyyy', { locale: ru })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Статистика */}
        <div className="space-y-3">
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2"><TrendingUp size={14} />Статистика</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Оборот (прошлый год)</span>
                <span className="font-medium">{Number(company.turnoverLastYear || 0).toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Всего сделок</span>
                <span className="font-medium">{deals.filter(d => !d.isLead).length}</span>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-medium text-sm flex items-center gap-2"><Percent size={14} />Скидка</h3>
            {company.manualDiscountPct != null ? (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-400">{Number(company.manualDiscountPct)}%</div>
                <div className="text-xs text-muted-foreground">Ручная (индивидуальная)</div>
              </div>
            ) : (company.currentDiscount ?? 0) > 0 ? (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-400">{company.currentDiscount}%</div>
                <div className="text-xs text-muted-foreground">Авторасчёт по обороту</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Скидка не применяется</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
