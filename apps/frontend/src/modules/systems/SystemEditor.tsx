import { useState } from 'react'
import { ArrowLeft, Plus, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUpdateSystem, type GlazingSystem } from '@/api/systems'
import ParametersPanel from './ParametersPanel'
import ComponentsPanel from './ComponentsPanel'
import GlassPanel from './GlassPanel'
import FormulaHints from './FormulaHints'
import SystemCalculator from './SystemCalculator'

type Tab = 'params' | 'components' | 'glasses' | 'hints' | 'test'

interface Props { system: GlazingSystem; onBack: () => void }

export default function SystemEditor({ system, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('params')
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(system.name)
  const updateSystem = useUpdateSystem()

  async function saveName() {
    if (name.trim() && name !== system.name) await updateSystem.mutateAsync({ id: system.id, name: name.trim() })
    setEditingName(false)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'params', label: 'Параметры' },
    { id: 'components', label: 'Комплектующие' },
    { id: 'glasses', label: 'Стёкла' },
    { id: 'hints', label: 'Справка по формулам' },
    { id: 'test', label: 'Тест расчёта' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} className="mr-1" />Назад</Button>
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-lg font-semibold w-64"
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }} autoFocus />
            <Button size="sm" onClick={saveName}>Сохранить</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Отмена</Button>
          </div>
        ) : (
          <h1 className="text-xl font-semibold cursor-pointer hover:underline" onClick={() => setEditingName(true)}>
            {system.name}
          </h1>
        )}
        {!system.isActive && <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">Неактивна</span>}
      </div>

      <div className="flex border-b gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${tab === t.id ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'params' && <ParametersPanel system={system} />}
      {tab === 'components' && <ComponentsPanel system={system} />}
      {tab === 'glasses' && <GlassPanel systemId={system.id} />}
      {tab === 'hints' && <FormulaHints />}
      {tab === 'test' && <SystemCalculator system={system} />}
    </div>
  )
}
