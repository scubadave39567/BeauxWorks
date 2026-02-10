import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProduct, deleteProduct } from '@/api/products'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from 'sonner'

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { productTypesMap, productCategoriesMap, unitsMap } = useLookups()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: () => {
      toast.success('Product deleted')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      navigate('/products')
    },
    onError: () => toast.error('Failed to delete product'),
  })

  if (isLoading) return <LoadingSpinner />
  if (!product) return null

  return (
    <div>
      <PageHeader title={product.name} description={product.description}>
        <Button variant="outline" onClick={() => navigate(`/products/${id}/edit`)}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">SKU</p>
              <p className="font-mono font-medium">{product.sku || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p>{productTypesMap.get(product.product_type_id)?.name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Category</p>
              <p>{productCategoriesMap.get(product.product_category_id)?.name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Default Price</p>
              <p className="font-mono">{formatCurrency(product.default_price)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Default Unit</p>
              <p>{unitsMap.get(product.default_unit_id)?.name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant={product.is_active ? 'success' : 'outline'}>
                {product.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p>{formatDate(product.created_at)}</p>
            </div>
            {product.description && (
              <div className="col-span-full">
                <p className="text-muted-foreground">Description</p>
                <p>{product.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Product"
        description={`Are you sure you want to delete "${product.name}"?`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
