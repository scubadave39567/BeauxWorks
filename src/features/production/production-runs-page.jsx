import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getProductionRuns } from '@/api/production-runs'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/data-table'
import { SearchInput } from '@/components/shared/search-input'
import { StatusBadge } from '@/components/shared/status-badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Plus, Factory } from 'lucide-react'
import { formatDateTime, formatNumber } from '@/lib/format'

export default function ProductionRunsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const navigate = useNavigate()
  const { runStatuses, runStatusesMap, unitsMap, facilitiesMap } = useLookups()

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['production-runs'],
    queryFn: () => getProductionRuns(0, 200),
  })

  const filteredRuns =
    statusFilter === 'all'
      ? runs
      : runs.filter((r) => {
          const status = runStatusesMap.get(r.run_status_id)
          return status?.code === statusFilter
        })

  const columns = [
    {
      accessorKey: 'lot_code',
      header: 'Lot Code',
      cell: ({ row }) => (
        <span className="font-mono font-medium">{row.original.lot_code || '—'}</span>
      ),
    },
    {
      accessorKey: 'run_status_id',
      header: 'Status',
      cell: ({ row }) => {
        const status = runStatusesMap.get(row.original.run_status_id)
        return <StatusBadge status={status?.code} label={status?.name} />
      },
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
          {formatNumber(row.original.target_yield_value)}{' '}
          {unitsMap.get(row.original.target_yield_unit_id)?.abbreviation}
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

  return (
    <div>
      <PageHeader title="Production Runs" description="Track and manage production batches">
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
          {runStatuses
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((s) => {
              const count = runs.filter((r) => r.run_status_id === s.run_status_id).length
              return (
                <TabsTrigger key={s.code} value={s.code}>
                  {s.name} ({count})
                </TabsTrigger>
              )
            })}
        </TabsList>

        <TabsContent value={statusFilter}>
          <DataTable
            columns={columns}
            data={filteredRuns}
            searchKey="lot_code"
            searchValue={search}
            onRowClick={(row) => navigate(`/production/${row.production_run_id}`)}
            renderCard={(run) => {
              const status = runStatusesMap.get(run.run_status_id)
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
                            {facility?.name} | {formatNumber(run.target_yield_value)}{' '}
                            {unitsMap.get(run.target_yield_unit_id)?.abbreviation}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={status?.code} label={status?.name} />
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
