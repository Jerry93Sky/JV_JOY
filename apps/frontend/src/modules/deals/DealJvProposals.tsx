import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { canIssueJvProposal, issuedDate, proposalIssuanceDetailPath } from '@/modules/jv-order/proposalDraft'
import { displayProposalMoney } from '@/modules/jv-order/proposalMoney'

type IssuedProposalsPage = {
  items: { proposalId: string; number: number; issuedAt: string; orderNumber: number; totalSalePrice: unknown }[]
  next: number | null
}

export function DealJvProposals({ dealId }: { dealId: string }) {
  const user = useAuthStore(state => state.user)
  const allowed = canIssueJvProposal(user?.role)
  const [open, setOpen] = useState(false)
  const [cursors, setCursors] = useState<(number | null)[]>([null])
  const before = cursors[cursors.length - 1]
  const { data, isPending, isError } = useQuery({
    queryKey: ['jv-issued-deal', user?.id, dealId, before],
    queryFn: ({ signal }) => api.get<IssuedProposalsPage>(`/jv/deals/${encodeURIComponent(dealId)}/issued-proposals`, {
      signal, params: { before },
    }).then(response => response.data),
    enabled: allowed && open,
    retry: false,
  })
  if (!allowed) return null

  return (
    <details className="space-y-2 rounded-lg border p-4" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-medium">Выпущенные КП JV</summary>
      {open && (
        <>
          {isPending && <p role="status" className="text-sm">Загрузка КП…</p>}
          {isError && <p role="alert" className="text-sm">Не удалось загрузить КП сделки.</p>}
          {data?.items.length === 0 && <p className="text-sm text-muted-foreground">У сделки пока нет выпущенных КП JV.</p>}
          <ul className="space-y-2 text-sm">
            {data?.items.map(item => {
              const amount = displayProposalMoney(item.totalSalePrice)
              return (
                <li key={item.proposalId} className="flex flex-wrap items-baseline gap-x-3">
                  <Link className="text-primary underline" to={proposalIssuanceDetailPath(item.proposalId) + '/print'} target="_blank" rel="noopener">
                    КП №{item.number} от {issuedDate(item.issuedAt)}
                  </Link>
                  <span>JV-заказ №{item.orderNumber}</span>
                  {amount && <span>{amount.text} ₽{amount.rounded && ' (округлено)'}</span>}
                </li>
              )
            })}
          </ul>
          {(cursors.length > 1 || data?.next) && <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={cursors.length === 1} onClick={() => setCursors(old => old.slice(0, -1))}>Назад</Button>
            <Button variant="outline" size="sm" disabled={!data?.next} onClick={() => { if (data?.next) setCursors(old => [...old, data.next]) }}>Дальше</Button>
          </div>}
        </>
      )}
    </details>
  )
}
