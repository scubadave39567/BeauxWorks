import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { scaleRecipe } from '@/api/recipes'
import { useLookups } from '@/hooks/use-lookups'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UnitSelect } from '@/components/shared/unit-select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { toast } from 'sonner'
import { formatNumber } from '@/lib/format'
import { Printer } from 'lucide-react'

export function ScaleCalculator({ open, onOpenChange, recipeVersionId, recipe, version, unitsMap, recipeCategoriesMap }) {
  const { units } = useLookups()
  const [targetYield, setTargetYield] = useState('')
  const [targetUnit, setTargetUnit] = useState('')

  const { mutate: scale, data: result, isPending } = useMutation({
    mutationFn: () =>
      scaleRecipe({
        recipe_version_id: recipeVersionId,
        target_yield_value: parseFloat(targetYield),
        target_yield_unit_id: targetUnit,
      }),
    onError: () => toast.error('Failed to scale recipe'),
  })

  function handlePrintScaled() {
    if (!result || !recipe || !version) return

    const category = recipe.recipe_category_id
      ? recipeCategoriesMap?.get(recipe.recipe_category_id)
      : null

    const targetUnitAbbr = unitsMap?.get(targetUnit)?.abbreviation || ''

    const ingredients = result.ingredients
      .map(
        (ing) =>
          `<tr><td style="padding:4px 8px;text-align:right;font-family:monospace">${formatNumber(ing.scaled_amount_rounded)}</td><td style="padding:4px 8px">${ing.unit_abbreviation}</td><td style="padding:4px 8px;font-weight:600">${ing.ingredient_name}</td></tr>`
      )
      .join('')

    const steps = version.steps
      .sort((a, b) => a.step_number - b.step_number)
      .map(
        (step) =>
          `<div style="margin-bottom:12px;display:flex;gap:12px"><div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#C67D2F;color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px">${step.step_number}</div><div><p style="margin:0">${step.instruction}</p>${step.critical_control_point ? '<p style="margin:4px 0 0;color:#B84233;font-size:12px;font-weight:600">&#9888; Critical Control Point</p>' : ''}${step.notes ? `<p style="margin:4px 0 0;color:#666;font-size:12px">${step.notes}</p>` : ''}</div></div>`
      )
      .join('')

    const body = `
      <div style="font-family:'Source Sans 3',sans-serif;max-width:700px;margin:0 auto;padding:20px">
        <h1 style="font-family:'Playfair Display',serif;margin:0 0 4px">${recipe.name}</h1>
        ${category ? `<p style="margin:0 0 4px;color:#7A9A6D;font-weight:600">${category.name}</p>` : ''}
        ${recipe.description ? `<p style="margin:0 0 8px;color:#666">${recipe.description}</p>` : ''}
        <p style="margin:0 0 4px;font-size:14px;color:#3D2B1F">
          <strong>Scaled Yield:</strong> ${formatNumber(parseFloat(targetYield))} ${targetUnitAbbr}
          &nbsp;&bull;&nbsp; <strong>Scale Factor:</strong> ${formatNumber(result.scale_factor, 4)}x
          &nbsp;&bull;&nbsp; <strong>Version:</strong> ${version.version_number}
        </p>
        <hr style="border:none;border-top:1px solid #E8DDD0;margin:16px 0">
        <h2 style="font-family:'Playfair Display',serif;margin:0 0 8px">Ingredients (Scaled)</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="border-bottom:2px solid #E8DDD0"><th style="text-align:right;padding:4px 8px">Amount</th><th style="text-align:left;padding:4px 8px">Unit</th><th style="text-align:left;padding:4px 8px">Ingredient</th></tr></thead>
          <tbody>${ingredients}</tbody>
        </table>
        ${steps.length > 0 ? `
        <hr style="border:none;border-top:1px solid #E8DDD0;margin:16px 0">
        <h2 style="font-family:'Playfair Display',serif;margin:0 0 12px">Directions</h2>
        ${steps}
        ` : ''}
        <hr style="border:none;border-top:1px solid #E8DDD0;margin:24px 0 8px">
        <p style="font-size:11px;color:#999;text-align:center">Beaux's Bistro — Production Manager</p>
      </div>
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${recipe.name} — Scaled Recipe</title><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet"></head><body>${body}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scale Recipe</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Target Yield</Label>
            <Input
              type="number"
              step="any"
              value={targetYield}
              onChange={(e) => setTargetYield(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <UnitSelect
              units={units}
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={() => scale()} disabled={!targetYield || !targetUnit || isPending}>
            {isPending ? 'Calculating...' : 'Calculate'}
          </Button>
        </DialogFooter>

        {result && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                Scale factor: <strong>{formatNumber(result.scale_factor, 4)}x</strong>
              </p>
              <Button variant="outline" size="sm" onClick={handlePrintScaled}>
                <Printer className="h-4 w-4" /> Print Scaled
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Scaled</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.ingredients.map((ing, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{ing.ingredient_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(ing.base_amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatNumber(ing.scaled_amount_rounded)}
                      </TableCell>
                      <TableCell>{ing.unit_abbreviation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
