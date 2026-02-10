import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { scanCode } from '@/api/production-runs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function ScanDialog({ open, onOpenChange }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleScan() {
    if (!code.trim()) return
    setLoading(true)
    try {
      const result = await scanCode(code.trim())
      onOpenChange(false)
      navigate(`/production/${result.production_run_id}`)
    } catch {
      toast.error('Code not found')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan Lot Code</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Lot Code</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter or scan lot code..."
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleScan} disabled={loading || !code.trim()}>
            {loading ? 'Searching...' : 'Look Up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
