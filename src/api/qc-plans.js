import api from '@/config/api'

export async function getQcPlans() {
  const { data } = await api.get('/qc-plans')
  return data
}

export async function getQcPlan(planId) {
  const { data } = await api.get(`/qc-plans/${planId}`)
  return data
}

export async function createQcPlan(payload) {
  const { data } = await api.post('/qc-plans', payload)
  return data
}

export async function updateQcPlan(planId, payload) {
  const { data } = await api.put(`/qc-plans/${planId}`, payload)
  return data
}

export async function deleteQcPlan(planId) {
  const { data } = await api.delete(`/qc-plans/${planId}`)
  return data
}

export async function createQcPlanRequirement(planId, payload) {
  const { data } = await api.post(`/qc-plans/${planId}/requirements`, payload)
  return data
}

export async function deleteQcPlanRequirement(planId, reqId) {
  const { data } = await api.delete(`/qc-plans/${planId}/requirements/${reqId}`)
  return data
}
