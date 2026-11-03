import { useState } from 'react'
import { MessageSquare, ArrowRight, CreditCard, Package, User, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface DealEvent {
  id: string; type: string; content?: string; userId?: string; createdAt: string
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  CREATED: <Plus size={13} className="text-green-500" />,
  STAGE_CHANGED: <ArrowRight size={13} className="text-blue-500" />,
  COMMENT_ADDED: <MessageSquare size={13} className="text-gray-500" />,
  ITEMS_UPDATED: <Package size={13} className="text-amber-500" />,
  ASSIGNEE_CHANGED: <User size={13} className="text-purple-500" />,
  PAYMENT_RECEIVED: <CreditCard size={13} className="text-green-600" />,
}

interface Props { dealId: string; events: DealEvent[] }

export default function DealTimeline({ dealId, events }: Props) {
  const [comment, setComment] = useState('')
  const qc = useQueryClient()
  const addComment = useMutation({
    mutationFn: (content: string) => api.post(`/deals/${dealId}/comment`, { content }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals', dealId] }); setComment('') },
  })

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="font-medium text-sm">История</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {events.length === 0 && <p className="text-xs text-muted-foreground">Нет событий</p>}
        {events.map(ev => (
          <div key={ev.id} className="flex items-start gap-2 text-sm">
            <div className="mt-0.5 shrink-0">{EVENT_ICONS[ev.type] || <MessageSquare size={13} />}</div>
            <div className="flex-1 min-w-0">
              <span className="text-sm">{ev.content}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {format(new Date(ev.createdAt), 'dd.MM HH:mm', { locale: ru })}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1 border-t">
        <Input value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Добавить комментарий..."
          onKeyDown={e => e.key === 'Enter' && comment.trim() && addComment.mutate(comment)}
          className="flex-1 h-8 text-sm" />
        <Button size="sm" onClick={() => addComment.mutate(comment)} disabled={!comment.trim() || addComment.isPending}>
          Добавить
        </Button>
      </div>
    </div>
  )
}
