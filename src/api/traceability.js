import api from '@/config/api'

export async function traceByLot(lotId) {
  const { data } = await api.get('/traceability/by-lot', { params: { lot_id: lotId } })
  return data
}

export async function traceByRun(runId) {
  const { data } = await api.get('/traceability/by-run', { params: { run_id: runId } })
  return data
}
