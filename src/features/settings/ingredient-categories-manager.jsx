import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIngredientCategories, createIngredientCategory, updateIngredientCategory, deleteIngredientCategory } from '@/api/lookups'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { FolderTree, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function IngredientCategoriesManager() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState(0)

  const { data: categories = [] } = useQuery({
    queryKey: ['lookups', 'ingredient-categories'],
    queryFn: getIngredientCategories,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lookups', 'ingredient-categories'] })

  const createMutation = useMutation({
    mutationFn: createIngredientCategory,
    onSuccess: () => { toast.success('Category created'); invalidate(); closeForm() },
    onError: () => toast.error('Failed to create category'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateIngredientCategory(id, payload),
    onSuccess: () => { toast.success('Category updated'); invalidate(); closeForm() },
    onError: () => toast.error('Failed to update category'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteIngredientCategory,
    onSuccess: () => { toast.success('Category deleted'); invalidate(); setDeleteOpen(false) },
    onError: () => toast.error('Failed to delete category'),
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setSortOrder(categories.length)
    setFormOpen(true)
  }

  function openEdit(cat) {
    setEditing(cat)
    setName(cat.name)
    setDescription(cat.description || '')
    setSortOrder(cat.sort_order)
    setFormOpen(true)
  }

  function closeForm() { setFormOpen(false); setEditing(null) }

  function handleSave() {
    const payload = { name, description: description || null, sort_order: sortOrder }
    if (editing) updateMutation.mutate({ id: editing.ingredient_category_id, payload })
    else createMutation.mutate(payload)
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderTree className="h-5 w-5" /> Ingredient Categories
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ingredient categories defined yet.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.ingredient_category_id} className="flex items-center justify-between p-3 rounded-md border">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono w-6 text-center">{cat.sort_order}</span>
                  <div>
                    <p className="font-medium text-sm">{cat.name}</p>
                    {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingId(cat.ingredient_category_id); setDeleteOpen(true) }}>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Category' : 'New Category'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Produce" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Ingredient Category"
        description="Are you sure you want to delete this ingredient category?"
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate(deletingId)}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
