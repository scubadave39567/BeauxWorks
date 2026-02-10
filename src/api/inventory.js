import api from '@/config/api'

export async function getInventoryStatus() {
  const { data } = await api.get('/inventory/status')
  return data
}

export async function getTransactions({ ingredientId, skip = 0, limit = 50 } = {}) {
  const params = { skip, limit }
  if (ingredientId) params.ingredient_id = ingredientId
  const { data } = await api.get('/inventory/transactions', { params })
  return data
}

export async function createTransaction(payload) {
  const { data } = await api.post('/inventory/transactions', payload)
  return data
}

export async function recallByProductLot(lotCode) {
  const { data } = await api.get(`/inventory/recall/by-product-lot/${encodeURIComponent(lotCode)}`)
  return data
}

export async function recallByIngredientLot(lotNumber) {
  const { data } = await api.get(`/inventory/recall/by-ingredient-lot/${encodeURIComponent(lotNumber)}`)
  return data
}
