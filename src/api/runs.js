import api from '@/config/api'

export async function getRuns({ facilityId, status, skip = 0, limit = 50 } = {}) {
  const params = { skip, limit }
  if (facilityId) params.facility_id = facilityId
  if (status) params.status = status
  const { data } = await api.get('/runs', { params })
  return data
}

export async function getRun(runId) {
  const { data } = await api.get(`/runs/${runId}`)
  return data
}

export async function createRun(payload) {
  const { data } = await api.post('/runs', payload)
  return data
}

export async function transitionRunStatus(runId, payload) {
  const { data } = await api.post(`/runs/${runId}/status`, payload)
  return data
}
