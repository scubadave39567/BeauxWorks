import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createRun } from '@/api/runs'
import { getRecipes } from '@/api/recipes'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { LookupSelect } from '@/components/shared/lookup-select'
import { UnitSelect } from '@/components/shared/unit-select'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { toast } from 'sonner'

const schema = z.object({
  recipe_version_id: z.string().min(1, 'Recipe version is required'),
  facility_id: z.string().min(1, 'Facility is required'),
  target_yield_qty: z.coerce.number().positive('Yield must be positive'),
  target_yield_uom_id: z.string().min(1, 'Unit is required'),
  notes: z.string().optional(),
})

export default function ProductionRunFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { facilities, units } = useLookups()

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['recipes'],
    queryFn: getRecipes,
  })

  // Only show Released recipe versions
  const versionOptions = recipes.flatMap((r) =>
    (r.versions || [])
      .filter((v) => v.status === 'Released')
      .map((v) => ({
        recipe_version_id: v.recipe_version_id,
        label: `${r.name} — v${v.version_number} (Released)`,
      }))
  )

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      recipe_version_id: '',
      facility_id: '',
      target_yield_qty: '',
      target_yield_uom_id: '',
      notes: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data) => createRun({
      recipe_version_id: data.recipe_version_id,
      facility_id: data.facility_id,
      target_yield_qty: data.target_yield_qty,
      target_yield_uom_id: data.target_yield_uom_id,
      notes: data.notes || null,
    }),
    onSuccess: (result) => {
      toast.success('Production run created')
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      navigate(`/production/${result.production_run_id}`)
    },
    onError: (e) => toast.error(e.message || 'Failed to create run'),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader title="New Production Run" description="Create a run from a released recipe version" />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label>Recipe Version (Released only)</Label>
              <LookupSelect
                items={versionOptions}
                valueField="recipe_version_id"
                labelField="label"
                placeholder="Select recipe version..."
                value={watch('recipe_version_id')}
                onChange={(e) => setValue('recipe_version_id', e.target.value)}
              />
              {errors.recipe_version_id && <p className="text-sm text-destructive">{errors.recipe_version_id.message}</p>}
              {versionOptions.length === 0 && (
                <p className="text-sm text-amber-600">No released recipe versions available. Release a recipe version first.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Facility</Label>
              <LookupSelect items={facilities} valueField="facility_id" labelField="name" placeholder="Select facility..." value={watch('facility_id')} onChange={(e) => setValue('facility_id', e.target.value)} />
              {errors.facility_id && <p className="text-sm text-destructive">{errors.facility_id.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Yield</Label>
                <Input type="number" step="any" {...register('target_yield_qty')} className="min-h-[44px]" />
                {errors.target_yield_qty && <p className="text-sm text-destructive">{errors.target_yield_qty.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Yield Unit</Label>
                <UnitSelect units={units} value={watch('target_yield_uom_id')} onChange={(e) => setValue('target_yield_uom_id', e.target.value)} />
                {errors.target_yield_uom_id && <p className="text-sm text-destructive">{errors.target_yield_uom_id.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea {...register('notes')} placeholder="Optional notes" />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={mutation.isPending} className="min-h-[44px]">
                {mutation.isPending ? 'Creating...' : 'Create Run'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)} className="min-h-[44px]">Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
