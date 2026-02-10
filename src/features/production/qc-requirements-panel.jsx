import { useQuery } from '@tanstack/react-query'
import { getQcRequirements } from '@/api/run-qc'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react'

export function QcRequirementsPanel({ runId }) {
  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['qc-requirements', runId],
    queryFn: () => getQcRequirements(runId),
  })

  if (isLoading) return <LoadingSpinner />

  const fulfilledCount = requirements.filter((r) => r.fulfilled).length
  const requiredCount = requirements.filter((r) => r.required).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          QC Requirements ({fulfilledCount}/{requiredCount} complete)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requirements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No QC requirements for this run</p>
        ) : (
          <div className="space-y-2">
            {requirements.map((req, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-md border">
                <div className="flex items-center gap-3">
                  {req.fulfilled ? (
                    req.in_range ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    )
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{req.metric_type_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stage: {req.stage}
                      {req.min_value != null && ` | Min: ${req.min_value}`}
                      {req.max_value != null && ` | Max: ${req.max_value}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {req.required && <Badge variant="outline">Required</Badge>}
                  {req.fail_requires_deviation && <Badge variant="destructive">Deviation if fail</Badge>}
                  {req.fulfilled ? (
                    <Badge variant="success">Recorded ({req.entry_count})</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
