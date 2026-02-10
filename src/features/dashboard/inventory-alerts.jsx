import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'

export function InventoryAlerts({ inventory = [] }) {
  const lowStock = inventory.filter((i) => i.is_low_stock)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Inventory Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {lowStock.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            All stock levels are healthy
          </p>
        ) : (
          <div className="space-y-3">
            {lowStock.map((item) => (
              <div
                key={`${item.ingredient_id}-${item.facility_id}`}
                className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20"
              >
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.ingredient_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.facility_name} — {item.quantity_on_hand} {item.unit_abbreviation}
                  </p>
                </div>
                <Badge variant="destructive">Low</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
