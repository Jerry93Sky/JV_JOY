import { useRef, useState } from 'react'
import { Upload, X, FileText, Image, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '@/api/client'

interface UploadedFile {
  name: string
  url: string
}

interface Props {
  endpoint: string          // например /deals/xxx/upload?type=INVOICE
  accept?: string           // например "image/*,.pdf"
  label?: string
  existingUrl?: string      // уже загруженный файл
  existingName?: string
  onUploaded?: (file: UploadedFile) => void
  multiple?: boolean
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <Image size={14} />
  return <FileText size={14} />
}

export default function FileUpload({ endpoint, accept, label, existingUrl, existingName, onUploaded, multiple }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [uploaded, setUploaded] = useState<UploadedFile | null>(
    existingUrl ? { url: existingUrl, name: existingName || 'Файл' } : null
  )

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const uploadedFile = { name: file.name, url: res.data.file?.url || res.data.url }
        setUploaded(uploadedFile)
        onUploaded?.(uploadedFile)
      }
    } catch (e: unknown) {
      setError('Ошибка загрузки файла')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-xs text-muted-foreground">{label}</label>}

      {uploaded ? (
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30 text-sm">
          <CheckCircle2 size={14} className="text-green-500 shrink-0" />
          {getFileIcon(uploaded.name)}
          <a href={`http://localhost:3001${uploaded.url}`} target="_blank" rel="noreferrer"
            className="flex-1 text-primary hover:underline truncate">
            {uploaded.name}
          </a>
          <button type="button" onClick={() => setUploaded(null)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-md px-4 py-3 text-center cursor-pointer hover:border-primary transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}>
          <Upload size={16} className="mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {uploading ? 'Загрузка...' : 'Нажмите или перетащите файл'}
          </p>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
