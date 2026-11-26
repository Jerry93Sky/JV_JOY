import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { displayProposalMoney } from './proposalMoney'
import {
  canIssueJvProposal, dealDetailPath, issuedDate, proposalIssuanceDetailPath, proposalIssuancePath,
  proposalTermLabels, type ProposalForIssue, type ProposalIssue,
} from './proposalDraft'

type IssuanceList = {
  items: { id: string; number: number; order: { number: number }; issue: ProposalIssue | null }[]
  next: number | null
}

function IssuePreview({ id, userId }: { id: string; userId: string }) {
  const cache = useQueryClient()
  const path = proposalIssuanceDetailPath(id)
  const key = ['jv-proposal-issuance', userId, id] as const
  const { data, isPending, isError } = useQuery({
    queryKey: key, queryFn: ({ signal }) => api.get<ProposalForIssue>(path, { signal }).then(r => r.data), retry: false,
  })
  const issue = useMutation({
    mutationFn: () => api.post<ProposalIssue>(path + '/issue').then(r => r.data),
    onSuccess: receipt => {
      cache.setQueryData<ProposalForIssue>(key, saved => saved && { ...saved, issue: receipt })
      return cache.invalidateQueries({ queryKey: ['jv-proposal-issuance-list', userId] })
    },
  })
  if (isPending) return <p role="status">Загрузка КП…</p>
  if (isError || !data) return <p role="alert">КП недоступно для выпуска.</p>
  const { payload } = data
  const amount = displayProposalMoney(payload.totalSalePrice)
  return (
    <article className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Заказ №{payload.orderNumber} · версия {payload.orderVersion}</h2>
      <p className="text-sm text-muted-foreground">Согласованный черновик №{data.number}</p>
      {data.deal && <Link className="text-sm text-primary underline" to={dealDetailPath(data.deal.id)}>Сделка №{data.deal.number}</Link>}
      <dl className="space-y-2 text-sm">
        {proposalTermLabels.map(([key, label]) => (
          <div key={key}><dt className="font-medium">{label}</dt><dd className="whitespace-pre-wrap break-words">{payload.terms?.[key]}</dd></div>
        ))}
      </dl>
      <p className="font-semibold">Итого {amount ? `${amount.text} ₽${amount.rounded ? ' (округлено)' : ''}` : 'недоступно'}</p>
      {data.issue ? (
        <>
          <p role="status">Выпущено КП №{data.issue.number} от {issuedDate(data.issue.issuedAt)}</p>
          <Link className={buttonVariants()} to={path + '/print'} target="_blank" rel="noopener">Клиентская печатная форма</Link>
        </>
      ) : (
        <Button disabled={issue.isPending || !amount} onClick={() => {
          if (window.confirm(`Выпустить КП из согласованного черновика №${data.number}?`)) issue.mutate()
        }}>{issue.isPending ? 'Выпуск…' : 'Выпустить КП'}</Button>
      )}
      {issue.isError && <p role="alert">Выпуск не подтверждён. Обновите страницу и проверьте статус КП.</p>}
    </article>
  )
}

export default function JVProposalIssuancePage() {
  const user = useAuthStore(state => state.user)
  const [search] = useSearchParams()
  const id = search.get('proposal')
  const [cursors, setCursors] = useState<(number | null)[]>([null])
  const before = cursors[cursors.length - 1]
  const allowed = !!user && canIssueJvProposal(user.role)
  const { data, isPending, isError } = useQuery({
    queryKey: ['jv-proposal-issuance-list', user?.id, before],
    queryFn: ({ signal }) => api.get<IssuanceList>(proposalIssuancePath, { signal, params: { before } }).then(r => r.data),
    enabled: allowed,
    retry: false,
  })
  if (!allowed || !user) return <p role="alert">Выпуск КП доступен владельцу и инженеру.</p>
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Выпуск КП</h1>
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
        <section className="space-y-3 rounded-lg border bg-card p-4" aria-labelledby="issuance-list">
          <h2 id="issuance-list" className="font-semibold">Согласованные предложения</h2>
          {isPending && <p role="status">Загрузка списка…</p>}
          {isError && <p role="alert">Не удалось загрузить согласованные КП.</p>}
          {data?.items.length === 0 && <p className="text-sm text-muted-foreground">Согласованных КП пока нет.</p>}
          <ul className="space-y-1">
            {data?.items.map(item => (
              <li key={item.id}>
                <Link aria-current={item.id === id ? 'true' : undefined} className="block rounded px-2 py-1 text-primary hover:bg-muted aria-[current=true]:bg-muted"
                  to={`${proposalIssuancePath}?proposal=${encodeURIComponent(item.id)}`}>
                  Заказ №{item.order.number} · {item.issue ? `КП №${item.issue.number} выпущено` : `черновик №${item.number} к выпуску`}
                </Link>
              </li>
            ))}
          </ul>
          {(cursors.length > 1 || data?.next) && <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={cursors.length === 1} onClick={() => setCursors(old => old.slice(0, -1))}>Назад</Button>
            <Button variant="outline" size="sm" disabled={!data?.next} onClick={() => { if (data?.next) setCursors(old => [...old, data.next]) }}>Дальше</Button>
          </div>}
        </section>
        {id && <IssuePreview key={id} id={id} userId={user.id} />}
      </div>
    </div>
  )
}
