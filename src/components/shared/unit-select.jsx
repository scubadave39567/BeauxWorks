import { forwardRef } from 'react'
import { Select } from '@/components/ui/select'

const UnitSelect = forwardRef(({ units = [], unitType, placeholder = 'Select unit...', ...props }, ref) => {
  const filtered = unitType ? units.filter((u) => u.unit_type === unitType) : units
  return (
    <Select ref={ref} {...props}>
      <option value="">{placeholder}</option>
      {filtered.map((u) => (
        <option key={u.unit_id} value={u.unit_id}>
          {u.name} ({u.abbreviation})
        </option>
      ))}
    </Select>
  )
})
UnitSelect.displayName = 'UnitSelect'

export { UnitSelect }
