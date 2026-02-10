import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { applyScale, getPrintData } from '@/api/scaling'
import { useLookups } from '@/hooks/use-lookups'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UnitSelect } from '@/components/shared/unit-select'
import { Scale, Printer } from 'lucide-react'
import { toast } from 'sonner'

const schema = z.object({
  target_yield_qty: z.coerce.number().positive('Must be positive'),
  target_yield_uom_id: z.string().min(1, 'Unit required'),
})

export function ScalePanel({ runId, runStatus, scalingJson }) {
  const queryClient = useQueryClient()
  const { units } = useLookups()
  const scaling = scalingJson ? JSON.parse(scalingJson) : null

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      target_yield_qty: scaling?.target_yield_value || '',
      target_yield_uom_id: scaling?.target_yield_unit_id || '',
    },
  })

  const scaleMutation = useMutation({
    mutationFn: (data) => applyScale(runId, data),
    onSuccess: () => {
      toast.success('Run re-scaled successfully')
      queryClient.invalidateQueries({ queryKey: ['run', runId] })
      queryClient.invalidateQueries({ queryKey: ['run-materials', runId] })
    },
    onError: (e) => {
      if (e.errorCode === 'SCALING_LOCKED_AFTER_CONSUMPTION') {
        toast.error('Cannot re-scale after materials have been consumed')
      } else {
        toast.error(e.message || 'Failed to scale')
      }
    },
  })

  function handlePrint() {
    getPrintData(runId).then((data) => {
      const win = window.open('', '_blank')
      const ingredients = (data.ingredients || []).map((i) =>
        `<tr><td style="padding:4px 8px;text-align:right;font-family:monospace">${i.planned_qty}</td><td style="padding:4px 8px;font-weight:600">${i.name}</td></tr>`
      ).join('')
      const steps = (data.steps || []).map((s, idx) =>
        `<div style="margin-bottom:8px"><strong>${s.step_number || idx + 1}.</strong> ${s.instruction}${s.critical_control_point ? ' <span style="color:red">CCP</span>' : ''}</div>`
      ).join('')
      win.document.write(`<!DOCTYPE html><html><head><title>${data.title}</title></head><body style="font-family:sans-serif;max-width:700px;margin:auto;padding:20px">
        <h1>${data.title}</h1><p>Facility: ${data.facility} | Date: ${data.date || 'N/A'} | Multiplier: ${data.multiplier}x</p>
        <h2>Ingredients</h2><table style="width:100%;border-collapse:collapse">${ingredients}</table>
        <h2>Steps</h2>${steps}
        <h2>QC Checklist</h2>${(data.qc_checklist || []).map((q) => `<p>☐ ${q.metric_type_name || 'Metric'} (${q.stage})</p>`).join('')}
        <hr><div style="display:flex;gap:40px;margin-top:20px">${(data.signature_lines || []).map((l) => `<div><p style="border-top:1px solid #000;padding-top:4px;min-width:150px">${l}</p></div>`).join('')}</div>
      </body></html>`)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 500)
    }).catch(() => toast.error('Failed to load print data'))
  }

  const isInProgress = runStatus === 'InProgress'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Scaling</CardTitle>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4" /> Print Batch Record
        </Button>
      </CardHeader>
      <CardContent>
        {scaling && (
          <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
            <div><p className="text-muted-foreground">Multiplier</p><p className="font-mono font-medium">{scaling.multiplier?.toFixed(2)}x</p></div>
            <div><p className="text-muted-foreground">Base Yield</p><p className="font-mono">{scaling.base_yield_value}</p></div>
            <div><p className="text-muted-foreground">Target Yield</p><p className="font-mono">{scaling.target_yield_value}</p></div>
          </div>
        )}
        {isInProgress && (
          <form onSubmit={handleSubmit((data) => scaleMutation.mutate(data))} className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">New Target Yield</Label>
              <Input type="number" step="any" {...register('target_yield_qty')} className="min-h-[44px]" />
              {errors.target_yield_qty && <p className="text-xs text-destructive">{errors.target_yield_qty.message}</p>}
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-xs">Unit</Label>
              <UnitSelect units={units} {...register('target_yield_uom_id')} />
            </div>
            <Button type="submit" disabled={scaleMutation.isPending} className="min-h-[44px]">
              <Scale className="h-4 w-4" /> Re-Scale
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
