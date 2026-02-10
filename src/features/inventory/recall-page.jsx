import { useState } from 'react'
import { recallByProductLot, recallByIngredientLot } from '@/api/inventory'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { toast } from 'sonner'
import { Search } from 'lucide-react'

export default function RecallPage() {
  const [productLot, setProductLot] = useState('')
  const [ingredientLot, setIngredientLot] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function searchProduct() {
    if (!productLot.trim()) return
    setLoading(true)
    try {
      const data = await recallByProductLot(productLot.trim())
      setResult(data)
    } catch {
      toast.error('Lot not found')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  async function searchIngredient() {
    if (!ingredientLot.trim()) return
    setLoading(true)
    try {
      const data = await recallByIngredientLot(ingredientLot.trim())
      setResult(data)
    } catch {
      toast.error('Lot not found')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Recall Tracing"
        description="Trace ingredient lots to finished products or vice versa"
      />

      <Tabs defaultValue="product">
        <TabsList>
          <TabsTrigger value="product">By Product Lot</TabsTrigger>
          <TabsTrigger value="ingredient">By Ingredient Lot</TabsTrigger>
        </TabsList>

        <TabsContent value="product">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Product Lot Code</Label>
                  <Input
                    value={productLot}
                    onChange={(e) => setProductLot(e.target.value)}
                    placeholder="Enter product lot code..."
                    onKeyDown={(e) => e.key === 'Enter' && searchProduct()}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={searchProduct} disabled={loading}>
                    <Search className="h-4 w-4" /> Trace
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingredient">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Ingredient Lot Number</Label>
                  <Input
                    value={ingredientLot}
                    onChange={(e) => setIngredientLot(e.target.value)}
                    placeholder="Enter ingredient lot number..."
                    onKeyDown={(e) => e.key === 'Enter' && searchIngredient()}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={searchIngredient} disabled={loading}>
                    <Search className="h-4 w-4" /> Trace
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {loading && <LoadingSpinner />}

      {result && !loading && (
        <div className="mt-6 space-y-4">
          {result.affected_runs?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Affected Production Runs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.affected_runs.map((run, i) => (
                    <div key={i} className="p-3 rounded-md border text-sm">
                      <pre className="whitespace-pre-wrap font-mono text-xs">
                        {JSON.stringify(run, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.affected_product_lots?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Affected Product Lots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.affected_product_lots.map((lot, i) => (
                    <div key={i} className="p-3 rounded-md border text-sm">
                      <pre className="whitespace-pre-wrap font-mono text-xs">
                        {JSON.stringify(lot, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.distribution_records?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribution Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.distribution_records.map((rec, i) => (
                    <div key={i} className="p-3 rounded-md border text-sm">
                      <pre className="whitespace-pre-wrap font-mono text-xs">
                        {JSON.stringify(rec, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!result.affected_runs?.length &&
            !result.affected_product_lots?.length &&
            !result.distribution_records?.length && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No trace data found for this lot code
                </CardContent>
              </Card>
            )}
        </div>
      )}
    </div>
  )
}
