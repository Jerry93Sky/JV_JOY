import { useState, useEffect } from 'react'
import { Plus, Phone, Globe, User, MessageSquare, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLeads, type LeadStatus, type LeadListItem } from '@/api/leads'
import { useAuthStore } from '@/store/authStore'
import CreateLeadDialog from '@/modules/leads/CreateLeadDialog'
import LeadDetail from '@/modules/leads/LeadDetail'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useOpenEntity } from '@/hooks/useOpenEntity'

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: '1.1 Новый', IN_PROGRESS: '1.2 В работе', CONVERTED: 'Конвертирован', REJECTED: 'Отклонён',
}
const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  CONVERTED: 'bg-green-500/20 text-green-300 border border-green-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 border border-red-500/30',
}
const SOURCE_ICONS: Record<string, React.ReactNode> = {
  CALL: <Phone size={13} />, WEBSITE: <Globe size={13} />, MANUAL: <User size={13} />, OTHER: <MessageSquare size={13} />,
}

function LeadRow({ lead, onClick }: { lead: LeadListItem; onClick: () => void }) {
  const noContact = !lead.contact
  return (
    <div onClick={onClick}
      className={`border rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors ${noContact ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-muted-foreground">#{lead.number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.leadStatus]}`}>
              {STATUS_LABELS[lead.leadStatus]}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {SOURCE_ICONS[lead.leadSource]}
              {lead.leadSource === 'CALL' ? 'Звонок' : lead.leadSource === 'WEBSITE' ? 'Сайт' : lead.leadSource === 'MANUAL' ? 'Вручную' : 'Другое'}
            </span>
            {noContact && (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                <AlertCircle size={12} />Нет контакта
              </span>
            )}
          </div>
          {lead.contact ? (
            <div className="mt-1 font-medium">
              {lead.contact.lastName} {lead.contact.firstName}
              {lead.company && <span className="text-muted-foreground font-normal"> · {lead.company.name}</span>}
            </div>
          ) : (
            <div className="mt-1 text-amber-400/80 text-sm italic">Контакт не указан</div>
          )}
          {lead.contact && <div className="text-sm text-muted-foreground">{lead.contact.phone}</div>}
          {lead.comment && <div className="text-xs text-muted-foreground mt-1 truncate">{lead.comment}</div>}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className="text-xs text-muted-foreground">{lead.assignee.lastName} {lead.assignee.firstName}</div>
          <div className="text-xs text-muted-foreground">{format(new Date(lead.createdAt), 'dd.MM.yyyy', { locale: ru })}</div>
          <div className="text-xs text-muted-foreground">{lead._count.events} событий</div>
        </div>
      </div>
    </div>
  )
}

export default function LeadsPage() {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const user = useAuthStore(s => s.user)

  const openId = useOpenEntity('lead')
  useEffect(() => {
    if (openId) setSelectedId(openId)
  }, [openId])

  const { data: leads = [], isLoading } = useLeads({
    status: statusFilter || undefined,
    assigneeId: onlyMine ? user?.id : undefined,
  })

  if (selectedId) return <LeadDetail leadId={selectedId} onBack={() => setSelectedId(null)} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Лиды</h1>
        <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} className="mr-1" />Новый лид</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border rounded-md overflow-hidden">
          {(['', 'NEW', 'IN_PROGRESS', 'CONVERTED', 'REJECTED'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              {s === '' ? 'Все' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
          Только мои
        </label>
      </div>

      {isLoading && <div className="text-muted-foreground text-sm">Загрузка...</div>}

      <div className="space-y-2">
        {leads.map(lead => (
          <LeadRow key={lead.id} lead={lead} onClick={() => setSelectedId(lead.id)} />
        ))}
        {!isLoading && leads.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">Лидов нет</div>
        )}
      </div>

      {creating && <CreateLeadDialog onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setSelectedId(id) }} />}
    </div>
  )
}
