import { AlertTriangle, Clock, User } from 'lucide-react'
import { type DealListItem, Direction, PaymentStatus } from '@/api/deals'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Props {
  deal: DealListItem
  stageLabel: string
  stageColor: string
  onClick: () => void
}

export default function DealCard({ deal, stageLabel, stageColor, onClick }: Props) {
  const isDealer = deal.direction === Direction.DEALER
  const cardClass = isDealer ? 'deal-card-dealer' : 'deal-card-private'

  return (
    <div
      onClick={onClick}
      className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 ${cardClass} ${deal.paintingOverdue ? '!border-red-500/50 !bg-red-500/10' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-muted-foreground">#{deal.number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColor}`}>{stageLabel}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isDealer
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
            }`}>
              {isDealer ? 'Дилер' : 'Частный'}
            </span>
            {deal.paymentStatus === PaymentStatus.FULL && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Оплачен</span>
            )}
            {deal.paymentStatus === PaymentStatus.PARTIAL && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Частичная оплата</span>
            )}
            {deal.paintingOverdue && (
              <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                <AlertTriangle size={12} />Покраска просрочена
              </span>
            )}
          </div>
          <div className="mt-1.5 font-medium truncate">
            {deal.contact ? `${deal.contact.lastName} ${deal.contact.firstName}` : <span className="text-amber-400 italic text-sm">Контакт не указан</span>}
            {deal.company && <span className="text-muted-foreground font-normal"> · {deal.company.name}</span>}
          </div>
          <div className="text-sm text-muted-foreground">{deal.contact?.phone}</div>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
            <User size={12} />
            {deal.assignee.lastName} {deal.assignee.firstName}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
            <Clock size={12} />
            {format(new Date(deal.updatedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
          </div>
        </div>
      </div>
    </div>
  )
}
