import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { uploadFile } from '@/api/attachments'
import { toast } from 'sonner'

export function FileUpload({ onUploaded, facilityId }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function handleChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadFile(file, facilityId)
      onUploaded?.(result)
      toast.success('File uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange} />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <Upload className="h-4 w-4" />
        {uploading ? 'Uploading...' : 'Upload File'}
      </Button>
    </div>
  )
}
