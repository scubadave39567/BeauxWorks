import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({ title, value, description, icon: Icon, trend, className }) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="mt-2">
          <p className="text-2xl font-bold font-mono">{value}</p>
          {description && (
            <p className={cn('text-xs mt-1', trend === 'up' ? 'text-secondary' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground')}>
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
