import api from '@/config/api'

export async function getRecipes() {
  const { data } = await api.get('/recipes')
  return data
}

export async function getRecipe(recipeId) {
  const { data } = await api.get(`/recipes/${recipeId}`)
  return data
}

export async function createRecipe(payload) {
  const { data } = await api.post('/recipes', payload)
  return data
}

export async function updateRecipe(recipeId, payload) {
  const { data } = await api.patch(`/recipes/${recipeId}`, payload)
  return data
}

export async function deleteRecipe(recipeId) {
  await api.delete(`/recipes/${recipeId}`)
}

export async function scaleRecipe(payload) {
  const { data } = await api.post('/recipes/scale', payload)
  return data
}

// Version CRUD
export async function createVersion(recipeId, payload) {
  const { data } = await api.post(`/recipes/${recipeId}/versions`, payload)
  return data
}

// Ingredient CRUD
export async function addIngredient(recipeId, versionId, payload) {
  const { data } = await api.post(`/recipes/${recipeId}/versions/${versionId}/ingredients`, payload)
  return data
}

export async function updateIngredient(recipeId, versionId, ingredientId, payload) {
  const { data } = await api.patch(`/recipes/${recipeId}/versions/${versionId}/ingredients/${ingredientId}`, payload)
  return data
}

export async function deleteIngredient(recipeId, versionId, ingredientId) {
  await api.delete(`/recipes/${recipeId}/versions/${versionId}/ingredients/${ingredientId}`)
}

// Step CRUD
export async function addStep(recipeId, versionId, payload) {
  const { data } = await api.post(`/recipes/${recipeId}/versions/${versionId}/steps`, payload)
  return data
}

export async function updateStep(recipeId, versionId, stepId, payload) {
  const { data } = await api.patch(`/recipes/${recipeId}/versions/${versionId}/steps/${stepId}`, payload)
  return data
}

export async function deleteStep(recipeId, versionId, stepId) {
  await api.delete(`/recipes/${recipeId}/versions/${versionId}/steps/${stepId}`)
}
