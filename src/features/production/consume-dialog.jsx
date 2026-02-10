import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { consumeMaterial } from '@/api/run-materials'
import { useLookups } from '@/hooks/use-lookups'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { UnitSelect } from '@/components/shared/unit-select'
import { toast } from 'sonner'

const schema = z.object({
  qty: z.coerce.number().positive('Quantity must be positive'),
  uom_id: z.string().min(1, 'Unit is required'),
  lot_id: z.string().optional(),
  notes: z.string().optional(),
})

export function ConsumeDialog({ open, onOpenChange, runId, material }) {
  const queryClient = useQueryClient()
  const { units } = useLookups()

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      qty: material?.remaining || '',
      uom_id: material?.unit_id || '',
      lot_id: '',
      notes: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data) => consumeMaterial(runId, material.run_material_id, {
      qty: data.qty,
      uom_id: data.uom_id,
      lot_id: data.lot_id || null,
      notes: data.notes || null,
    }),
    onSuccess: () => {
      toast.success('Material consumed')
      queryClient.invalidateQueries({ queryKey: ['run-materials', runId] })
      reset()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message || 'Failed to consume'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Consume: {material?.item_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" step="any" inputMode="decimal" {...register('qty')} className="min-h-[44px]" />
              {errors.qty && <p className="text-sm text-destructive">{errors.qty.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <UnitSelect units={units} {...register('uom_id')} />
              {errors.uom_id && <p className="text-sm text-destructive">{errors.uom_id.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Lot ID (optional)</Label>
            <Input {...register('lot_id')} placeholder="Supplier lot number" />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Optional notes" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="min-h-[44px]">
              {mutation.isPending ? 'Consuming...' : 'Consume'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
