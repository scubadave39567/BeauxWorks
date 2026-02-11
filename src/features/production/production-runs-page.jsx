import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getRuns } from '@/api/runs'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/data-table'
import { SearchInput } from '@/components/shared/search-input'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Plus, Factory } from 'lucide-react'
import { formatDateTime, formatNumber } from '@/lib/format'

const STATUS_LABELS = { Planned: 'Planned', InProgress: 'In Progress', Completed: 'Completed', Canceled: 'Canceled' }
const STATUS_VARIANTS = { Planned: 'outline', InProgress: 'warning', Completed: 'success', Canceled: 'destructive' }

export default function ProductionRunsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const navigate = useNavigate()
  const { unitsMap, facilitiesMap } = useLookups()

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['runs'],
    queryFn: () => getRuns({ limit: 200 }),
  })

  const filteredRuns =
    statusFilter === 'all'
      ? runs
      : runs.filter((r) => r.status === statusFilter)

  const columns = [
    {
      accessorKey: 'lot_code',
      header: 'Lot Code',
      cell: ({ row }) => (
        <span className="font-mono font-medium">{row.original.lot_code || '—'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANTS[row.original.status] || 'outline'}>
          {STATUS_LABELS[row.original.status] || row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'facility_id',
      header: 'Facility',
      cell: ({ row }) => facilitiesMap.get(row.original.facility_id)?.name || '—',
    },
    {
      accessorKey: 'target_yield_value',
      header: 'Target Yield',
      cell: ({ row }) => (
        <span className="font-mono">
          {formatNumber(row.original.target_yield_value)}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
  ]

  if (isLoading) return <LoadingSpinner />

  const statusCounts = runs.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {})

  return (
    <div>
      <PageHeader title="Production Runs" description={`${runs.length} runs — state machine workflow: Planned → In Progress → Completed`}>
        <Button onClick={() => navigate('/production/new')}>
          <Plus className="h-4 w-4" />
          New Run
        </Button>
      </PageHeader>

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by lot code..."
        />
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="all">All ({runs.length})</TabsTrigger>
          {['Planned', 'InProgress', 'Completed', 'Canceled'].map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUS_LABELS[s]} ({statusCounts[s] || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={statusFilter}>
          <DataTable
            columns={columns}
            data={filteredRuns}
            searchKey="lot_code"
            searchValue={search}
            onRowClick={(row) => navigate(`/production/${row.production_run_id}`)}
            renderCard={(run) => {
              const facility = facilitiesMap.get(run.facility_id)
              return (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Factory className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-mono font-medium">{run.lot_code || 'No lot code'}</p>
                          <p className="text-xs text-muted-foreground">
                            {facility?.name} | {formatNumber(run.target_yield_value)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANTS[run.status] || 'outline'}>
                        {STATUS_LABELS[run.status] || run.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
