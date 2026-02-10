import { useQuery } from '@tanstack/react-query'
import { getTransactions } from '@/api/inventory'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable } from '@/components/shared/data-table'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime, formatNumber } from '@/lib/format'

const typeColors = {
  receive: 'success',
  use: 'default',
  adjust: 'warning',
  waste: 'destructive',
}

export default function TransactionLogPage() {
  const { unitsMap } = useLookups()

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => getTransactions({ limit: 200 }),
  })

  const columns = [
    {
      accessorKey: 'transacted_at',
      header: 'Date',
      cell: ({ row }) => formatDateTime(row.original.transacted_at),
    },
    {
      accessorKey: 'transaction_type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant={typeColors[row.original.transaction_type] || 'outline'}>
          {row.original.transaction_type}
        </Badge>
      ),
    },
    {
      accessorKey: 'quantity',
      header: 'Quantity',
      cell: ({ row }) => (
        <span className="font-mono">
          {formatNumber(row.original.quantity)}{' '}
          {unitsMap.get(row.original.unit_id)?.abbreviation || ''}
        </span>
      ),
    },
    {
      accessorKey: 'reference_notes',
      header: 'Reference',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.reference_notes || '—'}</span>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Transaction History"
        description="Inventory movement log"
      />
      <DataTable
        columns={columns}
        data={transactions}
        renderCard={(tx) => (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant={typeColors[tx.transaction_type] || 'outline'}>
                    {tx.transaction_type}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(tx.transacted_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-medium">
                    {formatNumber(tx.quantity)} {unitsMap.get(tx.unit_id)?.abbreviation || ''}
                  </p>
                  {tx.reference_notes && (
                    <p className="text-xs text-muted-foreground">{tx.reference_notes}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      />
    </div>
  )
}
