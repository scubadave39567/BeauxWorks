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
