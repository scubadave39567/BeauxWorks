import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/api'
import { useLookups } from '@/hooks/use-lookups'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LookupSelect } from '@/components/shared/lookup-select'
import { toast } from 'sonner'

const schema = z.object({
  facility_id: z.string().min(1, 'Facility required'),
  item_id: z.string().min(1, 'Item required'),
  qty: z.coerce.number().refine((v) => v !== 0, 'Quantity cannot be zero'),
  reason_code: z.string().min(1, 'Reason required'),
})

export function AdjustDialog({ open, onOpenChange, items = [] }) {
  const queryClient = useQueryClient()
  const { facilities } = useLookups()

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { facility_id: '', item_id: '', qty: '', reason_code: '' },
  })

  const mutation = useMutation({
    mutationFn: async (data) => {
      const { data: result } = await api.post('/inventory/adjust', data)
      return result
    },
    onSuccess: () => {
      toast.success('Adjustment recorded')
      queryClient.invalidateQueries({ queryKey: ['inventory-onhand'] })
      reset()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message || 'Failed'),
  })

  const itemOptions = items.reduce((acc, i) => {
    if (!acc.find((x) => x.item_id === i.item_id)) acc.push({ item_id: i.item_id, name: i.item_name || i.ingredient_name })
    return acc
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust Inventory</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Label>Facility</Label>
            <LookupSelect items={facilities} valueField="facility_id" labelField="name" {...register('facility_id')} />
            {errors.facility_id && <p className="text-sm text-destructive">{errors.facility_id.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Item</Label>
            <LookupSelect items={itemOptions} valueField="item_id" labelField="name" {...register('item_id')} />
            {errors.item_id && <p className="text-sm text-destructive">{errors.item_id.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Quantity (+/-)</Label>
            <Input type="number" step="any" {...register('qty')} placeholder="Positive to add, negative to remove" />
            {errors.qty && <p className="text-sm text-destructive">{errors.qty.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Reason Code</Label>
            <Input {...register('reason_code')} placeholder="e.g. Cycle count, Damaged" />
            {errors.reason_code && <p className="text-sm text-destructive">{errors.reason_code.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Adjust'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
