import { useState } from 'react'
import { Plus, Settings, Power, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSystems, useCreateSystem, useUpdateSystem, useDeleteSystem, type GlazingSystem } from '@/api/systems'
import SystemEditor from '@/modules/systems/SystemEditor'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function SystemsPage() {
  const [showInactive, setShowInactive] = useState(false)
  const [selected, setSelected] = useState<GlazingSystem | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const { data: systems = [], isLoading } = useSystems(showInactive)
  const createSystem = useCreateSystem()
  const updateSystem = useUpdateSystem()
  const deleteSystem = useDeleteSystem()

  async function handleCreate() {
    if (!newName.trim()) return
    const s = await createSystem.mutateAsync(newName.trim())
    setNewName('')
    setCreating(false)
    setSelected(s)
  }

  if (selected) {
    return <SystemEditor system={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Системы остекления</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Показать неактивные
          </label>
          <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} className="mr-1" />Новая система</Button>
        </div>
      </div>

      {isLoading && <div className="text-muted-foreground text-sm">Загрузка...</div>}

      <div className="grid gap-3">
        {systems.map(s => (
          <div key={s.id} className={`border rounded-lg p-4 flex items-center justify-between hover:bg-muted/30 transition-colors ${!s.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setSelected(s)}>
              <div>
                <div className="font-medium flex items-center gap-2">
                  {s.name}
                  {!s.isActive && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Неактивна</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {s.parameters.length} параметров · {s.components.length} комплектующих
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground ml-auto" />
            </div>
            <div className="flex items-center gap-1 ml-4">
              <Button variant="ghost" size="icon" title={s.isActive ? 'Деактивировать' : 'Активировать'}
                onClick={() => updateSystem.mutate({ id: s.id, isActive: !s.isActive })}>
                <Power size={15} className={s.isActive ? 'text-green-500' : 'text-muted-foreground'} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelected(s)}><Settings size={15} /></Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                onClick={() => { if (confirm(`Удалить систему "${s.name}"?`)) deleteSystem.mutate(s.id) }}>
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
        ))}
        {!isLoading && systems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            Систем пока нет. Создайте первую.
          </div>
        )}
      </div>

      {creating && (
        <Dialog open onOpenChange={() => setCreating(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Новая система</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Название системы</label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Например: Серия 45" autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreating(false)}>Отмена</Button>
                <Button onClick={handleCreate} disabled={createSystem.isPending}>Создать</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
