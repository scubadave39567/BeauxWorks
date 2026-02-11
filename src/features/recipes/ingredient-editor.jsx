import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { addIngredient, updateIngredient, deleteIngredient } from '@/api/recipes'
import { getIngredients } from '@/api/lookups'
import { useLookups } from '@/hooks/use-lookups'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { LookupSelect } from '@/components/shared/lookup-select'
import { UnitSelect } from '@/components/shared/unit-select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { toast } from 'sonner'

export function IngredientEditor({ recipeId, version }) {
  const queryClient = useQueryClient()
  const { units, unitsMap } = useLookups()
  const isDraft = version?.status === 'Draft'

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // Form state
  const [ingredientId, setIngredientId] = useState('')
  const [baseAmount, setBaseAmount] = useState('')
  const [unitId, setUnitId] = useState('')
  const [sortOrder, setSortOrder] = useState('')
  const [notes, setNotes] = useState('')

  const { data: ingredientsList = [] } = useQuery({
    queryKey: ['lookups', 'ingredients'],
    queryFn: getIngredients,
    staleTime: Infinity,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] })

  const addMutation = useMutation({
    mutationFn: (payload) => addIngredient(recipeId, version.recipe_version_id, payload),
    onSuccess: () => { toast.success('Ingredient added'); invalidate(); closeForm() },
    onError: (e) => toast.error(e.message || 'Failed to add ingredient'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateIngredient(recipeId, version.recipe_version_id, id, payload),
    onSuccess: () => { toast.success('Ingredient updated'); invalidate(); closeForm() },
    onError: (e) => toast.error(e.message || 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteIngredient(recipeId, version.recipe_version_id, id),
    onSuccess: () => { toast.success('Ingredient removed'); invalidate(); setDeleteOpen(false) },
    onError: (e) => toast.error(e.message || 'Failed to remove'),
  })

  function openAdd() {
    setEditing(null)
    setIngredientId('')
    setBaseAmount('')
    setUnitId('')
    setSortOrder(String((version.ingredients?.length || 0) + 1))
    setNotes('')
    setAddOpen(true)
  }

  function openEdit(ing) {
    setEditing(ing)
    setIngredientId(ing.ingredient_id)
    setBaseAmount(String(ing.base_amount))
    setUnitId(ing.unit_id)
    setSortOrder(String(ing.sort_order))
    setNotes(ing.notes || '')
    setEditOpen(true)
  }

  function closeForm() {
    setAddOpen(false)
    setEditOpen(false)
    setEditing(null)
  }

  function handleAdd() {
    addMutation.mutate({
      ingredient_id: ingredientId,
      base_amount: parseFloat(baseAmount),
      unit_id: unitId,
      sort_order: parseInt(sortOrder) || 1000,
      notes: notes || null,
    })
  }

  function handleUpdate() {
    updateMutation.mutate({
      id: editing.recipe_version_ingredient_id,
      payload: {
        base_amount: parseFloat(baseAmount),
        unit_id: unitId,
        sort_order: parseInt(sortOrder),
        notes: notes || null,
      },
    })
  }

  const ingredients = (version?.ingredients || []).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Ingredients — v{version?.version_number}
          </CardTitle>
          {isDraft && (
            <Button size="sm" onClick={openAdd} className="min-h-[44px]">
              <Plus className="h-4 w-4" /> Add Ingredient
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {ingredients.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No ingredients defined yet.</p>
            {isDraft && (
              <Button variant="outline" className="mt-3" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add your first ingredient
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Notes</TableHead>
                  {isDraft && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ing) => (
                  <TableRow key={ing.recipe_version_ingredient_id}>
                    <TableCell className="text-muted-foreground">{ing.sort_order}</TableCell>
                    <TableCell className="font-medium">{ing.ingredient_name}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(ing.base_amount)}</TableCell>
                    <TableCell>{ing.unit_abbreviation}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{ing.notes || '—'}</TableCell>
                    {isDraft && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ing)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingId(ing.recipe_version_ingredient_id); setDeleteOpen(true) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Ingredient</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ingredient</Label>
              <LookupSelect
                items={ingredientsList}
                valueField="ingredient_id"
                labelField="name"
                placeholder="Select ingredient..."
                value={ingredientId}
                onChange={(e) => setIngredientId(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="any" inputMode="decimal" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} placeholder="e.g. 500" className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <UnitSelect units={units} value={unitId} onChange={(e) => setUnitId(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!ingredientId || !baseAmount || !unitId || addMutation.isPending} className="min-h-[44px]">
              {addMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Ingredient</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ingredient</Label>
              <Input value={editing?.ingredient_name || ''} disabled className="bg-muted" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="any" inputMode="decimal" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <UnitSelect units={units} value={unitId} onChange={(e) => setUnitId(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={!baseAmount || !unitId || updateMutation.isPending} className="min-h-[44px]">
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove Ingredient"
        description="Are you sure you want to remove this ingredient from the recipe?"
        confirmLabel="Remove"
        onConfirm={() => deleteMutation.mutate(deletingId)}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
