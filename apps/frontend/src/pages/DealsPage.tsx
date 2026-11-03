import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDeals, DealStage } from '@/api/deals'
import { useAuthStore } from '@/store/authStore'
import DealCard from '@/modules/deals/DealCard'
import CreateDealDialog from '@/modules/deals/CreateDealDialog'
import DealDetail from '@/modules/deals/DealDetail'
import { useOpenEntity } from '@/hooks/useOpenEntity'

const STAGE_LABELS: Record<DealStage, string> = {
  [DealStage.APPLICATION]:    '1.1 Новый лид',
  [DealStage.IN_PROGRESS]:    '1.2 В работе',
  [DealStage.INVOICE_SENT]:   '2.1 Счёт выставлен',
  [DealStage.PAID]:           '2.2 Оплачен',
  [DealStage.ASSEMBLY]:       '2.3 Сборка',
  [DealStage.PAINTING]:       '2.4 Покраска',
  [DealStage.INSTALL_FIRST]:  '2.5 Монтаж 1',
  [DealStage.INSTALL_SECOND]: '2.6 Монтаж 2',
  [DealStage.SHIPMENT]:       '3.1 Отгрузка',
  [DealStage.DOCS]:           '3.2 Документы',
  [DealStage.COMPLETED]:      '3.3 Завершён',
  [DealStage.FAILED]:         'Отменён',
}

const STAGE_COLORS: Partial<Record<DealStage, string>> = {
  [DealStage.APPLICATION]:    'bg-slate-500/20 text-slate-300 border border-slate-500/30',
  [DealStage.IN_PROGRESS]:    'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  [DealStage.INVOICE_SENT]:   'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  [DealStage.PAID]:           'bg-green-500/20 text-green-300 border border-green-500/30',
  [DealStage.ASSEMBLY]:       'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  [DealStage.PAINTING]:       'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  [DealStage.INSTALL_FIRST]:  'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  [DealStage.INSTALL_SECOND]: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  [DealStage.SHIPMENT]:       'bg-lime-500/20 text-lime-300 border border-lime-500/30',
  [DealStage.DOCS]:           'bg-teal-500/20 text-teal-300 border border-teal-500/30',
  [DealStage.COMPLETED]:      'bg-green-500/30 text-green-200 border border-green-500/40',
  [DealStage.FAILED]:         'bg-red-500/20 text-red-300 border border-red-500/30',
}

export { STAGE_LABELS, STAGE_COLORS }

export default function DealsPage() {
  const [showCompleted, setShowCompleted] = useState(false)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const user = useAuthStore(s => s.user)

  const openId = useOpenEntity('deal')
  useEffect(() => {
    if (openId) setSelectedId(openId)
  }, [openId])

  const { data: deals = [], isLoading } = useDeals({ showCompleted, assigneeId: filterAssignee || undefined })

  if (selectedId) return <DealDetail dealId={selectedId} onBack={() => setSelectedId(null)} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Сделки</h1>
        <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} className="mr-1" />Новая заявка</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
          Показать завершённые
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={filterAssignee === user?.id} onChange={e => setFilterAssignee(e.target.checked ? (user?.id || '') : '')} />
          Только мои
        </label>
      </div>

      {isLoading && <div className="text-muted-foreground text-sm">Загрузка...</div>}

      <div className="space-y-2">
        {deals.map(deal => (
          <DealCard key={deal.id} deal={deal} stageLabel={STAGE_LABELS[deal.stage]} stageColor={STAGE_COLORS[deal.stage] || ''} onClick={() => setSelectedId(deal.id)} />
        ))}
        {!isLoading && deals.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">Сделок нет</div>
        )}
      </div>

      {creating && <CreateDealDialog onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setSelectedId(id) }} />}
    </div>
  )
}
