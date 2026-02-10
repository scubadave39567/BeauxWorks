import api from '@/config/api'

export async function getProductionRuns(skip = 0, limit = 50) {
  const { data } = await api.get('/production-runs', { params: { skip, limit } })
  return data
}

export async function getProductionRun(runId) {
  const { data } = await api.get(`/production-runs/${runId}`)
  return data
}

export async function createProductionRun(payload) {
  const { data } = await api.post('/production-runs', payload)
  return data
}

export async function updateProductionRun(runId, payload) {
  const { data } = await api.patch(`/production-runs/${runId}`, payload)
  return data
}

export async function deleteProductionRun(runId) {
  await api.delete(`/production-runs/${runId}`)
}

export async function getQualityLogs(runId) {
  const { data } = await api.get(`/production-runs/${runId}/quality-logs`)
  return data
}

export async function createQualityLog(runId, payload) {
  const { data } = await api.post(`/production-runs/${runId}/quality-logs`, payload)
  return data
}

export async function createDeviation(runId, payload) {
  const { data } = await api.post(`/production-runs/${runId}/deviations`, payload)
  return data
}

export async function scanCode(codeValue) {
  const { data } = await api.get(`/production-runs/scan/${encodeURIComponent(codeValue)}`)
  return data
}

export async function getBatchRecord(runId) {
  const { data } = await api.get(`/production-runs/${runId}/batch-record`)
  return data
}
