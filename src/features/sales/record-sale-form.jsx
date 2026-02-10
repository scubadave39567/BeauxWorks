import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSale } from '@/api/sales'
import { getProducts } from '@/api/products'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { LookupSelect } from '@/components/shared/lookup-select'
import { UnitSelect } from '@/components/shared/unit-select'
import { toast } from 'sonner'

const schema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  facility_id: z.string().min(1, 'Facility is required'),
  sales_channel_id: z.string().min(1, 'Channel is required'),
  sale_date: z.string().min(1, 'Date is required'),
  quantity: z.coerce.number().positive('Must be positive'),
  unit_id: z.string().min(1, 'Unit is required'),
  unit_price: z.coerce.number().positive('Must be positive'),
  customer_name: z.string().optional(),
  notes: z.string().optional(),
})

export default function RecordSaleForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { facilities, salesChannels, units } = useLookups()

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      product_id: '',
      facility_id: '',
      sales_channel_id: '',
      sale_date: new Date().toISOString().slice(0, 16),
      quantity: '',
      unit_id: '',
      unit_price: '',
      customer_name: '',
      notes: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data) =>
      createSale({
        ...data,
        customer_name: data.customer_name || null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      toast.success('Sale recorded')
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['sales-summary'] })
      navigate('/sales')
    },
    onError: () => toast.error('Failed to record sale'),
  })

  return (
    <div>
      <PageHeader title="Record Sale" description="Log a new sales transaction" />

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
                <Label>Sales Channel</Label>
                <LookupSelect
                  items={salesChannels}
                  valueField="sales_channel_id"
                  labelField="name"
                  placeholder="Select channel..."
                  {...register('sales_channel_id')}
                />
                {errors.sales_channel_id && (
                  <p className="text-sm text-destructive">{errors.sales_channel_id.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Facility</Label>
                <LookupSelect
                  items={facilities}
                  valueField="facility_id"
                  labelField="name"
                  placeholder="Select facility..."
                  {...register('facility_id')}
                />
                {errors.facility_id && (
                  <p className="text-sm text-destructive">{errors.facility_id.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Sale Date</Label>
                <Input type="datetime-local" {...register('sale_date')} />
                {errors.sale_date && (
                  <p className="text-sm text-destructive">{errors.sale_date.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" step="any" {...register('quantity')} placeholder="e.g. 10" />
                {errors.quantity && (
                  <p className="text-sm text-destructive">{errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <UnitSelect units={units} {...register('unit_id')} />
                {errors.unit_id && (
                  <p className="text-sm text-destructive">{errors.unit_id.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Unit Price</Label>
                <Input type="number" step="0.01" {...register('unit_price')} placeholder="0.00" />
                {errors.unit_price && (
                  <p className="text-sm text-destructive">{errors.unit_price.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input {...register('customer_name')} placeholder="Optional" />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea {...register('notes')} placeholder="Optional notes" />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Recording...' : 'Record Sale'}
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
