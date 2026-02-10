import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'

const DatePicker = forwardRef(({ ...props }, ref) => (
  <Input type="datetime-local" ref={ref} {...props} />
))
DatePicker.displayName = 'DatePicker'

export { DatePicker }
