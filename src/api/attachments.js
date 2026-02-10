import api from '@/config/api'

export async function uploadFile(file, facilityId) {
  const formData = new FormData()
  formData.append('file', file)
  const params = {}
  if (facilityId) params.facility_id = facilityId
  const { data } = await api.post('/attachments/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params,
  })
  return data
}

export function getDownloadUrl(attachmentId) {
  return `/api/v1/attachments/${attachmentId}/download`
}

export async function linkAttachment(attachmentId, payload) {
  const { data } = await api.post(`/attachments/${attachmentId}/link`, payload)
  return data
}
