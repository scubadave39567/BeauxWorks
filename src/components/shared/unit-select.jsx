import { forwardRef } from 'react'
import { LookupSelect } from './lookup-select'

const UnitSelect = forwardRef(({ units = [], unitType, placeholder = 'Select unit...', ...props }, ref) => {
  const filtered = unitType ? units.filter((u) => u.unit_type === unitType) : units
  const items = filtered.map((u) => ({ ...u, _label: `${u.name} (${u.abbreviation})` }))
  return (
    <LookupSelect
      ref={ref}
      items={items}
      valueField="unit_id"
      labelField="_label"
      placeholder={placeholder}
      {...props}
    />
  )
})
UnitSelect.displayName = 'UnitSelect'

export { UnitSelect }
