import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getSales } from '@/api/sales'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/data-table'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { SalesSummaryChart } from './sales-summary-chart'
import { Plus, BarChart3 } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/format'

export default function SalesPage() {
  const navigate = useNavigate()
  const { salesChannelsMap, unitsMap } = useLookups()

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => getSales({ limit: 200 }),
  })

  const columns = [
    {
      accessorKey: 'sale_date',
      header: 'Date',
      cell: ({ row }) => formatDateTime(row.original.sale_date),
    },
    {
      accessorKey: 'customer_name',
      header: 'Customer',
      cell: ({ row }) => row.original.customer_name || '—',
    },
    {
      accessorKey: 'sales_channel_id',
      header: 'Channel',
      cell: ({ row }) => salesChannelsMap.get(row.original.sales_channel_id)?.name || '—',
    },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ row }) => (
        <span className="font-mono">
          {row.original.quantity} {unitsMap.get(row.original.unit_id)?.abbreviation || ''}
        </span>
      ),
    },
    {
      accessorKey: 'total_price',
      header: 'Total',
      cell: ({ row }) => (
        <span className="font-mono font-medium">{formatCurrency(row.original.total_price)}</span>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader title="Sales" description="Track sales and revenue">
        <Button onClick={() => navigate('/sales/new')}>
          <Plus className="h-4 w-4" />
          Record Sale
        </Button>
      </PageHeader>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Transactions</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <DataTable
            columns={columns}
            data={sales}
            renderCard={(sale) => (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{sale.customer_name || 'Walk-in'}</p>
                      <p className="text-xs text-muted-foreground">
                        {salesChannelsMap.get(sale.sales_channel_id)?.name} |{' '}
                        {formatDateTime(sale.sale_date)}
                      </p>
                    </div>
                    <p className="font-mono font-medium">{formatCurrency(sale.total_price)}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          />
        </TabsContent>

        <TabsContent value="summary">
          <SalesSummaryChart />
        </TabsContent>
      </Tabs>
    </div>
  )
}
