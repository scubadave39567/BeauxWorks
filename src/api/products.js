import api from '@/config/api'

export async function getProducts() {
  const { data } = await api.get('/products')
  return data
}

export async function getProduct(productId) {
  const { data } = await api.get(`/products/${productId}`)
  return data
}

export async function createProduct(payload) {
  const { data } = await api.post('/products', payload)
  return data
}

export async function updateProduct(productId, payload) {
  const { data } = await api.patch(`/products/${productId}`, payload)
  return data
}

export async function deleteProduct(productId) {
  await api.delete(`/products/${productId}`)
}
