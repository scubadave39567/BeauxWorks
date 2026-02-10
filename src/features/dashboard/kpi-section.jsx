import { StatCard } from '@/components/shared/stat-card'
import { Factory, Package, ShoppingCart, AlertTriangle } from 'lucide-react'

export function KpiSection({ productionRuns, inventory, sales }) {
  const activeRuns = productionRuns?.filter(
    (r) => r.run_status_id
  ).length ?? 0

  const lowStockCount = inventory?.filter((i) => i.is_low_stock).length ?? 0

  const totalRevenue = sales?.reduce((sum, s) => sum + (s.total_revenue || 0), 0) ?? 0

  const totalTransactions = sales?.reduce((sum, s) => sum + (s.transaction_count || 0), 0) ?? 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Production Runs"
        value={activeRuns}
        description="Total runs"
        icon={Factory}
      />
      <StatCard
        title="Low Stock Items"
        value={lowStockCount}
        description={lowStockCount > 0 ? 'Needs attention' : 'All stocked'}
        icon={AlertTriangle}
        trend={lowStockCount > 0 ? 'down' : 'up'}
      />
      <StatCard
        title="Total Revenue"
        value={`$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        description="From sales summary"
        icon={ShoppingCart}
      />
      <StatCard
        title="Transactions"
        value={totalTransactions}
        description="Sales orders"
        icon={Package}
      />
    </div>
  )
}
