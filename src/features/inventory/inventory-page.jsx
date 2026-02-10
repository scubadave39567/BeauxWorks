import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getInventoryStatus } from '@/api/inventory'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/data-table'
import { SearchInput } from '@/components/shared/search-input'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ReceiveForm } from './receive-form'
import { AdjustDialog } from './adjust-dialog'
import { TransferDialog } from './transfer-dialog'
import { usePermissions } from '@/hooks/use-permissions'
import { Plus, ArrowRightLeft, AlertTriangle, Package, Scale, Repeat } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const columns = [
  {
    accessorKey: 'ingredient_name',
    header: 'Ingredient',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.ingredient_name}</span>
    ),
  },
  {
    accessorKey: 'facility_name',
    header: 'Facility',
  },
  {
    accessorKey: 'quantity_on_hand',
    header: 'On Hand',
    cell: ({ row }) => (
      <span className={cn('font-mono', row.original.is_low_stock && 'text-destructive font-bold')}>
        {formatNumber(row.original.quantity_on_hand)} {row.original.unit_abbreviation}
      </span>
    ),
  },
  {
    accessorKey: 'low_stock_threshold',
    header: 'Threshold',
    cell: ({ row }) => (
      <span className="font-mono text-muted-foreground">
        {row.original.low_stock_threshold != null
          ? `${formatNumber(row.original.low_stock_threshold)} ${row.original.unit_abbreviation}`
          : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'is_low_stock',
    header: 'Status',
    cell: ({ row }) =>
      row.original.is_low_stock ? (
        <Badge variant="destructive">Low Stock</Badge>
      ) : (
        <Badge variant="success">OK</Badge>
      ),
  },
]

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const navigate = useNavigate()
  const { can } = usePermissions()

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory-status'],
    queryFn: getInventoryStatus,
  })

  if (isLoading) return <LoadingSpinner />

  const lowCount = inventory.filter((i) => i.is_low_stock).length

  return (
    <div>
      <PageHeader title="Inventory" description={`${inventory.length} items tracked${lowCount > 0 ? ` — ${lowCount} low stock` : ''}`}>
        <Button onClick={() => setReceiveOpen(true)}>
          <Plus className="h-4 w-4" />
          Receive
        </Button>
        {can('adjust_inventory') && (
          <Button variant="outline" onClick={() => setAdjustOpen(true)}>
            <Scale className="h-4 w-4" />
            Adjust
          </Button>
        )}
        <Button variant="outline" onClick={() => setTransferOpen(true)}>
          <Repeat className="h-4 w-4" />
          Transfer
        </Button>
        <Button variant="outline" onClick={() => navigate('/inventory/transactions')}>
          <ArrowRightLeft className="h-4 w-4" />
          History
        </Button>
        <Button variant="outline" onClick={() => navigate('/inventory/recall')}>
          <AlertTriangle className="h-4 w-4" />
          Recall
        </Button>
      </PageHeader>

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search ingredients..."
        />
      </div>

      <DataTable
        columns={columns}
        data={inventory}
        searchKey="ingredient_name"
        searchValue={search}
        renderCard={(item) => (
          <Card className={cn(item.is_low_stock && 'border-destructive/50')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    item.is_low_stock ? 'bg-destructive/10' : 'bg-secondary/10'
                  )}>
                    <Package className={cn('h-5 w-5', item.is_low_stock ? 'text-destructive' : 'text-secondary')} />
                  </div>
                  <div>
                    <p className="font-medium">{item.ingredient_name}</p>
                    <p className="text-xs text-muted-foreground">{item.facility_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('font-mono font-medium', item.is_low_stock && 'text-destructive')}>
                    {formatNumber(item.quantity_on_hand)} {item.unit_abbreviation}
                  </p>
                  {item.is_low_stock && <Badge variant="destructive" className="mt-1">Low</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      />

      <ReceiveForm
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        ingredients={inventory}
      />

      <AdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        items={inventory}
      />

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        items={inventory}
      />
    </div>
  )
}
