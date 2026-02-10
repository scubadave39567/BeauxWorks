import { useMutation, useQueryClient } from '@tanstack/react-query'
import { closeDeviation } from '@/api/deviations'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { toast } from 'sonner'

export function DeviationCloseDialog({ open, onOpenChange, deviationId, runId }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => closeDeviation(deviationId),
    onSuccess: () => {
      toast.success('Deviation closed')
      queryClient.invalidateQueries({ queryKey: ['deviations', runId] })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message || 'Failed to close deviation'),
  })

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Close Deviation"
      description="Confirm that this deviation has been adequately addressed and can be closed."
      confirmLabel="Close Deviation"
      onConfirm={() => mutation.mutate()}
      loading={mutation.isPending}
    />
  )
}
