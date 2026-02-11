import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getIngredientsAll,
  createIngredient,
  updateIngredient as updateIngredientApi,
  deleteIngredient as deleteIngredientApi,
  getItemTypes,
  getIngredientCategories,
} from '@/api/lookups'
import { useLookups } from '@/hooks/use-lookups'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { UnitSelect } from '@/components/shared/unit-select'
import { LookupSelect } from '@/components/shared/lookup-select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Beaker, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function IngredientsManager() {
  const queryClient = useQueryClient()
  const { units, unitsMap } = useLookups()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [itemType, setItemType] = useState('')
  const [ingredientType, setIngredientType] = useState('')
  const [defaultUnitId, setDefaultUnitId] = useState('')
  const [isActive, setIsActive] = useState(true)

  const { data: ingredients = [] } = useQuery({
    queryKey: ['lookups', 'ingredients-all'],
    queryFn: getIngredientsAll,
  })

  const { data: itemTypes = [] } = useQuery({
    queryKey: ['lookups', 'item-types'],
    queryFn: getItemTypes,
    staleTime: Infinity,
  })

  const { data: ingredientCategories = [] } = useQuery({
    queryKey: ['lookups', 'ingredient-categories'],
    queryFn: getIngredientCategories,
    staleTime: Infinity,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lookups', 'ingredients-all'] })
    queryClient.invalidateQueries({ queryKey: ['lookups', 'ingredients'] })
  }

  const createMutation = useMutation({
    mutationFn: createIngredient,
    onSuccess: () => {
      toast.success('Ingredient created')
      invalidate()
      closeForm()
    },
    onError: () => toast.error('Failed to create ingredient'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateIngredientApi(id, payload),
    onSuccess: () => {
      toast.success('Ingredient updated')
      invalidate()
      closeForm()
    },
    onError: () => toast.error('Failed to update ingredient'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteIngredientApi,
    onSuccess: () => {
      toast.success('Ingredient deleted')
      invalidate()
      setDeleteOpen(false)
      setDeletingId(null)
    },
    onError: () => toast.error('Failed to delete ingredient'),
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setSku('')
    setItemType(itemTypes[0]?.name || '')
    setIngredientType('')
    setDefaultUnitId('')
    setIsActive(true)
    setFormOpen(true)
  }

  function openEdit(ing) {
    setEditing(ing)
    setName(ing.name)
    setSku(ing.sku || '')
    setItemType(ing.item_type || '')
    setIngredientType(ing.ingredient_type || '')
    setDefaultUnitId(ing.default_unit_id || '')
    setIsActive(ing.is_active)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  function handleSave() {
    const payload = {
      name,
      sku: sku || null,
      item_type: itemType || null,
      ingredient_type: ingredientType || null,
      default_unit_id: defaultUnitId || null,
    }
    if (editing) {
      payload.is_active = isActive
      updateMutation.mutate({ id: editing.ingredient_id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  // Build select options from dynamic data
  const itemTypeOptions = itemTypes.map((t) => ({ value: t.name, label: t.name }))
  const categoryOptions = ingredientCategories.map((c) => ({ value: c.name, label: c.name }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Beaker className="h-5 w-5" /> Ingredients / Items
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ingredients defined yet.</p>
        ) : (
          <div className="space-y-2">
            {ingredients.map((ing) => (
              <div
                key={ing.ingredient_id}
                className="flex items-center justify-between p-3 rounded-md border"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-sm">
                      {ing.name}
                      {!ing.is_active && (
                        <Badge variant="outline" className="ml-2 text-xs">Inactive</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ing.item_type}
                      {ing.ingredient_type && <> &bull; {ing.ingredient_type}</>}
                      {ing.sku && <> &bull; SKU: {ing.sku}</>}
                      {ing.default_unit_id && (
                        <> &bull; Default: {unitsMap.get(ing.default_unit_id)?.abbreviation}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ing)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      setDeletingId(ing.ingredient_id)
                      setDeleteOpen(true)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Ingredient' : 'New Ingredient'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Habanero Peppers"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item Type</Label>
                <LookupSelect
                  items={itemTypeOptions}
                  valueField="value"
                  labelField="label"
                  placeholder="Select type..."
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <LookupSelect
                  items={categoryOptions}
                  valueField="value"
                  labelField="label"
                  placeholder="Select category..."
                  value={ingredientType}
                  onChange={(e) => setIngredientType(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Default Unit</Label>
                <UnitSelect
                  units={units}
                  value={defaultUnitId}
                  onChange={(e) => setDefaultUnitId(e.target.value)}
                  placeholder="Select unit..."
                />
              </div>
            </div>
            {editing && (
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Ingredient"
        description="Are you sure you want to delete this ingredient? It will be removed from the lookup list but existing recipe references will be preserved."
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate(deletingId)}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
