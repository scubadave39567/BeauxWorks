import api from '@/config/api'

export async function getUnits() {
  const { data } = await api.get('/lookups/units')
  return data
}

export async function getFacilities() {
  const { data } = await api.get('/lookups/facilities')
  return data
}

export async function getRunStatuses() {
  const { data } = await api.get('/lookups/run-statuses')
  return data
}

export async function getSalesChannels() {
  const { data } = await api.get('/lookups/sales-channels')
  return data
}

export async function getRecipeCategories() {
  const { data } = await api.get('/lookups/recipe-categories')
  return data
}

export async function getProductCategories() {
  const { data } = await api.get('/lookups/product-categories')
  return data
}

export async function getProductTypes() {
  const { data } = await api.get('/lookups/product-types')
  return data
}

export async function getQualityMetricTypes() {
  const { data } = await api.get('/lookups/quality-metric-types')
  return data
}

export async function createRecipeCategory(payload) {
  const { data } = await api.post('/lookups/recipe-categories', payload)
  return data
}

export async function updateRecipeCategory(categoryId, payload) {
  const { data } = await api.patch(`/lookups/recipe-categories/${categoryId}`, payload)
  return data
}

export async function deleteRecipeCategory(categoryId) {
  await api.delete(`/lookups/recipe-categories/${categoryId}`)
}
