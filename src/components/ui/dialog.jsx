import { createContext, useContext, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

const DialogContext = createContext(null)

function Dialog({ open, onOpenChange, children }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen
  return (
    <DialogContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({ children, asChild, ...props }) {
  const { setIsOpen } = useContext(DialogContext)
  if (asChild) {
    return <span onClick={() => setIsOpen(true)} {...props}>{children}</span>
  }
  return <button onClick={() => setIsOpen(true)} {...props}>{children}</button>
}

function DialogContent({ className, children, ...props }) {
  const { isOpen, setIsOpen } = useContext(DialogContext)
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
      <div
        className={cn(
          'relative z-50 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg',
          className
        )}
        {...props}
      >
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  )
}

function DialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
}

function DialogTitle({ className, ...props }) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight font-heading', className)} {...props} />
}

function DialogDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

function DialogFooter({ className, ...props }) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4', className)} {...props} />
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
