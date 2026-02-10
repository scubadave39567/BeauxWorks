import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getCmsProduct, createCmsProduct, updateCmsProduct } from '@/api/cms'
import { getProducts } from '@/api/products'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { LookupSelect } from '@/components/shared/lookup-select'
import { Switch } from '@/components/ui/switch'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { toast } from 'sonner'

const schema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  slug: z.string().min(1, 'Slug is required'),
  public_name: z.string().min(1, 'Name is required'),
  public_description: z.string().optional(),
  short_description: z.string().optional(),
  display_price: z.coerce.number().optional().nullable(),
  price_label: z.string().optional(),
  availability_status: z.string().default('in_stock'),
  is_published: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
})

export default function CmsEditorPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  })

  // For edit, we need to look up by content ID — but CMS detail uses slug.
  // We'll fetch the list and find it.
  const { data: cmsList = [] } = useQuery({
    queryKey: ['cms-products'],
    queryFn: () => import('@/api/cms').then((m) => m.getCmsProducts()),
    enabled: isEdit,
  })

  const existingItem = cmsList.find((c) => c.website_product_content_id === id)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      product_id: '',
      slug: '',
      public_name: '',
      public_description: '',
      short_description: '',
      display_price: '',
      price_label: '',
      availability_status: 'in_stock',
      is_published: false,
      is_featured: false,
      meta_title: '',
      meta_description: '',
    },
  })

  useEffect(() => {
    if (existingItem && isEdit) {
      reset({
        product_id: existingItem.product_id || '',
        slug: existingItem.slug || '',
        public_name: existingItem.public_name || '',
        public_description: existingItem.public_description || '',
        short_description: existingItem.short_description || '',
        display_price: existingItem.display_price ?? '',
        price_label: existingItem.price_label || '',
        availability_status: existingItem.availability_status || 'in_stock',
        is_published: true,
        is_featured: existingItem.is_featured || false,
        meta_title: existingItem.meta_title || '',
        meta_description: existingItem.meta_description || '',
      })
    }
  }, [existingItem, isEdit, reset])

  const mutation = useMutation({
    mutationFn: (data) => {
      const cleaned = { ...data }
      if (!cleaned.public_description) cleaned.public_description = null
      if (!cleaned.short_description) cleaned.short_description = null
      if (cleaned.display_price === '' || cleaned.display_price == null) cleaned.display_price = null
      if (!cleaned.price_label) cleaned.price_label = null
      if (!cleaned.meta_title) cleaned.meta_title = null
      if (!cleaned.meta_description) cleaned.meta_description = null
      return isEdit ? updateCmsProduct(id, cleaned) : createCmsProduct(cleaned)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Listing updated' : 'Listing created')
      queryClient.invalidateQueries({ queryKey: ['cms-products'] })
      navigate('/cms')
    },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit CMS Listing' : 'New CMS Listing'}
        description={isEdit ? `Editing ${existingItem?.public_name || ''}` : 'Create a public product listing'}
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <LookupSelect
                  items={products}
                  valueField="product_id"
                  labelField="name"
                  placeholder="Select product..."
                  {...register('product_id')}
                />
                {errors.product_id && (
                  <p className="text-sm text-destructive">{errors.product_id.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>URL Slug</Label>
                <Input {...register('slug')} placeholder="e.g. signature-hot-sauce" />
                {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Public Name</Label>
              <Input {...register('public_name')} placeholder="Display name for customers" />
              {errors.public_name && (
                <p className="text-sm text-destructive">{errors.public_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Short Description</Label>
              <Input {...register('short_description')} placeholder="Brief tagline" />
            </div>

            <div className="space-y-2">
              <Label>Full Description</Label>
              <Textarea
                {...register('public_description')}
                placeholder="Detailed product description for the public page"
                className="min-h-[120px]"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Display Price</Label>
                <Input type="number" step="0.01" {...register('display_price')} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Price Label</Label>
                <Input {...register('price_label')} placeholder="e.g. per bottle" />
              </div>
              <div className="space-y-2">
                <Label>Availability</Label>
                <select
                  {...register('availability_status')}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="in_stock">In Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="pre_order">Pre-Order</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={watch('is_published')}
                  onCheckedChange={(v) => setValue('is_published', v)}
                />
                <Label>Published</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={watch('is_featured')}
                  onCheckedChange={(v) => setValue('is_featured', v)}
                />
                <Label>Featured</Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta Title (SEO)</Label>
                <Input {...register('meta_title')} placeholder="Page title for search engines" />
              </div>
              <div className="space-y-2">
                <Label>Meta Description (SEO)</Label>
                <Input {...register('meta_description')} placeholder="Search result snippet" />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : isEdit ? 'Update Listing' : 'Create Listing'}
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
