import api from '@/config/api'

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

export async function verifyMfa(mfa_token, code) {
  const { data } = await api.post('/auth/verify-mfa', { mfa_token, code })
  return data
}

export async function refresh(refresh_token) {
  const { data } = await api.post('/auth/refresh', { refresh_token })
  return data
}

export async function logout(refresh_token) {
  await api.post('/auth/logout', { refresh_token })
}

export async function enrollMfa() {
  const { data } = await api.post('/auth/mfa/enroll')
  return data
}

export async function confirmMfa(code) {
  const { data } = await api.post('/auth/mfa/confirm', { code })
  return data
}
