import { useState } from 'react'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReceipts, type Receipt } from '@/api/warehouse'
import ReceiptDialog from './ReceiptDialog'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function ReceiptsTab() {
  const { data: receipts = [], isLoading } = useReceipts()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Receipt | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} className="mr-1" />Оформить приход</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="text-left px-4 py-2 font-medium">Дата</th>
              <th className="text-left px-4 py-2 font-medium">Поставщик</th>
              <th className="text-left px-4 py-2 font-medium">Позиций</th>
              <th className="text-right px-4 py-2 font-medium">Сумма</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Загрузка...</td></tr>}
            {receipts.map(r => {
              const total = r.items.reduce((s, i) => s + i.quantity * i.costPrice, 0)
              const isOpen = expanded === r.id
              const canEdit = new Date() <= new Date(r.editableUntil)
              return (
                <>
                  <tr key={r.id} className="border-t hover:bg-muted/50 cursor-pointer" onClick={() => setExpanded(isOpen ? null : r.id)}>
                    <td className="px-2 py-2 text-muted-foreground">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    <td className="px-4 py-2">{format(new Date(r.date), 'dd.MM.yyyy', { locale: ru })}</td>
                    <td className="px-4 py-2 font-medium">{r.supplier.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.items.length}</td>
                    <td className="px-4 py-2 text-right font-medium">{total.toLocaleString('ru-RU')} ₽</td>
                    <td className="px-4 py-2 text-right">
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditing(r) }}>Изменить</Button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${r.id}-detail`} className="bg-muted/30">
                      <td colSpan={6} className="px-8 py-3">
                        <table className="w-full text-xs">
                          <thead><tr className="text-muted-foreground"><th className="text-left pb-1">Товар</th><th className="text-right pb-1">Кол-во</th><th className="text-right pb-1">Цена закупки</th><th className="text-right pb-1">Сумма</th></tr></thead>
                          <tbody>
                            {r.items.map((item, i) => (
                              <tr key={i} className="border-t border-border/50">
                                <td className="py-1">{item.product?.name}</td>
                                <td className="text-right py-1">{item.quantity} {item.product?.unit}</td>
                                <td className="text-right py-1">{Number(item.costPrice).toLocaleString('ru-RU')} ₽</td>
                                <td className="text-right py-1">{(item.quantity * item.costPrice).toLocaleString('ru-RU')} ₽</td>
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
            {!isLoading && receipts.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Приходов нет</td></tr>}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ReceiptDialog receipt={editing ?? undefined} onClose={() => { setCreating(false); setEditing(null) }} />
      )}
    </div>
  )
}
