import api from '@/config/api'

export async function getCmsProducts() {
  const { data } = await api.get('/cms/products')
  return data
}

export async function getCmsProduct(slug) {
  const { data } = await api.get(`/cms/products/${slug}`)
  return data
}

export async function createCmsProduct(payload) {
  const { data } = await api.post('/cms/admin/products', payload)
  return data
}

export async function updateCmsProduct(contentId, payload) {
  const { data } = await api.patch(`/cms/admin/products/${contentId}`, payload)
  return data
}

export async function deleteCmsProduct(contentId) {
  await api.delete(`/cms/admin/products/${contentId}`)
}
