import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ className, size = 'default' }) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2
        className={cn(
          'animate-spin text-primary',
          size === 'sm' ? 'h-5 w-5' : 'h-8 w-8',
          className
        )}
      />
    </div>
  )
}
