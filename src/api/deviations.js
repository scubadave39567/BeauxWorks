import api from '@/config/api'

export async function getDeviations(runId) {
  const { data } = await api.get(`/runs/${runId}/deviations`)
  return data
}

export async function createDeviation(runId, payload) {
  const { data } = await api.post(`/runs/${runId}/deviations`, payload)
  return data
}

export async function closeDeviation(deviationId) {
  const { data } = await api.post(`/deviations/${deviationId}/close`)
  return data
}
