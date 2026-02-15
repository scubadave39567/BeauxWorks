import { useState, useRef, useEffect, useCallback, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, X } from 'lucide-react'

function fuzzyMatch(text, query) {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  if (lower === q) return 0
  if (lower.startsWith(q)) return 1
  const idx = lower.indexOf(q)
  if (idx >= 0) return 2 + idx
  const words = lower.split(/[\s\-–—/()]+/)
  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith(q)) return 3 + i
  }
  let qi = 0
  let score = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      score += i
      qi++
    }
  }
  if (qi === q.length) return 100 + score
  return -1
}

const LookupSelect = forwardRef(function LookupSelect({
  items = [],
  valueField,
  labelField,
  placeholder = 'Select...',
  value,
  onChange,
  onBlur,
  name,
  className,
  disabled,
}, ref) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const selectedItem = items.find((item) => String(item[valueField]) === String(value))

  const filtered = search.trim()
    ? items
        .map((item) => ({ item, score: fuzzyMatch(item[labelField], search.trim()) }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => a.score - b.score)
        .map((r) => r.item)
    : items

  useEffect(() => {
    setHighlightIdx(0)
  }, [search, open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlightIdx]
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, open])

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const select = useCallback(
    (item) => {
      onChange?.({ target: { value: item[valueField] } })
      setSearch('')
      setOpen(false)
    },
    [onChange, valueField],
  )

  const clear = useCallback(
    (e) => {
      e.stopPropagation()
      onChange?.({ target: { value: '' } })
      setSearch('')
    },
    [onChange],
  )

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightIdx]) select(filtered[highlightIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input type="hidden" ref={ref} name={name} value={value ?? ''} />
      <button
        type="button"
        disabled={disabled}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
      >
        <span className={cn(!selectedItem && 'text-muted-foreground')}>
          {selectedItem ? selectedItem[labelField] : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedItem && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              className="rounded-sm p-0.5 hover:bg-muted"
              onMouseDown={clear}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-card shadow-lg">
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="Type to search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto py-1"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No matches found</li>
            ) : (
              filtered.map((item, idx) => (
                <li
                  key={item[valueField]}
                  role="option"
                  aria-selected={String(item[valueField]) === String(value)}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-sm',
                    idx === highlightIdx && 'bg-accent',
                    String(item[valueField]) === String(value) && 'font-semibold text-accent-foreground',
                  )}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    select(item)
                  }}
                >
                  {item[labelField]}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
})

LookupSelect.displayName = 'LookupSelect'

export { LookupSelect }
