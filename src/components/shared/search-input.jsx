import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

export function SearchInput({ value, onChange, placeholder = 'Search...', ...props }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        {...props}
      />
    </div>
  )
}
