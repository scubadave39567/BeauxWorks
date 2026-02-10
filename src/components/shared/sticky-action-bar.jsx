import { cn } from '@/lib/utils'

export function StickyActionBar({ className, children }) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 md:static md:mt-4 bg-card border-t md:border md:rounded-lg p-4 flex items-center gap-2 z-30 safe-area-pb',
        className
      )}
    >
      {children}
    </div>
  )
}
