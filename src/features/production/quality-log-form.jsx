import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createQualityLog } from '@/api/production-runs'
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
import { LookupSelect } from '@/components/shared/lookup-select'
import { toast } from 'sonner'

const schema = z.object({
  quality_metric_type_id: z.string().min(1, 'Metric type is required'),
  value_numeric: z.coerce.number().optional().nullable(),
  value_text: z.string().optional(),
  notes: z.string().optional(),
})

export function QualityLogForm({ open, onOpenChange, runId }) {
  const queryClient = useQueryClient()
  const { qualityMetricTypes } = useLookups()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      quality_metric_type_id: '',
      value_numeric: '',
      value_text: '',
      notes: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data) => createQualityLog(runId, {
      ...data,
      value_numeric: data.value_numeric || null,
      value_text: data.value_text || null,
      notes: data.notes || null,
    }),
    onSuccess: () => {
      toast.success('Quality log added')
      queryClient.invalidateQueries({ queryKey: ['quality-logs', runId] })
      reset()
      onOpenChange(false)
    },
    onError: () => toast.error('Failed to add quality log'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Quality Measurement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Label>Metric Type</Label>
            <LookupSelect
              items={qualityMetricTypes}
              valueField="quality_metric_type_id"
              labelField="name"
              placeholder="Select metric..."
              {...register('quality_metric_type_id')}
            />
            {errors.quality_metric_type_id && (
              <p className="text-sm text-destructive">{errors.quality_metric_type_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Numeric Value</Label>
            <Input type="number" step="any" {...register('value_numeric')} placeholder="e.g. 4.2" />
          </div>

          <div className="space-y-2">
            <Label>Text Value</Label>
            <Input {...register('value_text')} placeholder="e.g. Pass" />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Optional notes" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Log Measurement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
