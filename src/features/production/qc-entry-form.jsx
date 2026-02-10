import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createQcEntry } from '@/api/run-qc'
import { useLookups } from '@/hooks/use-lookups'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LookupSelect } from '@/components/shared/lookup-select'
import { toast } from 'sonner'

const schema = z.object({
  metric_type_id: z.string().min(1, 'Metric type is required'),
  stage: z.string().min(1, 'Stage is required'),
  value_number: z.coerce.number().optional().nullable(),
  value_text: z.string().optional(),
  notes: z.string().optional(),
})

const STAGES = [
  { value: 'PreProduction', label: 'Pre-Production' },
  { value: 'InProcess', label: 'In Process' },
  { value: 'PostProduction', label: 'Post-Production' },
]

export function QcEntryForm({ open, onOpenChange, runId }) {
  const queryClient = useQueryClient()
  const { qualityMetricTypes } = useLookups()

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      metric_type_id: '',
      stage: 'InProcess',
      value_number: '',
      value_text: '',
      notes: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data) => createQcEntry(runId, {
      ...data,
      value_number: data.value_number || null,
      value_text: data.value_text || null,
      notes: data.notes || null,
    }),
    onSuccess: () => {
      toast.success('QC entry recorded')
      queryClient.invalidateQueries({ queryKey: ['qc-requirements', runId] })
      reset()
      onOpenChange(false)
    },
    onError: (e) => {
      if (e.errorCode === 'QC_FAIL_REQUIRES_DEVIATION') {
        toast.error('QC value out of range — a deviation is required')
      } else {
        toast.error(e.message || 'Failed to record QC entry')
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record QC Measurement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Label>Metric Type</Label>
            <LookupSelect
              items={qualityMetricTypes}
              valueField="quality_metric_type_id"
              labelField="name"
              placeholder="Select metric..."
              {...register('metric_type_id')}
            />
            {errors.metric_type_id && <p className="text-sm text-destructive">{errors.metric_type_id.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Stage</Label>
            <select {...register('stage')} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]">
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Numeric Value</Label>
            <Input type="number" step="any" inputMode="decimal" {...register('value_number')} placeholder="e.g. 4.2" className="min-h-[44px]" />
          </div>

          <div className="space-y-2">
            <Label>Text Value</Label>
            <Input {...register('value_text')} placeholder="e.g. Pass" />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Required for some metrics" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="min-h-[44px]">
              {mutation.isPending ? 'Saving...' : 'Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
