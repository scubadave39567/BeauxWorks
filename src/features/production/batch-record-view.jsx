import { useQuery } from '@tanstack/react-query'
import { getBatchRecord } from '@/api/production-runs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { formatDateTime, formatNumber } from '@/lib/format'

export function BatchRecordView({ runId }) {
  const { data: record, isLoading } = useQuery({
    queryKey: ['batch-record', runId],
    queryFn: () => getBatchRecord(runId),
    enabled: !!runId,
  })

  if (isLoading) return <LoadingSpinner />
  if (!record) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Batch Record</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Lot Code</p>
              <p className="font-mono font-medium">{record.lot_code || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Recipe</p>
              <p className="font-medium">{record.recipe_name} v{record.version_number}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{record.run_status}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Facility</p>
              <p>{record.facility_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Operator</p>
              <p>{record.operator_name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Target / Actual Yield</p>
              <p className="font-mono">
                {formatNumber(record.target_yield_value)} / {formatNumber(record.actual_yield_value)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {record.quality_logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quality Logs ({record.quality_logs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.quality_logs.map((log) => (
                    <TableRow key={log.production_run_quality_log_id}>
                      <TableCell>{formatDateTime(log.measured_at)}</TableCell>
                      <TableCell className="font-mono">
                        {log.value_numeric != null ? formatNumber(log.value_numeric) : log.value_text || (log.value_bool != null ? String(log.value_bool) : '—')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {record.deviations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deviations ({record.deviations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {record.deviations.map((dev) => (
                <div
                  key={dev.production_run_deviation_id}
                  className="p-3 rounded-md border border-destructive/20 bg-destructive/5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="destructive">{dev.deviation_type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(dev.detected_at)}
                    </span>
                  </div>
                  <p className="text-sm">{dev.details}</p>
                  {dev.corrective_action && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Corrective action: {dev.corrective_action}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
