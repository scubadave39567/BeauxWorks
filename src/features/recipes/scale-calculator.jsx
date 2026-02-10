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

export function ScaleCalculator({ open, onOpenChange, recipeVersionId }) {
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
            <p className="text-sm text-muted-foreground mb-2">
              Scale factor: <strong>{formatNumber(result.scale_factor, 4)}x</strong>
            </p>
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
