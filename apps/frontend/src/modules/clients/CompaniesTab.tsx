import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Percent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCompanies, useDeleteCompany, type Company } from '@/api/companies'
import CompanyDialog from './CompanyDialog'
import CompanyCard from './CompanyCard'

const COMPANY_TYPE_LABELS: Record<string, string> = {
  OOO: 'ООО', IP: 'ИП', AO: 'АО', SZ: 'СЗ', AGENT: 'Агент',
}

export default function CompaniesTab({ search, openCompanyId }: { search: string; openCompanyId?: string | null }) {
  const { data: companies = [], isLoading } = useCompanies(search || undefined)
  const deleteCompany = useDeleteCompany()
  const [editing, setEditing] = useState<Company | null>(null)
  const [creating, setCreating] = useState(false)
  const [viewingId, setViewingId] = useState<string | null>(null)

  // Открываем компанию по id из URL
  useEffect(() => {
    if (openCompanyId) setViewingId(openCompanyId)
  }, [openCompanyId])

  if (viewingId) {
    return <CompanyCard companyId={viewingId} onBack={() => setViewingId(null)} onEdit={() => { const c = companies.find(x => x.id === viewingId); if (c) setEditing(c); setViewingId(null) }} />
  }

  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка...</div>

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={15} className="mr-1" /> Добавить компанию
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Название</th>
              <th className="text-left px-4 py-2 font-medium">Тип</th>
              <th className="text-left px-4 py-2 font-medium">ИНН</th>
              <th className="text-left px-4 py-2 font-medium">Контакты</th>
              <th className="text-left px-4 py-2 font-medium">Скидка</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Компании не найдены</td></tr>
            )}
            {companies.map(c => (
              <tr key={c.id} className="border-t hover:bg-muted/50 cursor-pointer" onClick={() => setViewingId(c.id)}>
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2">
                  <span className="bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-full">
                    {COMPANY_TYPE_LABELS[c.type] || c.type}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{c.inn || '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {c.contacts?.length ?? 0} чел.
                </td>
                <td className="px-4 py-2">
                  {(c.currentDiscount ?? 0) > 0 ? (
                    <span className="flex items-center gap-1 text-green-400 font-medium">
                      <Percent size={13} />{c.currentDiscount}%
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setEditing(c) }}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); if (confirm('Удалить компанию?')) deleteCompany.mutate(c.id) }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <CompanyDialog
          company={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
