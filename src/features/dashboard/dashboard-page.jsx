import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { KpiSection } from './kpi-section'
import { ProductionChart } from './production-chart'
import { SalesChart } from './sales-chart'
import { InventoryAlerts } from './inventory-alerts'
import { getProductionRuns } from '@/api/production-runs'
import { getInventoryStatus } from '@/api/inventory'
import { getSalesSummary } from '@/api/sales'

export default function DashboardPage() {
  const { data: productionRuns, isLoading: loadingRuns } = useQuery({
    queryKey: ['production-runs'],
    queryFn: () => getProductionRuns(0, 200),
  })

  const { data: inventory, isLoading: loadingInventory } = useQuery({
    queryKey: ['inventory-status'],
    queryFn: getInventoryStatus,
  })

  const { data: salesSummary, isLoading: loadingSales } = useQuery({
    queryKey: ['sales-summary'],
    queryFn: () => getSalesSummary(),
  })

  const loading = loadingRuns || loadingInventory || loadingSales

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome to Beaux's Bistro Production Manager"
      />

      <KpiSection
        productionRuns={productionRuns}
        inventory={inventory}
        sales={salesSummary}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <ProductionChart productionRuns={productionRuns} />
        <SalesChart salesSummary={salesSummary} />
      </div>

      <div className="mt-6">
        <InventoryAlerts inventory={inventory} />
      </div>
    </div>
  )
}
