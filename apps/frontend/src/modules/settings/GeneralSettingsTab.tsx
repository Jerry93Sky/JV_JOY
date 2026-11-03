import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppSettings, useUpdateSettings } from '@/api/settings'

export default function GeneralSettingsTab() {
  const { data: settings } = useAppSettings()
  const update = useUpdateSettings()
  const [glassMarkup, setGlassMarkup] = useState('')

  useEffect(() => {
    if (settings) setGlassMarkup(settings.glass_markup_pct || '30')
  }, [settings])

  async function handleSave() {
    await update.mutateAsync({ glass_markup_pct: glassMarkup })
  }

  return (
    <div className="space-y-4 max-w-sm">
      <div>
        <label className="text-sm font-medium block mb-1">Наценка на стекло %</label>
        <p className="text-xs text-muted-foreground mb-2">Применяется при расчёте отпускной цены стекла в заказах</p>
        <div className="flex gap-2">
          <Input type="number" step="0.1" value={glassMarkup} onChange={e => setGlassMarkup(e.target.value)} className="w-32" />
          <Button size="sm" onClick={handleSave} disabled={update.isPending}>Сохранить</Button>
        </div>
      </div>
    </div>
  )
}
