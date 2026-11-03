import { useState } from 'react'
import { Package, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import ProductsTab from '@/modules/warehouse/ProductsTab'
import ReceiptsTab from '@/modules/warehouse/ReceiptsTab'
import WriteoffsTab from '@/modules/warehouse/WriteoffsTab'

type Tab = 'products' | 'receipts' | 'writeoffs'

const tabs = [
  { id: 'products' as Tab, label: 'Товары', icon: Package },
  { id: 'receipts' as Tab, label: 'Приход', icon: ArrowDownToLine },
  { id: 'writeoffs' as Tab, label: 'Списания', icon: ArrowUpFromLine },
]

export default function WarehousePage() {
  const [tab, setTab] = useState<Tab>('products')

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Склад</h1>
      <div className="flex border rounded-md overflow-hidden w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${tab === id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>
      {tab === 'products' && <ProductsTab />}
      {tab === 'receipts' && <ReceiptsTab />}
      {tab === 'writeoffs' && <WriteoffsTab />}
    </div>
  )
}
