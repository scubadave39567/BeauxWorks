import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMaterials, generateMaterials, consumeRemaining } from '@/api/run-materials'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ConsumeDialog } from './consume-dialog'
import { PackagePlus, CheckCircle2 } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function MaterialsPanel({ runId, runStatus }) {
  const queryClient = useQueryClient()
  const [consumeOpen, setConsumeOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState(null)

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['run-materials', runId],
    queryFn: () => getMaterials(runId),
  })

  const generateMutation = useMutation({
    mutationFn: () => generateMaterials(runId),
    onSuccess: () => {
      toast.success('Materials plan generated')
      queryClient.invalidateQueries({ queryKey: ['run-materials', runId] })
    },
    onError: (e) => toast.error(e.message || 'Failed to generate'),
  })

  const consumeRemainingMutation = useMutation({
    mutationFn: (materialId) => consumeRemaining(runId, materialId),
    onSuccess: () => {
      toast.success('Remaining consumed')
      queryClient.invalidateQueries({ queryKey: ['run-materials', runId] })
    },
    onError: (e) => toast.error(e.message || 'Failed'),
  })

  if (isLoading) return <LoadingSpinner />

  const isInProgress = runStatus === 'InProgress'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Materials</CardTitle>
        {isInProgress && materials.length === 0 && (
          <Button size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            <PackagePlus className="h-4 w-4" /> Generate Plan
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">No materials plan generated yet</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Consumed</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Status</TableHead>
                    {isInProgress && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((m) => (
                    <TableRow key={m.run_material_id}>
                      <TableCell className="font-medium">{m.item_name}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(m.planned)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(m.consumed)}</TableCell>
                      <TableCell className={cn('text-right font-mono', m.remaining > 0 && 'text-amber-600')}>
                        {formatNumber(m.remaining)}
                      </TableCell>
                      <TableCell>
                        {m.remaining <= 0 ? (
                          <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      {isInProgress && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="min-h-[44px]"
                              onClick={() => { setSelectedMaterial(m); setConsumeOpen(true) }}>
                              Consume
                            </Button>
                            {m.remaining > 0 && (
                              <Button size="sm" variant="secondary" className="min-h-[44px]"
                                onClick={() => consumeRemainingMutation.mutate(m.run_material_id)}
                                disabled={consumeRemainingMutation.isPending}>
                                All
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {materials.map((m) => (
                <div key={m.run_material_id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium">{m.item_name}</p>
                    {m.remaining <= 0 ? (
                      <Badge variant="success">Done</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                    <div><p className="text-muted-foreground text-xs">Planned</p><p className="font-mono">{formatNumber(m.planned)}</p></div>
                    <div><p className="text-muted-foreground text-xs">Consumed</p><p className="font-mono">{formatNumber(m.consumed)}</p></div>
                    <div><p className="text-muted-foreground text-xs">Remaining</p><p className={cn('font-mono', m.remaining > 0 && 'text-amber-600')}>{formatNumber(m.remaining)}</p></div>
                  </div>
                  {isInProgress && m.remaining > 0 && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 min-h-[44px]"
                        onClick={() => { setSelectedMaterial(m); setConsumeOpen(true) }}>
                        Consume
                      </Button>
                      <Button size="sm" variant="secondary" className="flex-1 min-h-[44px]"
                        onClick={() => consumeRemainingMutation.mutate(m.run_material_id)}>
                        Consume All
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      <ConsumeDialog
        open={consumeOpen}
        onOpenChange={setConsumeOpen}
        runId={runId}
        material={selectedMaterial}
      />
    </Card>
  )
}
