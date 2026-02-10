import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRun, transitionRunStatus } from '@/api/runs'
import { getDeviations } from '@/api/deviations'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { StickyActionBar } from '@/components/shared/sticky-action-bar'
import { MaterialsPanel } from './materials-panel'
import { QcRequirementsPanel } from './qc-requirements-panel'
import { QcEntryForm } from './qc-entry-form'
import { DeviationForm } from './deviation-form'
import { DeviationCloseDialog } from './deviation-close-dialog'
import { ScalePanel } from './scale-panel'
import { Play, CheckCircle2, XCircle, ClipboardPlus, AlertTriangle, Printer } from 'lucide-react'
import { formatDateTime, formatNumber } from '@/lib/format'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/use-permissions'

export default function ProductionRunDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { facilitiesMap, unitsMap } = useLookups()
  const { hasRole } = usePermissions()
  const [qcOpen, setQcOpen] = useState(false)
  const [deviationOpen, setDeviationOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [finalYield, setFinalYield] = useState('')
  const [closeDevId, setCloseDevId] = useState(null)

  const { data: run, isLoading } = useQuery({
    queryKey: ['run', id],
    queryFn: () => getRun(id),
  })

  const { data: deviations = [] } = useQuery({
    queryKey: ['deviations', id],
    queryFn: () => getDeviations(id),
  })

  const startMutation = useMutation({
    mutationFn: () => transitionRunStatus(id, { target_status: 'InProgress' }),
    onSuccess: () => {
      toast.success('Run started — snapshot generated')
      queryClient.invalidateQueries({ queryKey: ['run', id] })
    },
    onError: (e) => toast.error(e.message || 'Failed to start'),
  })

  const completeMutation = useMutation({
    mutationFn: () => transitionRunStatus(id, {
      target_status: 'Completed',
      final_yield_qty: parseFloat(finalYield),
      final_yield_uom_id: run?.target_yield_unit_id,
    }),
    onSuccess: () => {
      toast.success('Run completed')
      setCompleteOpen(false)
      queryClient.invalidateQueries({ queryKey: ['run', id] })
    },
    onError: (e) => {
      if (e.errorCode === 'FINAL_YIELD_REQUIRED') toast.error('Final yield quantity is required')
      else if (e.errorCode === 'QC_REQUIREMENTS_NOT_MET') toast.error('QC requirements not met')
      else toast.error(e.message || 'Failed to complete')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => transitionRunStatus(id, { target_status: 'Canceled' }),
    onSuccess: () => {
      toast.success('Run canceled')
      setCancelOpen(false)
      queryClient.invalidateQueries({ queryKey: ['run', id] })
    },
    onError: (e) => toast.error(e.message || 'Failed to cancel'),
  })

  if (isLoading) return <LoadingSpinner />
  if (!run) return null

  const facility = facilitiesMap.get(run.facility_id)
  const isPlanned = run.status === 'Planned'
  const isInProgress = run.status === 'InProgress'
  const canCancel = (isPlanned || isInProgress) && hasRole('admin', 'qa')

  return (
    <div>
      <PageHeader title={run.lot_code || 'Production Run'} description={facility?.name || ''}>
        {isPlanned && (
          <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending} className="min-h-[44px]">
            <Play className="h-4 w-4" /> Start Run
          </Button>
        )}
        {isInProgress && (
          <Button onClick={() => setCompleteOpen(true)} className="min-h-[44px]">
            <CheckCircle2 className="h-4 w-4" /> Complete
          </Button>
        )}
        {canCancel && (
          <Button variant="destructive" onClick={() => setCancelOpen(true)} className="min-h-[44px]">
            <XCircle className="h-4 w-4" /> Cancel
          </Button>
        )}
      </PageHeader>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <StatusBadge status={run.status.toLowerCase()} label={run.status} />
        <span className="text-sm text-muted-foreground">
          Target: {formatNumber(run.target_yield_value)} {unitsMap.get(run.target_yield_unit_id)?.abbreviation}
        </span>
        {run.actual_yield_value != null && (
          <span className="text-sm text-muted-foreground">
            Actual: {formatNumber(run.actual_yield_value)} {unitsMap.get(run.actual_yield_unit_id)?.abbreviation}
          </span>
        )}
        {run.snapshot_exists && <Badge variant="secondary">Snapshot</Badge>}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="qc">QC</TabsTrigger>
          <TabsTrigger value="deviations">Deviations ({deviations.length})</TabsTrigger>
          <TabsTrigger value="batch">Batch Record</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><p className="text-muted-foreground">Lot Code</p><p className="font-mono font-medium">{run.lot_code || '—'}</p></div>
                <div><p className="text-muted-foreground">Facility</p><p>{facility?.name || '—'}</p></div>
                <div><p className="text-muted-foreground">Status</p><StatusBadge status={run.status.toLowerCase()} label={run.status} /></div>
                <div><p className="text-muted-foreground">Started</p><p>{formatDateTime(run.started_at)}</p></div>
                <div><p className="text-muted-foreground">Completed</p><p>{formatDateTime(run.completed_at)}</p></div>
                <div><p className="text-muted-foreground">Created</p><p>{formatDateTime(run.created_at)}</p></div>
                {run.notes && <div className="col-span-full"><p className="text-muted-foreground">Notes</p><p>{run.notes}</p></div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials">
          <MaterialsPanel runId={id} runStatus={run.status} />
        </TabsContent>

        <TabsContent value="qc">
          <div className="space-y-4">
            <QcRequirementsPanel runId={id} />
            {isInProgress && (
              <Button onClick={() => setQcOpen(true)} className="min-h-[44px]">
                <ClipboardPlus className="h-4 w-4" /> Record QC Entry
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="deviations">
          <Card>
            <CardContent className="pt-6">
              {deviations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deviations recorded</p>
              ) : (
                <div className="space-y-3">
                  {deviations.map((d) => (
                    <div key={d.production_run_deviation_id} className="p-4 rounded-md border">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{d.deviation_type}</p>
                          <p className="text-sm text-muted-foreground">{d.details}</p>
                          {d.corrective_action && <p className="text-sm mt-1">CA: {d.corrective_action}</p>}
                          {d.preventive_action && <p className="text-sm mt-1">PA: {d.preventive_action}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={d.severity === 'High' ? 'destructive' : d.severity === 'Med' ? 'default' : 'secondary'}>{d.severity}</Badge>
                          <Badge variant={d.status === 'Closed' ? 'success' : 'outline'}>{d.status}</Badge>
                          {d.status === 'Open' && hasRole('admin', 'qa') && (
                            <Button size="sm" variant="outline" onClick={() => setCloseDevId(d.production_run_deviation_id)}>Close</Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{formatDateTime(d.detected_at)}</p>
                    </div>
                  ))}
                </div>
              )}
              {isInProgress && (
                <Button variant="outline" onClick={() => setDeviationOpen(true)} className="mt-4 min-h-[44px]">
                  <AlertTriangle className="h-4 w-4" /> Report Deviation
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <ScalePanel runId={id} runStatus={run.status} scalingJson={run.scaling_json} />
        </TabsContent>
      </Tabs>

      <StickyActionBar className="md:hidden">
        {isInProgress && (
          <>
            <Button className="flex-1 min-h-[44px]" onClick={() => setQcOpen(true)}>
              <ClipboardPlus className="h-4 w-4" /> QC
            </Button>
            <Button variant="destructive" className="flex-1 min-h-[44px]" onClick={() => setDeviationOpen(true)}>
              <AlertTriangle className="h-4 w-4" /> Deviation
            </Button>
          </>
        )}
      </StickyActionBar>

      <QcEntryForm open={qcOpen} onOpenChange={setQcOpen} runId={id} />
      <DeviationForm open={deviationOpen} onOpenChange={setDeviationOpen} runId={id} />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Production Run"
        description="This will cancel the run. This action cannot be undone."
        confirmLabel="Cancel Run"
        onConfirm={() => cancelMutation.mutate()}
        loading={cancelMutation.isPending}
      />

      {/* Complete dialog with final yield input */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete Production Run</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Final Yield Quantity</Label>
              <Input type="number" step="any" inputMode="decimal" value={finalYield} onChange={(e) => setFinalYield(e.target.value)}
                placeholder="Enter actual yield" className="min-h-[44px]" />
            </div>
            <p className="text-sm text-muted-foreground">
              Unit: {unitsMap.get(run.target_yield_unit_id)?.abbreviation || 'same as target'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending || !finalYield} className="min-h-[44px]">
              {completeMutation.isPending ? 'Completing...' : 'Complete Run'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {closeDevId && (
        <DeviationCloseDialog
          open={!!closeDevId}
          onOpenChange={(v) => { if (!v) setCloseDevId(null) }}
          deviationId={closeDevId}
          runId={id}
        />
      )}
    </div>
  )
}
