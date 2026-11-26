import { useState } from 'react'
import axios from 'axios'
import api from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  proposalDraftPath, proposalReviewLabels, proposalTermLabels,
  type ProposalDraft, type ProposalReview, type ProposalReviewAction,
} from './proposalDraft'

interface Props {
  orderId: string
  proposal: ProposalDraft
  role: string | undefined
  termsUnsaved: boolean
  onChange: (proposalId: string, review: ProposalReview) => void
}

export function JVProposalReview({ orderId, proposal, role, termsUnsaved, onChange }: Props) {
  const [comment, setComment] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const status = proposal.review?.status ?? 'DRAFT'
  const termsComplete = proposalTermLabels.every(([key]) => proposal.payload.terms?.[key]?.trim())
  const canDecide = status === 'IN_REVIEW' && role === 'OWNER'
  const blocked = pending || termsUnsaved

  async function transition(action: ProposalReviewAction) {
    setPending(true)
    setError('')
    try {
      const { data } = await api.post<ProposalReview>(proposalDraftPath(orderId, proposal.id) + '/review', {
        action,
        ...(action === 'RETURN' ? { comment: comment.trim() } : {}),
      })
      onChange(proposal.id, data)
      setComment('')
    } catch (err) {
      const response = axios.isAxiosError<{ review?: ProposalReview; error?: { code: string } }>(err) ? err.response?.data : undefined
      if (response?.error?.code === 'PROPOSAL_REVIEW_CONFLICT' && response.review) {
        onChange(proposal.id, response.review)
        setError('Статус версии изменился. Показан актуальный результат.')
      } else {
        setError('Не удалось изменить статус КП. Откройте сохранённую версию повторно и проверьте её статус.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <fieldset className="space-y-2 rounded border p-3">
      <legend className="px-1 font-semibold">Внутреннее согласование</legend>
      <p role="status">Статус КП: {proposalReviewLabels[status]}</p>
      {termsUnsaved && (status === 'DRAFT' || canDecide) &&
        <p className="text-sm text-muted-foreground">Сохраните условия новой версией или восстановите сохранённые значения.</p>}
      {status === 'DRAFT' && (
        <>
          {!termsComplete && <p className="text-sm text-muted-foreground">Для согласования сохраните все пять условий КП.</p>}
          <Button variant="outline" disabled={blocked || !termsComplete} onClick={() => void transition('SUBMIT')}>
            Передать на согласование
          </Button>
        </>
      )}
      {canDecide && (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="block">Комментарий для возврата</span>
            <textarea className="min-h-16 w-full rounded border bg-background p-2" maxLength={1000}
              value={comment} onChange={event => setComment(event.target.value)} disabled={blocked} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={blocked} onClick={() => void transition('APPROVE')}>Согласовать КП</Button>
            <Button variant="outline" disabled={blocked || !comment.trim()} onClick={() => void transition('RETURN')}>Вернуть на доработку</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!!proposal.review?.events.length && (
        <ol aria-label="История согласования" className="list-inside list-decimal space-y-1 text-sm">
          {proposal.review.events.map(event => (
            <li key={event.sequence}>
              {proposalReviewLabels[event.status]} · {event.actorRole === 'OWNER' ? 'Владелец' : 'Администратор'} ·{' '}
              {new Date(event.createdAt).toLocaleString('ru-RU')}
              {event.comment && <p className="whitespace-pre-wrap break-words">{event.comment}</p>}
            </li>
          ))}
        </ol>
      )}
    </fieldset>
  )
}
