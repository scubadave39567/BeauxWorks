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
import { UnitSelect } from '@/components/shared/unit-select'
import { toast } from 'sonner'

const schema = z.object({
  from_facility_id: z.string().min(1, 'Source facility required'),
  to_facility_id: z.string().min(1, 'Destination facility required'),
  item_id: z.string().min(1, 'Item required'),
  qty: z.coerce.number().positive('Quantity must be positive'),
  uom_id: z.string().min(1, 'Unit required'),
})

export function TransferDialog({ open, onOpenChange, items = [] }) {
  const queryClient = useQueryClient()
  const { facilities, units } = useLookups()

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { from_facility_id: '', to_facility_id: '', item_id: '', qty: '', uom_id: '' },
  })

  const mutation = useMutation({
    mutationFn: async (data) => {
      const { data: result } = await api.post('/inventory/transfer', data)
      return result
    },
    onSuccess: () => {
      toast.success('Transfer recorded')
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
        <DialogHeader><DialogTitle>Transfer Inventory</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From Facility</Label>
              <LookupSelect items={facilities} valueField="facility_id" labelField="name" {...register('from_facility_id')} />
              {errors.from_facility_id && <p className="text-sm text-destructive">{errors.from_facility_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>To Facility</Label>
              <LookupSelect items={facilities} valueField="facility_id" labelField="name" {...register('to_facility_id')} />
              {errors.to_facility_id && <p className="text-sm text-destructive">{errors.to_facility_id.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Item</Label>
            <LookupSelect items={itemOptions} valueField="item_id" labelField="name" {...register('item_id')} />
            {errors.item_id && <p className="text-sm text-destructive">{errors.item_id.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" step="any" {...register('qty')} />
              {errors.qty && <p className="text-sm text-destructive">{errors.qty.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <UnitSelect units={units} {...register('uom_id')} />
              {errors.uom_id && <p className="text-sm text-destructive">{errors.uom_id.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Transferring...' : 'Transfer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
