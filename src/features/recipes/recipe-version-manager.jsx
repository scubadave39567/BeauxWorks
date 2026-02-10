import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Lock, Unlock, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

export function RecipeVersionManager({ recipeId, version }) {
  const queryClient = useQueryClient()
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [retireOpen, setRetireOpen] = useState(false)

  const releaseMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/recipes/${recipeId}/versions/${version.recipe_version_id}/release`)
      return data
    },
    onSuccess: () => {
      toast.success('Version released')
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] })
      setReleaseOpen(false)
    },
    onError: (e) => toast.error(e.message || 'Failed to release'),
  })

  const retireMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/recipes/${recipeId}/versions/${version.recipe_version_id}/retire`)
      return data
    },
    onSuccess: () => {
      toast.success('Version retired')
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] })
      setRetireOpen(false)
    },
    onError: (e) => toast.error(e.message || 'Failed to retire'),
  })

  const statusVariant = {
    Draft: 'secondary',
    Released: 'success',
    Retired: 'outline',
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={statusVariant[version.status] || 'outline'}>
        {version.status}
      </Badge>
      {version.status === 'Draft' && (
        <Button size="sm" variant="outline" onClick={() => setReleaseOpen(true)}>
          <Lock className="h-3 w-3" /> Release
        </Button>
      )}
      {version.status === 'Released' && (
        <Button size="sm" variant="outline" onClick={() => setRetireOpen(true)}>
          <Archive className="h-3 w-3" /> Retire
        </Button>
      )}

      <ConfirmDialog
        open={releaseOpen}
        onOpenChange={setReleaseOpen}
        title="Release Version"
        description="Once released, this version cannot be edited. It can then be used to create production runs."
        confirmLabel="Release"
        onConfirm={() => releaseMutation.mutate()}
        loading={releaseMutation.isPending}
      />
      <ConfirmDialog
        open={retireOpen}
        onOpenChange={setRetireOpen}
        title="Retire Version"
        description="Retiring this version will prevent it from being used in new production runs."
        confirmLabel="Retire"
        onConfirm={() => retireMutation.mutate()}
        loading={retireMutation.isPending}
      />
    </div>
  )
}
