import { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

const TabsContext = createContext(null)

function Tabs({ defaultValue, value, onValueChange, className, children, ...props }) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const currentValue = value ?? internalValue
  const setValue = onValueChange ?? setInternalValue
  return (
    <TabsContext.Provider value={{ value: currentValue, setValue }}>
      <div className={cn('', className)} {...props}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }) {
  return (
    <div
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ value: tabValue, className, ...props }) {
  const { value, setValue } = useContext(TabsContext)
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all min-h-[44px]',
        value === tabValue
          ? 'bg-background text-foreground shadow-sm'
          : 'hover:bg-background/50',
        className
      )}
      onClick={() => setValue(tabValue)}
      {...props}
    />
  )
}

function TabsContent({ value: tabValue, className, ...props }) {
  const { value } = useContext(TabsContext)
  if (value !== tabValue) return null
  return <div className={cn('mt-2', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
