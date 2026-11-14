import { useState } from 'react'
import { RAL_COLORS } from '@/lib/ral'
import { Input } from '@/components/ui/input'

const FINISH_OPTIONS = [
  { value: 'matte', label: 'Матовый' },
  { value: 'gloss', label: 'Глянец' },
  { value: 'hammertone', label: 'Муар' },
]

interface Props {
  value: string
  finish?: string
  onChange: (code: string, finish: string) => void
}

export default function RalColorPicker({ value, finish = 'matte', onChange }: Props) {
  const [search, setSearch] = useState('')
  const [selectedFinish, setSelectedFinish] = useState(finish)

  const filtered = search
    ? RAL_COLORS.filter(c =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : RAL_COLORS

  const selected = RAL_COLORS.find(c => c.code === value)

  function handleColorSelect(code: string) {
    onChange(code, selectedFinish)
    setSearch('')
  }

  function handleFinishChange(f: string) {
    setSelectedFinish(f)
    if (value) onChange(value, f)
  }

  return (
    <div className="space-y-3">
      {/* Текущий выбор */}
      {selected && (
        <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
          <div className="w-8 h-8 rounded border shadow-sm shrink-0" style={{ backgroundColor: selected.hex }} />
          <div>
            <div className="font-mono text-sm font-medium">{selected.code}</div>
            <div className="text-xs text-muted-foreground">{selected.name}</div>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {FINISH_OPTIONS.find(f => f.value === selectedFinish)?.label}
          </div>
        </div>
      )}

      {/* Покрытие */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Покрытие</label>
        <div className="flex gap-2">
          {FINISH_OPTIONS.map(f => (
            <button key={f.value} type="button"
              onClick={() => handleFinishChange(f.value)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${selectedFinish === f.value ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Поиск */}
      <Input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по коду или названию (напр. RAL 9005)..." className="h-8 text-sm" />

      {/* Палитра */}
      <div className="grid grid-cols-8 gap-1 max-h-52 overflow-y-auto pr-1">
        {filtered.map(c => (
          <button key={c.code} type="button"
            title={`${c.code} ${c.name}`}
            onClick={() => handleColorSelect(c.code)}
            className={`relative group rounded border-2 transition-all ${value === c.code ? 'border-primary scale-110 z-10' : 'border-transparent hover:border-muted-foreground'}`}
            style={{ aspectRatio: '1', backgroundColor: c.hex }}>
            {/* Номер цвета при наведении */}
            <span className="absolute inset-0 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[8px] font-mono bg-black/60 text-white px-0.5 rounded-sm leading-tight mb-0.5 truncate max-w-full">
                {c.code.replace('RAL ', '')}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Код выбранного */}
      {value && (
        <div className="text-xs text-center text-muted-foreground">
          Выбрано: <span className="font-mono font-medium">{value}</span> · {selected?.name} · {FINISH_OPTIONS.find(f => f.value === selectedFinish)?.label}
        </div>
      )}
    </div>
  )
}
