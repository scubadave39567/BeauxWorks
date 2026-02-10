import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getRecipe, createRecipe, updateRecipe } from '@/api/recipes'
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
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  recipe_category_id: z.string().optional(),
  default_base_yield_value: z.coerce.number().positive('Yield must be positive'),
  default_base_yield_unit_id: z.string().min(1, 'Unit is required'),
})

export default function RecipeFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { units, recipeCategories } = useLookups()

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => getRecipe(id),
    enabled: isEdit,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      recipe_category_id: '',
      default_base_yield_value: '',
      default_base_yield_unit_id: '',
    },
  })

  useEffect(() => {
    if (recipe) {
      reset({
        name: recipe.name,
        description: recipe.description || '',
        recipe_category_id: recipe.recipe_category_id || '',
        default_base_yield_value: recipe.default_base_yield_value,
        default_base_yield_unit_id: recipe.default_base_yield_unit_id,
      })
    }
  }, [recipe, reset])

  const mutation = useMutation({
    mutationFn: (data) => {
      const cleaned = { ...data }
      if (!cleaned.recipe_category_id) cleaned.recipe_category_id = null
      if (!cleaned.description) cleaned.description = null
      return isEdit ? updateRecipe(id, cleaned) : createRecipe(cleaned)
    },
    onSuccess: (result) => {
      toast.success(isEdit ? 'Recipe updated' : 'Recipe created')
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['recipe', id] })
        navigate(`/recipes/${id}`)
      } else {
        navigate(`/recipes/${result.id}`)
      }
    },
    onError: () => toast.error('Failed to save recipe'),
  })

  if (isEdit && isLoading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Recipe' : 'New Recipe'}
        description={isEdit ? `Editing ${recipe?.name}` : 'Create a new recipe'}
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} placeholder="Recipe name" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <LookupSelect
                items={recipeCategories}
                valueField="recipe_category_id"
                labelField="name"
                placeholder="Select category..."
                {...register('recipe_category_id')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} placeholder="Optional description" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yield">Base Yield</Label>
                <Input
                  id="yield"
                  type="number"
                  step="any"
                  {...register('default_base_yield_value')}
                  placeholder="e.g. 5"
                />
                {errors.default_base_yield_value && (
                  <p className="text-sm text-destructive">{errors.default_base_yield_value.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Yield Unit</Label>
                <UnitSelect
                  units={units}
                  {...register('default_base_yield_unit_id')}
                />
                {errors.default_base_yield_unit_id && (
                  <p className="text-sm text-destructive">{errors.default_base_yield_unit_id.message}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : isEdit ? 'Update Recipe' : 'Create Recipe'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
