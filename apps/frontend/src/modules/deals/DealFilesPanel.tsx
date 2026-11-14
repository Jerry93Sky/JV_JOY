import { FileText, Image, Download } from 'lucide-react'
import { type Deal, DealStage } from '@/api/deals'
import FileUpload from '@/components/FileUpload'
import { useQueryClient } from '@tanstack/react-query'

const FILE_TYPE_LABELS: Record<string, string> = {
  ATTACHMENT: 'Вложение',
  INVOICE: 'Счёт',
  SHIPMENT_PHOTO: 'Фото комплектации',
  SHIPMENT_DOC: 'Накладная',
  GLASS_DRAWING: 'Чертёж стекла',
}

interface Props { deal: Deal }

export default function DealFilesPanel({ deal }: Props) {
  const qc = useQueryClient()
  const files = deal.files || []

  const onUploaded = () => qc.invalidateQueries({ queryKey: ['deals', deal.id] })

  // Определяем какие типы файлов актуальны для текущего этапа
  const showGlassDrawing = deal.glassSupply === 'OURS' &&
    ['INVOICE_SENT', 'PAID', 'ASSEMBLY', 'PAINTING', 'INSTALL_FIRST', 'INSTALL_SECOND', 'SHIPMENT', 'DOCS'].includes(deal.stage)

  const showShipmentFiles = [DealStage.SHIPMENT, DealStage.DOCS].includes(deal.stage)

  const canAttach = !['COMPLETED', 'FAILED'].includes(deal.stage)

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="font-medium text-sm">Файлы</h3>

      {/* Существующие файлы */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
              <FileText size={13} className="text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{FILE_TYPE_LABELS[f.type] || f.type}</span>
              <a href={`http://localhost:3001${f.url}`} target="_blank" rel="noreferrer"
                className="flex-1 text-primary hover:underline truncate">{f.name}</a>
              <a href={`http://localhost:3001${f.url}`} download className="text-muted-foreground hover:text-foreground">
                <Download size={13} />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Загрузка вложений (доступна всегда до завершения) */}
      {canAttach && (
        <FileUpload
          endpoint={`/deals/${deal.id}/upload?type=ATTACHMENT`}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          label="Прикрепить файл (чертёж, фото объекта)"
          onUploaded={onUploaded}
        />
      )}

      {/* Чертежи стекла — с этапа КП */}
      {showGlassDrawing && (
        <FileUpload
          endpoint={`/deals/${deal.id}/upload?type=GLASS_DRAWING`}
          accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
          label="Чертежи стёкол"
          existingUrl={deal.glassDrawingUrl || undefined}
          existingName="Чертежи стёкол"
          onUploaded={onUploaded}
        />
      )}

      {/* Фото и накладные при отгрузке */}
      {showShipmentFiles && (
        <>
          <FileUpload
            endpoint={`/deals/${deal.id}/upload?type=SHIPMENT_PHOTO`}
            accept="image/*"
            label="Фото собранной комплектации"
            onUploaded={onUploaded}
          />
          <FileUpload
            endpoint={`/deals/${deal.id}/upload?type=SHIPMENT_DOC`}
            accept=".pdf,.jpg,.jpeg,.png"
            label="Накладная / закрывающий документ"
            onUploaded={onUploaded}
          />
        </>
      )}
    </div>
  )
}
