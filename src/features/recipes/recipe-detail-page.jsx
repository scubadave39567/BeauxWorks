import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRecipe, deleteRecipe } from '@/api/recipes'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ScaleCalculator } from './scale-calculator'
import { RecipeVersionManager } from './recipe-version-manager'
import { Pencil, Trash2, Scale, AlertTriangle, Printer } from 'lucide-react'
import { formatNumber, formatDate } from '@/lib/format'
import { toast } from 'sonner'

export default function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { unitsMap, recipeCategoriesMap } = useLookups()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [scaleOpen, setScaleOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const printRef = useRef(null)

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => getRecipe(id),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteRecipe(id),
    onSuccess: () => {
      toast.success('Recipe deleted')
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      navigate('/recipes')
    },
    onError: () => toast.error('Failed to delete recipe'),
  })

  function handlePrint(mode) {
    setPrintOpen(false)
    const currentVersion = recipe.versions?.find((v) => v.is_current) || recipe.versions?.[0]
    if (!currentVersion) return

    const category = recipe.recipe_category_id
      ? recipeCategoriesMap.get(recipe.recipe_category_id)
      : null

    const ingredients = currentVersion.ingredients
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (ing) =>
          `<tr><td style="padding:4px 8px;text-align:right;font-family:monospace">${formatNumber(ing.base_amount)}</td><td style="padding:4px 8px">${ing.unit_abbreviation}</td><td style="padding:4px 8px;font-weight:600">${ing.ingredient_name}</td><td style="padding:4px 8px;color:#666">${ing.notes || ''}</td></tr>`
      )
      .join('')

    const steps = currentVersion.steps
      .sort((a, b) => a.step_number - b.step_number)
      .map(
        (step) =>
          `<div style="margin-bottom:12px;display:flex;gap:12px"><div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#C67D2F;color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px">${step.step_number}</div><div><p style="margin:0">${step.instruction}</p>${step.critical_control_point ? '<p style="margin:4px 0 0;color:#B84233;font-size:12px;font-weight:600">⚠ Critical Control Point</p>' : ''}${step.notes ? `<p style="margin:4px 0 0;color:#666;font-size:12px">${step.notes}</p>` : ''}</div></div>`
      )
      .join('')

    const yieldUnit = unitsMap.get(recipe.default_base_yield_unit_id)?.abbreviation || ''

    let body = `
      <div style="font-family:'Source Sans 3',sans-serif;max-width:700px;margin:0 auto;padding:20px">
        <h1 style="font-family:'Playfair Display',serif;margin:0 0 4px">${recipe.name}</h1>
        ${category ? `<p style="margin:0 0 4px;color:#7A9A6D;font-weight:600">${category.name}</p>` : ''}
        ${recipe.description ? `<p style="margin:0 0 8px;color:#666">${recipe.description}</p>` : ''}
        <p style="margin:0 0 16px;font-size:14px;color:#3D2B1F">
          <strong>Base Yield:</strong> ${formatNumber(recipe.default_base_yield_value)} ${yieldUnit}
          &nbsp;&bull;&nbsp; <strong>Version:</strong> ${currentVersion.version_number}
        </p>
        <hr style="border:none;border-top:1px solid #E8DDD0;margin:16px 0">
    `

    if (mode === 'ingredients' || mode === 'both') {
      body += `
        <h2 style="font-family:'Playfair Display',serif;margin:0 0 8px">Ingredients</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="border-bottom:2px solid #E8DDD0"><th style="text-align:right;padding:4px 8px">Amount</th><th style="text-align:left;padding:4px 8px">Unit</th><th style="text-align:left;padding:4px 8px">Ingredient</th><th style="text-align:left;padding:4px 8px">Notes</th></tr></thead>
          <tbody>${ingredients}</tbody>
        </table>
      `
      if (mode === 'both') {
        body += '<hr style="border:none;border-top:1px solid #E8DDD0;margin:16px 0">'
      }
    }

    if (mode === 'directions' || mode === 'both') {
      body += `
        <h2 style="font-family:'Playfair Display',serif;margin:0 0 12px">Directions</h2>
        ${steps}
      `
    }

    body += `
        <hr style="border:none;border-top:1px solid #E8DDD0;margin:24px 0 8px">
        <p style="font-size:11px;color:#999;text-align:center">Beaux's Bistro — Production Manager</p>
      </div>
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${recipe.name} — Recipe</title><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet"></head><body>${body}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 500)
  }

  if (isLoading) return <LoadingSpinner />
  if (!recipe) return null

  const currentVersion = recipe.versions?.find((v) => v.is_current) || recipe.versions?.[0]
  const category = recipe.recipe_category_id
    ? recipeCategoriesMap.get(recipe.recipe_category_id)
    : null

  return (
    <div>
      <PageHeader title={recipe.name} description={recipe.description}>
        <Button variant="outline" onClick={() => navigate(`/recipes/${id}/edit`)}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
        {currentVersion && (
          <>
            <Button variant="outline" onClick={() => setScaleOpen(true)}>
              <Scale className="h-4 w-4" /> Scale
            </Button>
            <Button variant="outline" onClick={() => setPrintOpen(true)}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </>
        )}
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </PageHeader>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Badge variant={recipe.is_active ? 'success' : 'outline'}>
          {recipe.is_active ? 'Active' : 'Inactive'}
        </Badge>
        {category && (
          <Badge variant="secondary">{category.name}</Badge>
        )}
        <span className="text-sm text-muted-foreground">
          Base yield: {formatNumber(recipe.default_base_yield_value)}{' '}
          {unitsMap.get(recipe.default_base_yield_unit_id)?.abbreviation}
        </span>
        <span className="text-sm text-muted-foreground">
          Created: {formatDate(recipe.created_at)}
        </span>
      </div>

      {currentVersion ? (
        <Tabs defaultValue="ingredients">
          <TabsList>
            <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="versions">Versions ({recipe.versions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="ingredients">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Ingredients — v{currentVersion.version_number}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentVersion.ingredients.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No ingredients defined</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Ingredient</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentVersion.ingredients
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((ing) => (
                            <TableRow key={ing.recipe_version_ingredient_id}>
                              <TableCell>{ing.sort_order}</TableCell>
                              <TableCell className="font-medium">{ing.ingredient_name}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatNumber(ing.base_amount)}
                              </TableCell>
                              <TableCell>{ing.unit_abbreviation}</TableCell>
                              <TableCell className="text-muted-foreground">{ing.notes || '—'}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="steps">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Steps</CardTitle>
              </CardHeader>
              <CardContent>
                {currentVersion.steps.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No steps defined</p>
                ) : (
                  <div className="space-y-4">
                    {currentVersion.steps
                      .sort((a, b) => a.step_number - b.step_number)
                      .map((step) => (
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
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="versions">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recipe.versions.map((v) => (
                    <div
                      key={v.recipe_version_id}
                      className="flex items-center justify-between p-3 rounded-md border"
                    >
                      <div>
                        <p className="font-medium">
                          Version {v.version_number}
                          {v.title && ` — ${v.title}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Yield: {formatNumber(v.base_yield_value)}{' '}
                          {unitsMap.get(v.base_yield_unit_id)?.abbreviation} |{' '}
                          {v.ingredients.length} ingredients | {v.steps.length} steps
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <RecipeVersionManager recipeId={id} version={v} />
                        {v.is_current && (
                          <Badge variant="default">Current</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <p className="text-muted-foreground">No versions available</p>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Recipe"
        description={`Are you sure you want to delete "${recipe.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />

      {currentVersion && (
        <ScaleCalculator
          open={scaleOpen}
          onOpenChange={setScaleOpen}
          recipeVersionId={currentVersion.recipe_version_id}
        />
      )}

      {/* Print Options Dialog */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Print Recipe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Choose what to include in the printout:
          </p>
          <div className="grid gap-3 py-2">
            <Button
              variant="outline"
              className="justify-start h-12 text-left"
              onClick={() => handlePrint('ingredients')}
            >
              <Printer className="h-4 w-4 mr-3 shrink-0" />
              <div>
                <p className="font-medium">Ingredients Only</p>
                <p className="text-xs text-muted-foreground">Just the ingredient list</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-12 text-left"
              onClick={() => handlePrint('directions')}
            >
              <Printer className="h-4 w-4 mr-3 shrink-0" />
              <div>
                <p className="font-medium">Directions Only</p>
                <p className="text-xs text-muted-foreground">Just the step-by-step instructions</p>
              </div>
            </Button>
            <Button
              className="justify-start h-12 text-left"
              onClick={() => handlePrint('both')}
            >
              <Printer className="h-4 w-4 mr-3 shrink-0" />
              <div>
                <p className="font-medium">Both</p>
                <p className="text-xs text-muted-foreground/80">Ingredients and directions</p>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
