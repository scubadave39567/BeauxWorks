import api from '@/config/api'

export async function getQcRequirements(runId) {
  const { data } = await api.get(`/runs/${runId}/qc/requirements`)
  return data
}

export async function createQcEntry(runId, payload) {
  const { data } = await api.post(`/runs/${runId}/qc/entries`, payload)
  return data
}

export async function amendQcEntry(runId, entryId, payload) {
  const { data } = await api.post(`/runs/${runId}/qc/entries/${entryId}/amend`, payload)
  return data
}
