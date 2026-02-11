import { Badge } from '@/components/ui/badge'

const statusColors = {
  planned: 'outline',
  in_progress: 'warning',
  inprogress: 'warning',
  completed: 'success',
  cancelled: 'destructive',
  canceled: 'destructive',
  on_hold: 'secondary',
  draft: 'secondary',
  released: 'success',
  retired: 'outline',
  open: 'warning',
  closed: 'success',
}

export function StatusBadge({ status, label }) {
  const variant = statusColors[status?.toLowerCase()] || 'outline'
  return <Badge variant={variant}>{label || status}</Badge>
}
