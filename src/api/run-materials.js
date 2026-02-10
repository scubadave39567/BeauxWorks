import api from '@/config/api'

export async function getMaterials(runId) {
  const { data } = await api.get(`/runs/${runId}/materials`)
  return data
}

export async function generateMaterials(runId) {
  const { data } = await api.post(`/runs/${runId}/materials/generate`)
  return data
}

export async function consumeMaterial(runId, materialId, payload) {
  const { data } = await api.post(`/runs/${runId}/materials/${materialId}/consume`, payload)
  return data
}

export async function consumeRemaining(runId, materialId, payload = {}) {
  const { data } = await api.post(`/runs/${runId}/materials/${materialId}/consume-remaining`, payload)
  return data
}
