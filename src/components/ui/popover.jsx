import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const PopoverContext = createContext(null)

function Popover({ open, onOpenChange, children }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen
  const triggerRef = useRef(null)
  return (
    <PopoverContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      <div className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

function PopoverTrigger({ children, asChild, ...props }) {
  const { isOpen, setIsOpen, triggerRef } = useContext(PopoverContext)
  const handleClick = () => setIsOpen(!isOpen)
  if (asChild) {
    return (
      <span ref={triggerRef} onClick={handleClick} {...props}>
        {children}
      </span>
    )
  }
  return (
    <button ref={triggerRef} onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

function PopoverContent({ className, align = 'end', children, ...props }) {
  const { isOpen, setIsOpen } = useContext(PopoverContext)
  const contentRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e) {
      if (contentRef.current && !contentRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    // Delay to avoid capturing the trigger click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, setIsOpen])

  if (!isOpen) return null
  return (
    <div
      ref={contentRef}
      className={cn(
        'absolute top-full mt-2 z-50 min-w-[280px] rounded-lg border bg-card p-4 shadow-lg',
        align === 'end' && 'right-0',
        align === 'start' && 'left-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
