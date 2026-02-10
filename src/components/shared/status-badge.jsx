import { Badge } from '@/components/ui/badge'

const statusColors = {
  planned: 'outline',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'destructive',
  on_hold: 'secondary',
}

export function StatusBadge({ status, label }) {
  const variant = statusColors[status?.toLowerCase()] || 'outline'
  return <Badge variant={variant}>{label || status}</Badge>
}
