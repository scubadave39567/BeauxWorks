import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCmsProducts, deleteCmsProduct } from '@/api/cms'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/data-table'
import { SearchInput } from '@/components/shared/search-input'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Plus, FileText, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { toast } from 'sonner'

export default function CmsPage() {
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['cms-products'],
    queryFn: getCmsProducts,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCmsProduct(id),
    onSuccess: () => {
      toast.success('Content deleted')
      queryClient.invalidateQueries({ queryKey: ['cms-products'] })
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete'),
  })

  const columns = [
    {
      accessorKey: 'public_name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.public_name}</span>,
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
      cell: ({ row }) => <span className="font-mono text-muted-foreground">{row.original.slug}</span>,
    },
    {
      accessorKey: 'availability_status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.availability_status === 'in_stock' ? 'success' : 'outline'}>
          {row.original.availability_status}
        </Badge>
      ),
    },
    {
      accessorKey: 'display_price',
      header: 'Price',
      cell: ({ row }) => formatCurrency(row.original.display_price),
    },
    {
      accessorKey: 'is_featured',
      header: 'Featured',
      cell: ({ row }) =>
        row.original.is_featured ? <Badge variant="warning">Featured</Badge> : '—',
    },
  ]

  if (isLoading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader title="CMS" description="Manage public product listings">
        <Button onClick={() => navigate('/cms/new')}>
          <Plus className="h-4 w-4" />
          New Listing
        </Button>
      </PageHeader>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search listings..." />
      </div>

      <DataTable
        columns={columns}
        data={products}
        searchKey="public_name"
        searchValue={search}
        onRowClick={(row) => navigate(`/cms/${row.website_product_content_id}/edit`)}
        renderCard={(item) => (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{item.public_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">/{item.slug}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono">{formatCurrency(item.display_price)}</p>
                  <Badge
                    variant={item.availability_status === 'in_stock' ? 'success' : 'outline'}
                    className="mt-1"
                  >
                    {item.availability_status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete CMS Listing"
        description="This will remove the public listing."
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate(deleteTarget)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
