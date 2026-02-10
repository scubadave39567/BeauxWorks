import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createDeviation } from '@/api/deviations'
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
import { toast } from 'sonner'

const schema = z.object({
  deviation_type: z.string().min(1, 'Type is required'),
  severity: z.string().min(1, 'Severity is required'),
  details: z.string().min(1, 'Details are required'),
  corrective_action: z.string().optional(),
  preventive_action: z.string().optional(),
})

export function DeviationForm({ open, onOpenChange, runId }) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { deviation_type: '', severity: 'Low', details: '', corrective_action: '', preventive_action: '' },
  })

  const mutation = useMutation({
    mutationFn: (data) =>
      createDeviation(runId, {
        ...data,
        corrective_action: data.corrective_action || null,
        preventive_action: data.preventive_action || null,
      }),
    onSuccess: () => {
      toast.success('Deviation reported')
      queryClient.invalidateQueries({ queryKey: ['batch-record', runId] })
      reset()
      onOpenChange(false)
    },
    onError: () => toast.error('Failed to report deviation'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Deviation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Deviation Type</Label>
              <select
                {...register('deviation_type')}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select type...</option>
                <option value="Temperature">Temperature</option>
                <option value="Timing">Timing</option>
                <option value="Weight">Weight</option>
                <option value="Process">Process</option>
                <option value="Equipment">Equipment</option>
                <option value="Material">Material</option>
                <option value="Other">Other</option>
              </select>
              {errors.deviation_type && (
                <p className="text-sm text-destructive">{errors.deviation_type.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <select
                {...register('severity')}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="Low">Low</option>
                <option value="Med">Medium</option>
                <option value="High">High</option>
              </select>
              {errors.severity && (
                <p className="text-sm text-destructive">{errors.severity.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Details</Label>
            <Textarea {...register('details')} placeholder="Describe the deviation..." />
            {errors.details && (
              <p className="text-sm text-destructive">{errors.details.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Corrective Action</Label>
            <Textarea {...register('corrective_action')} placeholder="Action taken (optional)" />
          </div>

          <div className="space-y-2">
            <Label>Preventive Action</Label>
            <Textarea {...register('preventive_action')} placeholder="Future prevention (optional)" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={mutation.isPending}>
              {mutation.isPending ? 'Submitting...' : 'Report Deviation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
