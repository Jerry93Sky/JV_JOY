import { useState } from 'react'
import { Clock, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Task {
  id: string
  description: string
  scheduledAt: string
  doneAt: string | null
  doneComment?: string | null
}

interface Props { dealId: string }

export default function TasksBlock({ dealId }: Props) {
  const qc = useQueryClient()
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['deal-tasks', dealId],
    queryFn: () => api.get(`/deals/${dealId}/tasks`).then(r => r.data),
  })

  const [adding, setAdding] = useState(false)
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState('')

  const createTask = useMutation({
    mutationFn: (d: { description: string; scheduledAt: string }) =>
      api.post(`/deals/${dealId}/tasks`, d).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-tasks', dealId] })
      setAdding(false); setDesc(''); setDate('')
    },
  })

  const doneTask = useMutation({
    mutationFn: (taskId: string) =>
      api.post(`/deals/${dealId}/tasks/${taskId}/done`, {}).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal-tasks', dealId] }),
  })

  const pending = tasks.filter(t => !t.doneAt)
  const done = tasks.filter(t => !!t.doneAt)
  const overdue = pending.filter(t => new Date(t.scheduledAt) < new Date())

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Clock size={14} />Задачи
          {overdue.length > 0 && (
            <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
              {overdue.length} просрочено
            </span>
          )}
        </h3>
        <button onClick={() => setAdding(v => !v)} className="text-xs text-primary hover:underline">
          + добавить
        </button>
      </div>

      {adding && (
        <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Описание задачи" />
          <Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createTask.mutate({ description: desc, scheduledAt: date })}
              disabled={!desc || !date || createTask.isPending}>
              Создать
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Отмена</Button>
          </div>
        </div>
      )}

      {pending.map(t => {
        const isOverdue = new Date(t.scheduledAt) < new Date()
        return (
          <div key={t.id}
            className={`flex items-start gap-2 text-sm p-2 rounded ${isOverdue ? 'bg-red-500/10 border border-red-500/20' : 'bg-muted/20'}`}>
            <button onClick={() => doneTask.mutate(t.id)}
              className="mt-0.5 shrink-0 hover:text-green-500 transition-colors">
              <div className="w-4 h-4 rounded border border-current" />
            </button>
            <div className="flex-1">
              <div>{t.description}</div>
              <div className={`text-xs ${isOverdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                {format(new Date(t.scheduledAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                {isOverdue && ' — просрочено'}
              </div>
            </div>
          </div>
        )
      })}

      {done.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Выполнено ({done.length})
          </summary>
          <div className="mt-2 space-y-1">
            {done.map(t => (
              <div key={t.id} className="flex items-center gap-2 line-through opacity-60">
                <Check size={12} className="text-green-500 shrink-0" />
                {t.description}
              </div>
            ))}
          </div>
        </details>
      )}

      {tasks.length === 0 && !adding && (
        <div className="text-xs text-muted-foreground">Задач нет</div>
      )}
    </div>
  )
}
