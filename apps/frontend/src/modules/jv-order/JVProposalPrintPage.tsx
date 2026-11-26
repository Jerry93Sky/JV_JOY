import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import api from '@/api/client'
import { canCalculateJv } from '@/api/jv'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { exact } from './jvResultAdapter'
import { displayProposalMoney } from './proposalMoney'
import { proposalDraftPath, proposalTermLabels, type ProposalDraft } from './proposalDraft'
import './jvProposalPrint.css'

const profiles = { COMPLETATION: 'Комплектация', RETAIL: 'Розница' }
const familyNames: Record<string, string> = {
  LINE: 'JV-Line', ZIGZAG: 'JV-Zigzag', SLIDER_L3: 'Slider L3', SLIDER_L5: 'Slider L5',
  SLIDER_X3: 'Slider X3', SLIDER_X5: 'Slider X5', FRONT: 'JV-Front',
}

type LoadState = { path: string } & ({ proposal: ProposalDraft } | { error: string })

function Money({ value }: { value: unknown }) {
  const amount = displayProposalMoney(value)
  if (!amount) return <>—</>
  return <>{amount.text} ₽{amount.rounded && <small className="block">округлено</small>}</>
}

function ProposalDocument({ proposal }: { proposal: ProposalDraft }) {
  const { payload } = proposal
  const printStatus = {
    DRAFT: 'не утверждён',
    IN_REVIEW: 'на согласовании',
    APPROVED: 'согласован внутри',
    CHANGES_REQUESTED: 'возвращён на доработку',
  }[proposal.review?.status ?? 'DRAFT']
  return (
    <article className="jv-proposal-sheet rounded-lg border border-slate-300 bg-white p-5 text-slate-900 sm:p-8" aria-labelledby="proposal-title">
      <header className="mb-6 border-b border-slate-300 pb-4">
        <p className="mb-1 text-sm font-bold uppercase tracking-wide">Черновик · {printStatus}</p>
        <h1 id="proposal-title" className="text-xl font-bold sm:text-2xl">Коммерческое предложение №{proposal.number}</h1>
        <p className="mt-2 text-sm">Заказ №{payload.orderNumber} · версия {payload.orderVersion} · {profiles[payload.profile]}</p>
        <p className="text-sm">Дата черновика {new Date(proposal.createdAt).toLocaleDateString('ru-RU')}</p>
      </header>

      <section className="mb-6" aria-labelledby="proposal-terms">
        <h2 id="proposal-terms" className="mb-2 font-semibold">Условия</h2>
        <dl className="grid gap-3">
          {proposalTermLabels.map(([key, label]) => (
            <div key={key}>
              <dt className="text-sm font-medium">{label}</dt>
              <dd className="jv-proposal-term whitespace-pre-wrap">{payload.terms?.[key] || 'Не заполнено'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <table className="w-full text-left text-sm">
        <caption className="mb-2 text-left font-semibold">Состав заказа</caption>
        <thead className="border-b border-slate-400">
          <tr><th scope="col">Слот</th><th scope="col">Система</th><th scope="col">Кол-во</th><th scope="col">Цена за единицу</th></tr>
        </thead>
        <tbody>
          {payload.positions.map(position => (
            <tr className="border-b border-slate-200" key={position.id}>
              <td>{position.slot}</td>
              <td>{familyNames[position.family] ?? position.family}</td>
              <td>{exact(position.quantity)}</td>
              <td><Money value={position.confirmedUnitAmount} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="jv-proposal-total mt-4 text-right text-lg font-semibold">
        Итого по заказу <Money value={payload.totalSalePrice} />
      </footer>
    </article>
  )
}

export default function JVProposalPrintPage() {
  const { orderId, proposalId } = useParams()
  const role = useAuthStore(state => state.user?.role)
  const allowed = canCalculateJv(role)
  const path = orderId && proposalId ? proposalDraftPath(orderId, proposalId) : null
  const [state, setState] = useState<LoadState | null>(null)

  useEffect(() => {
    if (!allowed || !path) return
    const controller = new AbortController()
    api.get<ProposalDraft>(path, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return
      if (data.formatVersion !== 'JV-PROPOSAL-DRAFT-1') {
        setState({ path, error: 'Версия черновика не поддерживается для печати.' })
        return
      }
      setState({ path, proposal: data })
    }).catch(error => {
      if (controller.signal.aborted) return
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      const message = status === 403 ? 'Недостаточно прав для просмотра черновика КП.'
        : status === 404 ? 'Черновик КП не найден.'
        : status === 409 ? 'Не удалось подтвердить целостность черновика КП.'
        : 'Не удалось загрузить черновик КП.'
      setState({ path, error: message })
    })
    return () => controller.abort()
  }, [allowed, path])

  const current = state?.path === path ? state : null
  const proposal = allowed && current && 'proposal' in current ? current.proposal : null
  const error = !allowed ? 'Недостаточно прав для просмотра черновика КП.'
    : !path ? 'Черновик КП не найден.'
    : current && 'error' in current ? current.error : null

  return (
    <main className="jv-proposal-page mx-auto max-w-4xl space-y-4 p-3 sm:p-6">
      <nav className="jv-proposal-actions flex flex-wrap items-center justify-between gap-3" aria-label="Действия с черновиком КП">
        <Link to="/jv/orders/new" className="text-primary underline">К редактору заказов</Link>
        {proposal && <Button type="button" onClick={() => window.print()}>Печать / сохранить PDF</Button>}
      </nav>
      {proposal ? <ProposalDocument proposal={proposal} />
        : error ? <p role="alert">{error}</p>
        : <p role="status">Загрузка черновика КП…</p>}
    </main>
  )
}
