import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function SalesChart({ salesSummary = [] }) {
  // Group by day
  const dayMap = {}
  salesSummary.forEach((s) => {
    const day = s.sale_day
    if (!dayMap[day]) dayMap[day] = { day, revenue: 0 }
    dayMap[day].revenue += s.total_revenue || 0
  })

  const data = Object.values(dayMap)
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-14) // last 14 days

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sales Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.375rem',
                }}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-chart-2)"
                fill="var(--color-chart-2)"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
