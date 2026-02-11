import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addStep, updateStep, deleteStep } from '@/api/recipes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export function StepEditor({ recipeId, version }) {
  const queryClient = useQueryClient()
  const isDraft = version?.status === 'Draft'

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const [stepNumber, setStepNumber] = useState('')
  const [instruction, setInstruction] = useState('')
  const [ccp, setCcp] = useState(false)
  const [notes, setNotes] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] })

  const addMutation = useMutation({
    mutationFn: (payload) => addStep(recipeId, version.recipe_version_id, payload),
    onSuccess: () => { toast.success('Step added'); invalidate(); closeForm() },
    onError: (e) => toast.error(e.message || 'Failed to add step'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateStep(recipeId, version.recipe_version_id, id, payload),
    onSuccess: () => { toast.success('Step updated'); invalidate(); closeForm() },
    onError: (e) => toast.error(e.message || 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteStep(recipeId, version.recipe_version_id, id),
    onSuccess: () => { toast.success('Step removed'); invalidate(); setDeleteOpen(false) },
    onError: (e) => toast.error(e.message || 'Failed to remove'),
  })

  function openAdd() {
    setEditing(null)
    const steps = version?.steps || []
    setStepNumber(String(steps.filter(s => !s.is_deleted).length + 1))
    setInstruction('')
    setCcp(false)
    setNotes('')
    setAddOpen(true)
  }

  function openEdit(step) {
    setEditing(step)
    setStepNumber(String(step.step_number))
    setInstruction(step.instruction)
    setCcp(step.critical_control_point)
    setNotes(step.notes || '')
    setEditOpen(true)
  }

  function closeForm() {
    setAddOpen(false)
    setEditOpen(false)
    setEditing(null)
  }

  function handleAdd() {
    addMutation.mutate({
      step_number: parseInt(stepNumber),
      instruction,
      critical_control_point: ccp,
      notes: notes || null,
    })
  }

  function handleUpdate() {
    updateMutation.mutate({
      id: editing.recipe_version_step_id,
      payload: {
        step_number: parseInt(stepNumber),
        instruction,
        critical_control_point: ccp,
        notes: notes || null,
      },
    })
  }

  const steps = (version?.steps || []).sort((a, b) => a.step_number - b.step_number)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Steps</CardTitle>
          {isDraft && (
            <Button size="sm" onClick={openAdd} className="min-h-[44px]">
              <Plus className="h-4 w-4" /> Add Step
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No steps defined yet.</p>
            {isDraft && (
              <Button variant="outline" className="mt-3" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add your first step
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((step) => (
              <div
                key={step.recipe_version_step_id}
                className="flex gap-4 p-4 rounded-lg border"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {step.step_number}
                </div>
                <div className="flex-1">
                  <p className="text-sm">{step.instruction}</p>
                  {step.critical_control_point && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Critical Control Point
                    </div>
                  )}
                  {step.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{step.notes}</p>
                  )}
                </div>
                {isDraft && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(step)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingId(step.recipe_version_step_id); setDeleteOpen(true) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen || editOpen} onOpenChange={(v) => { if (!v) closeForm() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Step' : 'Add Step'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Step Number</Label>
              <Input type="number" value={stepNumber} onChange={(e) => setStepNumber(e.target.value)} className="w-24" />
            </div>
            <div className="space-y-2">
              <Label>Instruction</Label>
              <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Describe this step..." rows={4} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Critical Control Point</Label>
              <Switch checked={ccp} onCheckedChange={setCcp} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              onClick={editing ? handleUpdate : handleAdd}
              disabled={!instruction.trim() || !stepNumber || (editing ? updateMutation.isPending : addMutation.isPending)}
              className="min-h-[44px]"
            >
              {(editing ? updateMutation.isPending : addMutation.isPending) ? 'Saving...' : editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove Step"
        description="Are you sure you want to remove this step?"
        confirmLabel="Remove"
        onConfirm={() => deleteMutation.mutate(deletingId)}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
