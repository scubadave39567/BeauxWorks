import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getRuns } from '@/api/runs'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Clock, Play, CheckCircle2 } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const statusIcons = {
  Planned: Clock,
  InProgress: Play,
  Completed: CheckCircle2,
}

const statusColors = {
  Planned: 'border-blue-200 bg-blue-50',
  InProgress: 'border-amber-200 bg-amber-50',
  Completed: 'border-green-200 bg-green-50',
  Canceled: 'border-gray-200 bg-gray-50',
}

export default function MyRunsPage() {
  const navigate = useNavigate()

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['my-runs'],
    queryFn: () => getRuns({ status: 'InProgress' }),
  })

  const { data: planned = [] } = useQuery({
    queryKey: ['planned-runs'],
    queryFn: () => getRuns({ status: 'Planned' }),
  })

  if (isLoading) return <LoadingSpinner />

  const allRuns = [...runs, ...planned]

  return (
    <div>
      <PageHeader title="My Active Runs" description={`${runs.length} in progress, ${planned.length} planned`} />

      {allRuns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No active or planned runs</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {allRuns.map((run) => {
            const Icon = statusIcons[run.status] || Clock
            return (
              <Card
                key={run.production_run_id}
                className={cn('cursor-pointer hover:shadow-md transition-shadow min-h-[100px]', statusColors[run.status])}
                onClick={() => navigate(`/production/${run.production_run_id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-6 w-6 shrink-0" />
                      <div>
                        <p className="font-medium text-lg">{run.lot_code || 'Batch'}</p>
                        <p className="text-sm text-muted-foreground">Target: {run.target_yield_value}</p>
                      </div>
                    </div>
                    <StatusBadge status={run.status.toLowerCase()} label={run.status} />
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {run.started_at ? `Started: ${formatDateTime(run.started_at)}` : `Created: ${formatDateTime(run.created_at)}`}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
