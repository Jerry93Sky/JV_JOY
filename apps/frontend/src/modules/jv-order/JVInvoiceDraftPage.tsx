import { useState } from 'react'
import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { ProposalAmounts } from './JVProposalPrintPage'
import { canIssueJvProposal, dealDetailPath, proposalTermLabels, type ProposalPayload } from './proposalDraft'

const partyFields = { name: 'Наименование / ФИО', inn: 'ИНН', kpp: 'КПП', address: 'Адрес' } as const
const sellerFields = { ...partyFields, bank: 'Банк', bik: 'БИК', account: 'Расчётный счёт' } as const
type Details = {
  seller: Record<keyof typeof sellerFields, string>
  buyer: Record<keyof typeof partyFields, string>
  notes: string
}
interface InvoiceDraft {
  id: string
  version: number
  status: 'DRAFT'
  formatVersion: 'JV-INVOICE-DRAFT-1'
  source: { issuedProposalNumber: number; dealNumber: string; commercial: ProposalPayload }
  details: Details
  missingRequisites: string[]
}

export const invoiceEditorPath = (deal: string, id: string) =>
  `/jv/invoice-drafts/${encodeURIComponent(deal)}/${encodeURIComponent(id)}`
const invoiceApiPath = (deal: string, id: string) =>
  `/jv/deals/${encodeURIComponent(deal)}/invoice-drafts/${encodeURIComponent(id)}`

function InvoiceSource({ draft }: { draft: InvoiceDraft }) {
  const { dealNumber, issuedProposalNumber, commercial } = draft.source
  return (
    <>
      <p className="text-sm">Сделка №{dealNumber} · КП №{issuedProposalNumber} · JV-заказ №{commercial.orderNumber}, версия {commercial.orderVersion}</p>
      <ProposalAmounts payload={commercial} />
      {commercial.terms && <section className="space-y-2">
        <h2 className="font-semibold">Условия исходного КП</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          {proposalTermLabels.map(([key, label]) => <div key={key}>
            <dt className="font-medium">{label}</dt>
            <dd className="jv-proposal-term whitespace-pre-wrap">{commercial.terms?.[key]}</dd>
          </div>)}
        </dl>
      </section>}
    </>
  )
}

function RequisitesStatus({ draft }: { draft: InvoiceDraft }) {
  return <p role="status" className="text-sm font-medium">
    {draft.missingRequisites.length ? 'Требуется заполнение реквизитов' : 'Реквизиты введены · требуется проверка'}
  </p>
}

function InvoiceForm({ initial, dealId, path, queryKey }: {
  initial: InvoiceDraft; dealId: string; path: string; queryKey: readonly string[]
}) {
  const [saved, setSaved] = useState(initial)
  const [details, setDetails] = useState(initial.details)
  const [reloadError, setReloadError] = useState(false)
  const [reloading, setReloading] = useState(false)
  const cache = useQueryClient()
  const saving = useMutation({
    mutationFn: () => api.put<InvoiceDraft>(path, { version: saved.version, details }).then(res => res.data),
    onSuccess: update => {
      cache.setQueryData(queryKey, update)
      setSaved(update)
      setDetails(update.details)
    },
  })
  const conflict = axios.isAxiosError(saving.error) && saving.error.response?.data?.error?.code === 'VERSION_CONFLICT'
  const dirty = JSON.stringify(saved.details) !== JSON.stringify(details)
  async function refresh() {
    if (dirty && !window.confirm('Загрузить сохранённую версию? Введённые здесь изменения будут потеряны.')) return
    setReloadError(false)
    setReloading(true)
    try {
      const { data } = await api.get<InvoiceDraft>(path)
      cache.setQueryData(queryKey, data)
      setSaved(data)
      setDetails(data.details)
      saving.reset()
    } catch { setReloadError(true) }
    finally { setReloading(false) }
  }

  function fields(side: 'seller' | 'buyer', labels: Record<string, string>, title: string) {
    return <fieldset className="space-y-2 rounded border p-3" disabled={saving.isPending || reloading}>
      <legend className="px-1 font-semibold">{title}</legend>
      {Object.entries(labels).map(([key, label]) => (
        <label className="block space-y-1 text-sm" key={key}>
          <span>{label}</span>
          <Input aria-label={`${title} — ${label}`} maxLength={300} value={(details[side] as Record<string, string>)[key]}
            onChange={event => setDetails(state => ({ ...state, [side]: { ...state[side], [key]: event.target.value } }))} />
        </label>
      ))}
    </fieldset>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link to={dealDetailPath(dealId)} className="text-sm text-primary underline">К сделке №{saved.source.dealNumber}</Link>
      <h1 className="text-xl font-semibold">Проект счёта по КП №{saved.source.issuedProposalNumber}</h1>
      <section className="jv-proposal-sheet space-y-3 rounded-lg border bg-card p-4"><InvoiceSource draft={saved} /></section>
      <RequisitesStatus draft={saved} />
      <div className="grid gap-3 md:grid-cols-2">{fields('seller', sellerFields, 'Продавец')}{fields('buyer', partyFields, 'Покупатель')}</div>
      <label className="block space-y-1 text-sm">
        <span>Примечания</span>
        <textarea aria-label="Примечания" className="block min-h-20 w-full rounded border bg-background p-2" maxLength={2000}
          disabled={saving.isPending || reloading} value={details.notes}
          onChange={event => setDetails(state => ({ ...state, notes: event.target.value }))} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!dirty || saving.isPending || conflict || reloading} onClick={() => saving.mutate()}>Сохранить проект</Button>
        {dirty ? <span className="text-sm text-muted-foreground">Сохраните изменения перед печатью.</span>
          : <Link className={buttonVariants({ variant: 'outline' })} to={invoiceEditorPath(dealId, saved.id) + '/print'} target="_blank" rel="noopener">Печатная форма</Link>}
        {saving.isSuccess && !dirty && <span role="status">Сохранено, версия {saved.version}</span>}
      </div>
      {saving.isError && <p role="alert">{conflict
        ? 'Проект изменился в другой вкладке. Ваши реквизиты пока остаются на экране.'
        : 'Не удалось сохранить проект. Введённые реквизиты сохранены в форме.'}</p>}
      {conflict && <Button variant="outline" disabled={reloading} onClick={() => void refresh()}>Загрузить сохранённую версию</Button>}
      {reloadError && <p role="alert">Не удалось загрузить сохранённую версию.</p>}
    </div>
  )
}

function PrintedInvoice({ draft, dealId }: { draft: InvoiceDraft; dealId: string }) {
  return (
    <main className="jv-proposal-page mx-auto max-w-4xl space-y-4 p-3 sm:p-6">
      <nav className="jv-proposal-actions flex flex-wrap justify-between gap-2">
        <Link className="text-primary underline" to={invoiceEditorPath(dealId, draft.id)}>К проекту счёта</Link>
        <Button onClick={() => window.print()}>Печать / сохранить PDF</Button>
      </nav>
      <article className="jv-proposal-sheet space-y-4 rounded border bg-white p-5 text-slate-900 sm:p-8">
        <header>
          <p className="font-bold uppercase">ПРОЕКТ — НЕ ВЫСТАВЛЕН</p>
          <h1 className="mt-2 text-xl font-semibold">Проект счёта по КП №{draft.source.issuedProposalNumber}</h1>
        </header>
        <RequisitesStatus draft={draft} />
        <div className="grid gap-3 sm:grid-cols-2">
          {(['seller', 'buyer'] as const).map(side => (
            <section key={side}>
              <h2 className="font-semibold">{side === 'seller' ? 'Продавец' : 'Покупатель'}</h2>
              <dl className="space-y-1 text-sm">
                {Object.entries(side === 'seller' ? sellerFields : partyFields).map(([key, label]) => <div key={key}>
                  <dt>{label}</dt><dd className="jv-proposal-term">{(draft.details[side] as Record<string, string>)[key] || '—'}</dd>
                </div>)}
              </dl>
            </section>
          ))}
        </div>
        <InvoiceSource draft={draft} />
        {draft.details.notes && <p className="jv-proposal-term whitespace-pre-wrap">{draft.details.notes}</p>}
      </article>
    </main>
  )
}

export default function JVInvoiceDraftPage({ print = false }: { print?: boolean }) {
  const { dealId, draftId } = useParams()
  const user = useAuthStore(state => state.user)
  const allowed = canIssueJvProposal(user?.role)
  const path = dealId && draftId ? invoiceApiPath(dealId, draftId) : ''
  const key = ['jv-invoice-draft', user?.id ?? '', path, print ? 'print' : 'edit']
  const { data, isPending, isError } = useQuery({
    queryKey: key, enabled: allowed && !!path, retry: false, refetchOnMount: 'always', refetchOnWindowFocus: false,
    queryFn: ({ signal }) => api.get<InvoiceDraft>(path, { signal }).then(res => res.data),
  })
  if (!allowed) return <p role="alert">Проекты счетов доступны владельцу и инженеру.</p>
  if (!dealId || !path || isError) return <p role="alert">Проект счёта недоступен.</p>
  if (isPending) return <p role="status">Загрузка проекта счёта…</p>
  if (!data || data.formatVersion !== 'JV-INVOICE-DRAFT-1' || data.status !== 'DRAFT') return <p role="alert">Версия проекта счёта не поддерживается.</p>
  return print ? <PrintedInvoice draft={data} dealId={dealId} />
    : <InvoiceForm key={data.id} initial={data} dealId={dealId} path={path} queryKey={key} />
}
