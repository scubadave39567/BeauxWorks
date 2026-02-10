import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useLookups } from '@/hooks/use-lookups'

export function ProductionChart({ productionRuns = [] }) {
  const { runStatusesMap } = useLookups()

  // Group runs by status
  const statusCounts = {}
  productionRuns.forEach((run) => {
    const status = runStatusesMap.get(run.run_status_id)
    const name = status?.name || 'Unknown'
    statusCounts[name] = (statusCounts[name] || 0) + 1
  })

  const data = Object.entries(statusCounts).map(([name, count]) => ({ name, count }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Production by Status</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No production data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.375rem',
                }}
              />
              <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
