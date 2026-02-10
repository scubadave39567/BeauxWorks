import api from '@/config/api'

export async function previewScale(recipeVersionId, payload) {
  const { data } = await api.post(`/recipes/${recipeVersionId}/scale/preview`, payload)
  return data
}

export async function applyScale(runId, payload) {
  const { data } = await api.post(`/runs/${runId}/scale/apply`, payload)
  return data
}

export async function getPrintData(runId) {
  const { data } = await api.get(`/runs/${runId}/scale/print`)
  return data
}
