import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getProducts } from '@/api/products'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/data-table'
import { SearchInput } from '@/components/shared/search-input'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Plus, ShoppingCart } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { productCategoriesMap, productTypesMap } = useLookups()

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  })

  const columns = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">{row.original.sku || '—'}</span>
      ),
    },
    {
      accessorKey: 'product_type_id',
      header: 'Type',
      cell: ({ row }) => productTypesMap.get(row.original.product_type_id)?.name || '—',
    },
    {
      accessorKey: 'default_price',
      header: 'Price',
      cell: ({ row }) => formatCurrency(row.original.default_price),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'success' : 'outline'}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader title="Products" description="Manage your product catalog">
        <Button onClick={() => navigate('/products/new')}>
          <Plus className="h-4 w-4" />
          New Product
        </Button>
      </PageHeader>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products..." />
      </div>

      <DataTable
        columns={columns}
        data={products}
        searchKey="name"
        searchValue={search}
        onRowClick={(row) => navigate(`/products/${row.product_id}`)}
        renderCard={(product) => (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku || 'No SKU'} | {productTypesMap.get(product.product_type_id)?.name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-medium">{formatCurrency(product.default_price)}</p>
                  <Badge variant={product.is_active ? 'success' : 'outline'} className="mt-1">
                    {product.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      />
    </div>
  )
}
