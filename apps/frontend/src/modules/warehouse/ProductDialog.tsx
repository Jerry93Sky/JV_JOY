import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateProduct, useUpdateProduct, useProductTypes, type Product } from '@/api/warehouse'

interface Props { product?: Product; onClose: () => void }
interface FormData {
  sku: string; name: string; typeId: string; unit: string
  isPaintable: boolean; markupRetail: number; markupWholesale: number
  priceRetail: number; priceWholesale: number
}

export default function ProductDialog({ product, onClose }: Props) {
  const { register, handleSubmit, reset, watch } = useForm<FormData>()
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const { data: types = [] } = useProductTypes()

  useEffect(() => {
    reset(product ? {
      sku: product.sku, name: product.name, typeId: product.typeId,
      unit: product.unit, isPaintable: product.isPaintable,
      markupRetail: Number(product.markupRetail), markupWholesale: Number(product.markupWholesale),
      priceRetail: Number(product.priceRetail), priceWholesale: Number(product.priceWholesale),
    } : { sku: '', name: '', typeId: types[0]?.id || '', unit: 'шт', isPaintable: false, markupRetail: 0, markupWholesale: 0, priceRetail: 0, priceWholesale: 0 })
  }, [product, types, reset])

  async function onSubmit(data: FormData) {
    if (product) await update.mutateAsync({ id: product.id, ...data })
    else await create.mutateAsync(data)
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? 'Редактировать товар' : 'Новый товар'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Артикул *</label>
              <Input {...register('sku', { required: true })} disabled={!!product} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ед. измерения *</label>
              <Input {...register('unit', { required: true })} placeholder="шт, м, кг..." />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Наименование *</label>
            <Input {...register('name', { required: true })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Тип комплектующих *</label>
            <select {...register('typeId', { required: true })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Наценка розничная %</label>
              <Input type="number" step="0.01" {...register('markupRetail', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Цена розничная ₽</label>
              <Input type="number" step="0.01" {...register('priceRetail', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Наценка оптовая %</label>
              <Input type="number" step="0.01" {...register('markupWholesale', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Цена оптовая ₽</label>
              <Input type="number" step="0.01" {...register('priceWholesale', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isPaintable" {...register('isPaintable')} className="rounded" />
            <label htmlFor="isPaintable" className="text-sm">Окрашиваемый (попадает в покрасочную накладную)</label>
          </div>
          {product && (
            <p className="text-xs text-muted-foreground bg-muted rounded p-2">
              Закупочная цена изменяется только через документ прихода.
              На складе: {Number(product.quantity).toFixed(2)} {product.unit} | Резерв: {Number(product.reservedQty).toFixed(2)}
            </p>
          )}          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>Сохранить</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
