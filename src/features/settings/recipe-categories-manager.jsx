import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRecipeCategories, createRecipeCategory, updateRecipeCategory, deleteRecipeCategory } from '@/api/lookups'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Tags, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function RecipeCategoriesManager() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isFermented, setIsFermented] = useState(false)

  const { data: categories = [] } = useQuery({
    queryKey: ['lookups', 'recipe-categories'],
    queryFn: getRecipeCategories,
  })

  const createMutation = useMutation({
    mutationFn: createRecipeCategory,
    onSuccess: () => {
      toast.success('Category created')
      queryClient.invalidateQueries({ queryKey: ['lookups', 'recipe-categories'] })
      closeForm()
    },
    onError: () => toast.error('Failed to create category'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateRecipeCategory(id, payload),
    onSuccess: () => {
      toast.success('Category updated')
      queryClient.invalidateQueries({ queryKey: ['lookups', 'recipe-categories'] })
      closeForm()
    },
    onError: () => toast.error('Failed to update category'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRecipeCategory,
    onSuccess: () => {
      toast.success('Category deleted')
      queryClient.invalidateQueries({ queryKey: ['lookups', 'recipe-categories'] })
      setDeleteOpen(false)
      setDeletingId(null)
    },
    onError: () => toast.error('Failed to delete category'),
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setSortOrder(categories.length)
    setIsFermented(false)
    setFormOpen(true)
  }

  function openEdit(cat) {
    setEditing(cat)
    setName(cat.name)
    setSortOrder(cat.sort_order)
    setIsFermented(cat.is_fermented)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setName('')
    setSortOrder(0)
    setIsFermented(false)
  }

  function handleSave() {
    const payload = { name, sort_order: sortOrder, is_fermented: isFermented }
    if (editing) {
      updateMutation.mutate({ id: editing.recipe_category_id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Tags className="h-5 w-5" /> Recipe Categories
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories defined yet.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.recipe_category_id}
                className="flex items-center justify-between p-3 rounded-md border"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono w-6 text-center">
                    {cat.sort_order}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{cat.name}</p>
                    {cat.is_fermented && (
                      <span className="text-xs text-secondary">Fermented</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      setDeletingId(cat.recipe_category_id)
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
            <DialogTitle>{editing ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hot Sauces"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-sort">Sort Order</Label>
              <Input
                id="cat-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-fermented">May be fermented</Label>
              <Switch
                id="cat-fermented"
                checked={isFermented}
                onCheckedChange={setIsFermented}
              />
            </div>
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
        title="Delete Category"
        description="Are you sure you want to delete this recipe category? Recipes using it will keep their data but the category reference will be cleared."
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate(deletingId)}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
