import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeal, useDeals } from '@/api/deals'
import { Button } from '@/components/ui/button'
import { dealDetailPath } from './proposalDraft'

interface Props {
  dealId?: string
  disabled: boolean
  onChange: (dealId?: string) => void
}

export function JVOrderDealPicker({ dealId, disabled, onChange }: Props) {
  const [choosing, setChoosing] = useState(false)
  const { data: current } = useDeal(dealId ?? '')
  const { data: deals, isPending, isError } = useDeals({ showCompleted: true }, choosing)

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Сделка</span>
      {current ? <Link className="text-primary underline" to={dealDetailPath(current.id)}>№{current.number}</Link>
        : <span className="text-muted-foreground">{dealId ? 'Выбрана' : 'Без привязки'}</span>}
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setChoosing(open => !open)} aria-expanded={choosing}>
        {choosing ? 'Закрыть выбор' : 'Выбрать сделку'}
      </Button>
      {choosing && (
        <>
          <select aria-label="Сделка для JV-заказа" value={dealId ?? ''} disabled={disabled || isPending || isError}
            className="max-w-full rounded border bg-background px-2 py-1"
            onChange={event => { onChange(event.target.value || undefined); setChoosing(false) }}>
            <option value="">Без привязки</option>
            {dealId && !deals?.some(deal => deal.id === dealId) && <option value={dealId}>Текущая сделка</option>}
            {deals?.map(deal => (
              <option key={deal.id} value={deal.id}>
                №{deal.number}{deal.contact ? ` · ${deal.contact.lastName} ${deal.contact.firstName}` : ''}
              </option>
            ))}
          </select>
          {isError && <p role="alert">Не удалось загрузить список сделок.</p>}
        </>
      )}
    </div>
  )
}
