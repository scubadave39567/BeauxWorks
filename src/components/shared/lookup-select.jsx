import { forwardRef } from 'react'
import { Select } from '@/components/ui/select'

const LookupSelect = forwardRef(({ items = [], valueField, labelField, placeholder = 'Select...', ...props }, ref) => (
  <Select ref={ref} {...props}>
    <option value="">{placeholder}</option>
    {items.map((item) => (
      <option key={item[valueField]} value={item[valueField]}>
        {item[labelField]}
      </option>
    ))}
  </Select>
))
LookupSelect.displayName = 'LookupSelect'

export { LookupSelect }
