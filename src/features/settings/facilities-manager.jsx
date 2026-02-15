import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFacilities, createFacility, updateFacility, deleteFacility } from '@/api/lookups'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function FacilitiesManager() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [address, setAddress] = useState('')

  const { data: facilities = [] } = useQuery({
    queryKey: ['lookups', 'facilities'],
    queryFn: getFacilities,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lookups', 'facilities'] })

  const createMutation = useMutation({
    mutationFn: createFacility,
    onSuccess: () => { toast.success('Facility created'); invalidate(); closeForm() },
    onError: () => toast.error('Failed to create facility'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateFacility(id, payload),
    onSuccess: () => { toast.success('Facility updated'); invalidate(); closeForm() },
    onError: () => toast.error('Failed to update facility'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteFacility,
    onSuccess: () => { toast.success('Facility deleted'); invalidate(); setDeleteOpen(false) },
    onError: () => toast.error('Failed to delete facility'),
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setCode('')
    setAddress('')
    setFormOpen(true)
  }

  function openEdit(fac) {
    setEditing(fac)
    setName(fac.name)
    setCode(fac.code || '')
    setAddress(fac.address || '')
    setFormOpen(true)
  }

  function closeForm() { setFormOpen(false); setEditing(null) }

  function handleSave() {
    const payload = { name, code: code || null, address: address || null }
    if (editing) updateMutation.mutate({ id: editing.facility_id, payload })
    else createMutation.mutate(payload)
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Facilities
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {facilities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No facilities defined yet.</p>
        ) : (
          <div className="space-y-2">
            {facilities.map((fac) => (
              <div key={fac.facility_id} className="flex items-center justify-between p-3 rounded-md border">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-sm">
                      {fac.name}
                      {fac.code && <span className="ml-2 text-xs text-muted-foreground font-mono">({fac.code})</span>}
                    </p>
                    {fac.address && <p className="text-xs text-muted-foreground">{fac.address}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={fac.is_active ? 'success' : 'outline'} className="mr-2">
                    {fac.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(fac)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingId(fac.facility_id); setDeleteOpen(true) }}>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Facility' : 'New Facility'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Kitchen" />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. MK (optional)" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
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
        title="Delete Facility"
        description="Are you sure you want to delete this facility?"
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate(deletingId)}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
