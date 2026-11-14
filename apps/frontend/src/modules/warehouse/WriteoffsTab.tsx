import { useState } from 'react'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWriteoffs } from '@/api/warehouse'
import WriteoffDialog from './WriteoffDialog'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const REASON_LABELS: Record<string, string> = { INVENTORY: 'Инвентаризация', DEFECT: 'Брак' }

export default function WriteoffsTab() {
  const { data: writeoffs = [], isLoading } = useWriteoffs()
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} className="mr-1" />Оформить списание</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="text-left px-4 py-2 font-medium">Дата</th>
              <th className="text-left px-4 py-2 font-medium">Причина</th>
              <th className="text-left px-4 py-2 font-medium">Комментарий</th>
              <th className="text-left px-4 py-2 font-medium">Позиций</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Загрузка...</td></tr>}
            {writeoffs.map(w => {
              const isOpen = expanded === w.id
              return (
                <>
                  <tr key={w.id} className="border-t hover:bg-muted/50 cursor-pointer" onClick={() => setExpanded(isOpen ? null : w.id)}>
                    <td className="px-2 py-2 text-muted-foreground">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    <td className="px-4 py-2">{format(new Date(w.date), 'dd.MM.yyyy', { locale: ru })}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${w.reason === 'DEFECT' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-secondary-foreground'}`}>
                        {REASON_LABELS[w.reason]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{w.comment}</td>
                    <td className="px-4 py-2 text-muted-foreground">{w.items.length}</td>
                  </tr>
                  {isOpen && (
                    <tr key={`${w.id}-detail`} className="bg-muted/30">
                      <td colSpan={5} className="px-8 py-3">
                        <table className="w-full text-xs">
                          <thead><tr className="text-muted-foreground"><th className="text-left pb-1">Товар</th><th className="text-right pb-1">Кол-во</th></tr></thead>
                          <tbody>
                            {w.items.map((item, i) => (
                              <tr key={i} className="border-t border-border/50">
                                <td className="py-1">{item.product?.name}</td>
                                <td className="text-right py-1">{Number(item.quantity)} {item.product?.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
            {!isLoading && writeoffs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Списаний нет</td></tr>}
          </tbody>
        </table>
      </div>

      {creating && <WriteoffDialog onClose={() => setCreating(false)} />}
    </div>
  )
}
