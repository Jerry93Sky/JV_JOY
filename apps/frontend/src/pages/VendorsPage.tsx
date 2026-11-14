import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Star, Paintbrush } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useVendorCategories, useVendors, useCreateVendorCategory, useDeleteVendorCategory,
  useCreateVendor, useUpdateVendor, useDeleteVendor,
  type Vendor, type VendorCategory,
} from '@/api/vendors'

// ── Диалог создания/редактирования поставщика ─────────────────────────────────

interface VendorDialogProps {
  initial?: Vendor
  categories: VendorCategory[]
  defaultCategoryId?: string
  onClose: () => void
}

function VendorDialog({ initial, categories, defaultCategoryId, onClose }: VendorDialogProps) {
  const create = useCreateVendor()
  const update = useUpdateVendor()
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    categoryId: initial?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    comment: initial?.comment ?? '',
    isPainting: initial?.isPainting ?? false,
    isDefault: initial?.isDefault ?? false,
    isActive: initial?.isActive ?? true,
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const busy = create.isPending || update.isPending

  const handleSave = async () => {
    if (!form.name.trim() || !form.categoryId) return
    if (initial) {
      await update.mutateAsync({ id: initial.id, ...form })
    } else {
      await create.mutateAsync(form as never)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{initial ? 'Редактировать поставщика' : 'Новый поставщик'}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Название *</label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Название компании" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Категория *</label>
          <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Телефон</label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+7..." />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Email</label>
            <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@..." />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Адрес</label>
          <Input value={form.address} onChange={e => set('address', e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Комментарий</label>
          <Input value={form.comment} onChange={e => set('comment', e.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.isPainting} onChange={e => set('isPainting', e.target.checked)} />
            <Paintbrush size={14} className="text-orange-400" />
            Покрасочная компания
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} />
            <Star size={14} className="text-yellow-400" />
            Поставщик по умолчанию в категории
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
            Активен
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={busy || !form.name.trim()}>
            {busy ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Основная страница ─────────────────────────────────────────────────────────

export default function VendorsPage() {
  const { data: categories = [] } = useVendorCategories()
  const { data: vendors = [] } = useVendors()
  const createCategory = useCreateVendorCategory()
  const deleteCategory = useDeleteVendorCategory()
  const deleteVendor = useDeleteVendor()

  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [editing, setEditing] = useState<Vendor | null | 'new'>(null)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  const filteredVendors = selectedCat
    ? vendors.filter(v => v.categoryId === selectedCat)
    : vendors

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    await createCategory.mutateAsync(newCatName.trim())
    setNewCatName('')
    setAddingCat(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Поставщики</h1>
        <Button size="sm" onClick={() => setEditing('new')} disabled={categories.length === 0}>
          <Plus size={14} className="mr-1" />Добавить поставщика
        </Button>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-4">
        {/* Левая колонка — категории */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Категории</span>
            <button onClick={() => setAddingCat(true)} className="text-xs text-primary hover:underline">+ добавить</button>
          </div>

          {addingCat && (
            <div className="flex gap-1">
              <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Название" className="h-7 text-xs"
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setAddingCat(false) }}
                autoFocus />
              <button onClick={handleAddCategory} className="text-xs text-primary px-1">✓</button>
              <button onClick={() => setAddingCat(false)} className="text-xs text-muted-foreground px-1">✕</button>
            </div>
          )}

          <button onClick={() => setSelectedCat(null)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${!selectedCat ? 'bg-primary/20 text-primary' : 'hover:bg-muted'}`}>
            Все ({vendors.length})
          </button>

          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-1 group">
              <button onClick={() => setSelectedCat(cat.id)}
                className={`flex-1 text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedCat === cat.id ? 'bg-primary/20 text-primary' : 'hover:bg-muted'}`}>
                {cat.name}
                <span className="text-muted-foreground ml-1 text-xs">({cat._count?.vendors ?? 0})</span>
              </button>
              <button onClick={() => deleteCategory.mutate(cat.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity">
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">Нет категорий. Добавьте первую.</p>
          )}
        </div>

        {/* Правая колонка — список поставщиков */}
        <div className="space-y-2">
          {filteredVendors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg text-sm">
              {categories.length === 0
                ? 'Сначала создайте категорию поставщиков'
                : 'Поставщиков нет. Нажмите «Добавить поставщика».'}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground bg-muted">
                    <th className="text-left p-3">Название</th>
                    <th className="text-left p-3">Категория</th>
                    <th className="text-left p-3">Телефон</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-center p-3">Флаги</th>
                    <th className="text-center p-3">Статус</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map(v => (
                    <tr key={v.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">
                        {v.name}
                        {v.comment && <div className="text-xs text-muted-foreground font-normal truncate max-w-[200px]">{v.comment}</div>}
                      </td>
                      <td className="p-3 text-muted-foreground">{v.category.name}</td>
                      <td className="p-3 text-muted-foreground">{v.phone || '—'}</td>
                      <td className="p-3 text-muted-foreground">{v.email || '—'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {v.isDefault && <span title="По умолчанию"><Star size={14} className="text-yellow-400" /></span>}
                          {v.isPainting && <span title="Покрасочная"><Paintbrush size={14} className="text-orange-400" /></span>}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${v.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                          {v.isActive ? 'активен' : 'неактивен'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setEditing(v)} className="p-1 hover:text-primary"><Pencil size={13} /></button>
                          <button onClick={() => deleteVendor.mutate(v.id)} className="p-1 hover:text-destructive"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <VendorDialog
          initial={editing === 'new' ? undefined : editing}
          categories={categories}
          defaultCategoryId={selectedCat ?? undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
