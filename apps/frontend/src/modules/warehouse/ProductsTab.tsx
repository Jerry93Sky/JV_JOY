import { useState } from 'react'
import { Plus, Pencil, Search, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProducts, useProductTypes, type Product } from '@/api/warehouse'
import ProductDialog from './ProductDialog'

export default function ProductsTab() {
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const { data: products = [], isLoading } = useProducts(search || undefined, typeId || undefined)
  const { data: types = [] } = useProductTypes()

  const freeQty = (p: Product) => Number(p.quantity) - Number(p.reservedQty)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input placeholder="Поиск по названию или артикулу..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={typeId} onChange={e => setTypeId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <option value="">Все типы</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} className="mr-1" />Добавить товар</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Артикул</th>
              <th className="text-left px-4 py-2 font-medium">Наименование</th>
              <th className="text-left px-4 py-2 font-medium">Тип</th>
              <th className="text-left px-4 py-2 font-medium">Ед.</th>
              <th className="text-right px-4 py-2 font-medium">На складе</th>
              <th className="text-right px-4 py-2 font-medium">Резерв</th>
              <th className="text-right px-4 py-2 font-medium">Свободно</th>
              <th className="text-right px-4 py-2 font-medium">Цена розн.</th>
              <th className="text-right px-4 py-2 font-medium">Цена опт.</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Загрузка...</td></tr>}
            {!isLoading && products.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Товары не найдены</td></tr>}
            {products.map(p => {
              const free = freeQty(p)
              return (
                <tr key={p.id} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-2 font-medium">
                    <div className="flex items-center gap-1">
                      {p.isPaintable && <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title="Окрашиваемый" />}
                      {p.name}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{p.type.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.unit}</td>
                  <td className="px-4 py-2 text-right">{Number(p.quantity).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-amber-400">{Number(p.reservedQty).toFixed(2)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${free < 0 ? 'text-destructive' : free === 0 ? 'text-amber-400' : ''}`}>
                    <div className="flex items-center justify-end gap-1">
                      {free < 0 && <AlertTriangle size={13} />}
                      {free.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">{Number(p.priceRetail).toLocaleString('ru-RU')} ₽</td>
                  <td className="px-4 py-2 text-right text-blue-600">{Number(p.priceWholesale).toLocaleString('ru-RU')} ₽</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil size={14} /></Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ProductDialog product={editing ?? undefined} onClose={() => { setCreating(false); setEditing(null) }} />
      )}
    </div>
  )
}
