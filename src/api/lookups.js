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

export async function getIngredients() {
  const { data } = await api.get('/lookups/ingredients')
  return data
}

export async function getIngredientsAll() {
  const { data } = await api.get('/lookups/ingredients', { params: { include_inactive: true } })
  return data
}

export async function createIngredient(payload) {
  const { data } = await api.post('/lookups/ingredients', payload)
  return data
}

export async function updateIngredient(ingredientId, payload) {
  const { data } = await api.patch(`/lookups/ingredients/${ingredientId}`, payload)
  return data
}

export async function deleteIngredient(ingredientId) {
  await api.delete(`/lookups/ingredients/${ingredientId}`)
}

// Item Types
export async function getItemTypes() {
  const { data } = await api.get('/lookups/item-types')
  return data
}

export async function createItemType(payload) {
  const { data } = await api.post('/lookups/item-types', payload)
  return data
}

export async function updateItemType(id, payload) {
  const { data } = await api.patch(`/lookups/item-types/${id}`, payload)
  return data
}

export async function deleteItemType(id) {
  await api.delete(`/lookups/item-types/${id}`)
}

// Ingredient Categories
export async function getIngredientCategories() {
  const { data } = await api.get('/lookups/ingredient-categories')
  return data
}

export async function createIngredientCategory(payload) {
  const { data } = await api.post('/lookups/ingredient-categories', payload)
  return data
}

export async function updateIngredientCategory(id, payload) {
  const { data } = await api.patch(`/lookups/ingredient-categories/${id}`, payload)
  return data
}

export async function deleteIngredientCategory(id) {
  await api.delete(`/lookups/ingredient-categories/${id}`)
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
