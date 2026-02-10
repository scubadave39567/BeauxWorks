import api from '@/config/api'

export async function getSales({ productId, skip = 0, limit = 50 } = {}) {
  const params = { skip, limit }
  if (productId) params.product_id = productId
  const { data } = await api.get('/sales', { params })
  return data
}

export async function createSale(payload) {
  const { data } = await api.post('/sales', payload)
  return data
}

export async function getSalesSummary(productId) {
  const params = {}
  if (productId) params.product_id = productId
  const { data } = await api.get('/sales/summary', { params })
  return data
}
