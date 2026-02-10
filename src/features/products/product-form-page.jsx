import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getProduct, createProduct, updateProduct } from '@/api/products'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { LookupSelect } from '@/components/shared/lookup-select'
import { UnitSelect } from '@/components/shared/unit-select'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { toast } from 'sonner'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  product_type_id: z.string().min(1, 'Type is required'),
  product_category_id: z.string().optional(),
  sku: z.string().optional(),
  default_price: z.coerce.number().optional().nullable(),
  default_unit_id: z.string().optional(),
})

export default function ProductFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { productTypes, productCategories, units } = useLookups()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
    enabled: isEdit,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      product_type_id: '',
      product_category_id: '',
      sku: '',
      default_price: '',
      default_unit_id: '',
    },
  })

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        description: product.description || '',
        product_type_id: product.product_type_id || '',
        product_category_id: product.product_category_id || '',
        sku: product.sku || '',
        default_price: product.default_price ?? '',
        default_unit_id: product.default_unit_id || '',
      })
    }
  }, [product, reset])

  const mutation = useMutation({
    mutationFn: (data) => {
      const cleaned = { ...data }
      if (!cleaned.product_category_id) cleaned.product_category_id = null
      if (!cleaned.sku) cleaned.sku = null
      if (cleaned.default_price === '' || cleaned.default_price == null) cleaned.default_price = null
      if (!cleaned.default_unit_id) cleaned.default_unit_id = null
      if (!cleaned.description) cleaned.description = null
      return isEdit ? updateProduct(id, cleaned) : createProduct(cleaned)
    },
    onSuccess: (result) => {
      toast.success(isEdit ? 'Product updated' : 'Product created')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['product', id] })
        navigate(`/products/${id}`)
      } else {
        navigate(`/products/${result.id}`)
      }
    },
    onError: () => toast.error('Failed to save product'),
  })

  if (isEdit && isLoading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Product' : 'New Product'}
        description={isEdit ? `Editing ${product?.name}` : 'Add a new product to the catalog'}
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} placeholder="Product name" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} placeholder="Optional description" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Type</Label>
                <LookupSelect
                  items={productTypes}
                  valueField="product_type_id"
                  labelField="name"
                  placeholder="Select type..."
                  {...register('product_type_id')}
                />
                {errors.product_type_id && (
                  <p className="text-sm text-destructive">{errors.product_type_id.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <LookupSelect
                  items={productCategories}
                  valueField="product_category_id"
                  labelField="name"
                  placeholder="Select category..."
                  {...register('product_category_id')}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input {...register('sku')} placeholder="e.g. HS-001" />
              </div>
              <div className="space-y-2">
                <Label>Default Price</Label>
                <Input type="number" step="0.01" {...register('default_price')} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Default Unit</Label>
                <UnitSelect units={units} {...register('default_unit_id')} />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
