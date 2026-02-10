import { useQuery } from '@tanstack/react-query'
import { getSalesSummary } from '@/api/sales'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

export function SalesSummaryChart() {
  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['sales-summary'],
    queryFn: () => getSalesSummary(),
  })

  if (isLoading) return <LoadingSpinner size="sm" />

  // Group by product
  const productMap = {}
  summary.forEach((s) => {
    if (!productMap[s.product_name]) {
      productMap[s.product_name] = { name: s.product_name, revenue: 0, quantity: 0 }
    }
    productMap[s.product_name].revenue += s.total_revenue || 0
    productMap[s.product_name].quantity += s.total_quantity || 0
  })

  const data = Object.values(productMap)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Revenue by Product</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No sales data</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.375rem',
                }}
                formatter={(value) => `$${Number(value).toFixed(2)}`}
              />
              <Legend />
              <Bar dataKey="revenue" name="Revenue ($)" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
