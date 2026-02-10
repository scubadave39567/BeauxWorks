import api from '@/config/api'

export async function getMe() {
  const { data } = await api.get('/users/me')
  return data
}

export async function updateProfile(payload) {
  const { data } = await api.patch('/users/me', payload)
  return data
}
