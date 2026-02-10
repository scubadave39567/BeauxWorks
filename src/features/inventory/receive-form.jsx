import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTransaction } from '@/api/inventory'
import { useLookups } from '@/hooks/use-lookups'
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
import { Textarea } from '@/components/ui/textarea'
import { UnitSelect } from '@/components/shared/unit-select'
import { LookupSelect } from '@/components/shared/lookup-select'
import { toast } from 'sonner'

const schema = z.object({
  ingredient_id: z.string().min(1, 'Ingredient is required'),
  facility_id: z.string().min(1, 'Facility is required'),
  transaction_type: z.string().min(1, 'Type is required'),
  quantity: z.coerce.number().positive('Must be positive'),
  unit_id: z.string().min(1, 'Unit is required'),
  reference_notes: z.string().optional(),
})

export function ReceiveForm({ open, onOpenChange, ingredients = [] }) {
  const queryClient = useQueryClient()
  const { facilities, units } = useLookups()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ingredient_id: '',
      facility_id: '',
      transaction_type: 'purchase',
      quantity: '',
      unit_id: '',
      reference_notes: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data) => {
      const outbound = ['usage', 'waste', 'adjustment_out'].includes(data.transaction_type)
      return createTransaction({
        ...data,
        quantity: outbound ? -Math.abs(data.quantity) : Math.abs(data.quantity),
        reference_notes: data.reference_notes || null,
      })
    },
    onSuccess: () => {
      toast.success('Transaction recorded')
      queryClient.invalidateQueries({ queryKey: ['inventory-status'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      reset()
      onOpenChange(false)
    },
    onError: () => toast.error('Failed to record transaction'),
  })

  // Get unique ingredient list from inventory
  const ingredientOptions = ingredients.reduce((acc, item) => {
    if (!acc.find((i) => i.ingredient_id === item.ingredient_id)) {
      acc.push({ ingredient_id: item.ingredient_id, name: item.ingredient_name })
    }
    return acc
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <select
              {...register('transaction_type')}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="purchase">Receive / Purchase</option>
              <option value="usage">Use / Consume</option>
              <option value="adjustment_in">Adjustment In</option>
              <option value="adjustment_out">Adjustment Out</option>
              <option value="waste">Waste / Loss</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Ingredient</Label>
            <LookupSelect
              items={ingredientOptions}
              valueField="ingredient_id"
              labelField="name"
              placeholder="Select ingredient..."
              {...register('ingredient_id')}
            />
            {errors.ingredient_id && (
              <p className="text-sm text-destructive">{errors.ingredient_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Facility</Label>
            <LookupSelect
              items={facilities}
              valueField="facility_id"
              labelField="name"
              placeholder="Select facility..."
              {...register('facility_id')}
            />
            {errors.facility_id && (
              <p className="text-sm text-destructive">{errors.facility_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" step="any" {...register('quantity')} placeholder="e.g. 50" />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <UnitSelect units={units} {...register('unit_id')} />
              {errors.unit_id && (
                <p className="text-sm text-destructive">{errors.unit_id.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reference Notes</Label>
            <Textarea {...register('reference_notes')} placeholder="e.g. PO #12345" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
