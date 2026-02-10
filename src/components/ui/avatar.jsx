import { useState } from 'react'
import { cn } from '@/lib/utils'

function Avatar({ className, children, ...props }) {
  return (
    <div
      className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    >
      {children}
    </div>
  )
}

function AvatarImage({ className, src, alt, ...props }) {
  const [error, setError] = useState(false)
  if (!src || error) return null
  return (
    <img
      src={src}
      alt={alt}
      className={cn('aspect-square h-full w-full object-cover', className)}
      onError={() => setError(true)}
      {...props}
    />
  )
}

function AvatarFallback({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium',
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
