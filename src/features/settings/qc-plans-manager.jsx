import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getQcPlans, getQcPlan, createQcPlan, updateQcPlan, deleteQcPlan, createQcPlanRequirement, deleteQcPlanRequirement } from '@/api/qc-plans'
import { useLookups } from '@/hooks/use-lookups'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { LookupSelect } from '@/components/shared/lookup-select'
import { ClipboardCheck, Plus, Pencil, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

export function QcPlansManager() {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const { qualityMetricTypes } = useLookups()

  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  // Plan form state
  const [name, setName] = useState('')
  const [appliesTo, setAppliesTo] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Requirement form state
  const [reqOpen, setReqOpen] = useState(false)
  const [reqPlanId, setReqPlanId] = useState(null)
  const [reqMetricTypeId, setReqMetricTypeId] = useState('')
  const [reqStage, setReqStage] = useState('PreProduction')
  const [reqRequired, setReqRequired] = useState(true)
  const [reqMin, setReqMin] = useState('')
  const [reqMax, setReqMax] = useState('')
  const [reqFailDev, setReqFailDev] = useState(false)

  const { data: plans = [] } = useQuery({
    queryKey: ['qc-plans'],
    queryFn: getQcPlans,
    enabled: can('manage_qc_plans'),
  })

  const { data: expandedPlan } = useQuery({
    queryKey: ['qc-plan', expandedId],
    queryFn: () => getQcPlan(expandedId),
    enabled: !!expandedId,
  })

  const createMutation = useMutation({
    mutationFn: createQcPlan,
    onSuccess: () => {
      toast.success('QC Plan created')
      queryClient.invalidateQueries({ queryKey: ['qc-plans'] })
      closeForm()
    },
    onError: () => toast.error('Failed to create plan'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateQcPlan(id, payload),
    onSuccess: () => {
      toast.success('QC Plan updated')
      queryClient.invalidateQueries({ queryKey: ['qc-plans'] })
      queryClient.invalidateQueries({ queryKey: ['qc-plan'] })
      closeForm()
    },
    onError: () => toast.error('Failed to update plan'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteQcPlan,
    onSuccess: () => {
      toast.success('QC Plan deleted')
      queryClient.invalidateQueries({ queryKey: ['qc-plans'] })
      setDeleteOpen(false)
      setDeletingId(null)
      if (expandedId === deletingId) setExpandedId(null)
    },
    onError: () => toast.error('Failed to delete plan'),
  })

  const addReqMutation = useMutation({
    mutationFn: ({ planId, payload }) => createQcPlanRequirement(planId, payload),
    onSuccess: () => {
      toast.success('Requirement added')
      queryClient.invalidateQueries({ queryKey: ['qc-plan', reqPlanId] })
      closeReqForm()
    },
    onError: () => toast.error('Failed to add requirement'),
  })

  const deleteReqMutation = useMutation({
    mutationFn: ({ planId, reqId }) => deleteQcPlanRequirement(planId, reqId),
    onSuccess: () => {
      toast.success('Requirement removed')
      queryClient.invalidateQueries({ queryKey: ['qc-plan', expandedId] })
    },
    onError: () => toast.error('Failed to remove requirement'),
  })

  if (!can('manage_qc_plans')) return null

  function openCreate() {
    setEditing(null)
    setName('')
    setAppliesTo('')
    setIsActive(true)
    setFormOpen(true)
  }

  function openEdit(plan) {
    setEditing(plan)
    setName(plan.name)
    setAppliesTo(plan.applies_to_recipe_category || '')
    setIsActive(plan.is_active)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  function handleSave() {
    const payload = {
      name,
      applies_to_recipe_category: appliesTo || null,
      is_active: isActive,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.qc_plan_id, payload: { name, is_active: isActive } })
    } else {
      createMutation.mutate(payload)
    }
  }

  function openAddReq(planId) {
    setReqPlanId(planId)
    setReqMetricTypeId('')
    setReqStage('PreProduction')
    setReqRequired(true)
    setReqMin('')
    setReqMax('')
    setReqFailDev(false)
    setReqOpen(true)
  }

  function closeReqForm() {
    setReqOpen(false)
    setReqPlanId(null)
  }

  function handleAddReq() {
    addReqMutation.mutate({
      planId: reqPlanId,
      payload: {
        metric_type_id: reqMetricTypeId,
        stage: reqStage,
        required: reqRequired,
        min_value: reqMin ? parseFloat(reqMin) : null,
        max_value: reqMax ? parseFloat(reqMax) : null,
        fail_requires_deviation: reqFailDev,
        sort_order: (expandedPlan?.requirements?.length || 0),
      },
    })
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> QC Plans
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Plan
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No QC plans defined yet. Create one to define quality requirements for production runs.</p>
        ) : (
          <div className="space-y-2">
            {plans.map((plan) => (
              <div key={plan.qc_plan_id} className="rounded-md border">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedId(expandedId === plan.qc_plan_id ? null : plan.qc_plan_id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedId === plan.qc_plan_id
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                    <div>
                      <p className="font-medium text-sm">{plan.name}</p>
                      {plan.applies_to_recipe_category && (
                        <span className="text-xs text-muted-foreground">Category: {plan.applies_to_recipe_category}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={plan.is_active ? 'success' : 'outline'}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(plan) }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); setDeletingId(plan.qc_plan_id); setDeleteOpen(true) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {expandedId === plan.qc_plan_id && expandedPlan && (
                  <div className="px-3 pb-3 border-t">
                    <div className="flex items-center justify-between py-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Requirements</p>
                      <Button size="sm" variant="outline" onClick={() => openAddReq(plan.qc_plan_id)}>
                        <Plus className="h-3 w-3" /> Add
                      </Button>
                    </div>
                    {(expandedPlan.requirements || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No requirements defined.</p>
                    ) : (
                      <div className="space-y-1">
                        {expandedPlan.requirements.map((req) => (
                          <div key={req.qc_plan_requirement_id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{req.metric_type_name || 'Unknown Metric'}</span>
                              <Badge variant="outline" className="text-[10px]">{req.stage}</Badge>
                              {req.required && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
                              {req.min_value != null && <span className="text-xs text-muted-foreground">Min: {req.min_value}</span>}
                              {req.max_value != null && <span className="text-xs text-muted-foreground">Max: {req.max_value}</span>}
                              {req.fail_requires_deviation && <Badge variant="destructive" className="text-[10px]">Fail → Deviation</Badge>}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => deleteReqMutation.mutate({ planId: plan.qc_plan_id, reqId: req.qc_plan_requirement_id })}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Plan Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit QC Plan' : 'New QC Plan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Hot Sauce QC" />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Applies to Category (optional)</Label>
                <Input value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} placeholder="e.g. Hot Sauces" />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Requirement Dialog */}
      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add QC Requirement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Metric Type</Label>
              <LookupSelect
                items={qualityMetricTypes}
                valueField="quality_metric_type_id"
                labelField="name"
                placeholder="Select metric..."
                value={reqMetricTypeId}
                onChange={(e) => setReqMetricTypeId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={reqStage}
                onChange={(e) => setReqStage(e.target.value)}
              >
                <option value="PreProduction">Pre-Production</option>
                <option value="DuringProduction">During Production</option>
                <option value="PostProduction">Post-Production</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Value</Label>
                <Input type="number" step="any" value={reqMin} onChange={(e) => setReqMin(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Max Value</Label>
                <Input type="number" step="any" value={reqMax} onChange={(e) => setReqMax(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Required</Label>
              <Switch checked={reqRequired} onCheckedChange={setReqRequired} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Fail Requires Deviation</Label>
              <Switch checked={reqFailDev} onCheckedChange={setReqFailDev} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeReqForm}>Cancel</Button>
            <Button onClick={handleAddReq} disabled={!reqMetricTypeId || addReqMutation.isPending}>
              {addReqMutation.isPending ? 'Adding...' : 'Add Requirement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete QC Plan"
        description="Are you sure you want to delete this QC plan? This will not affect existing production runs."
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate(deletingId)}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
