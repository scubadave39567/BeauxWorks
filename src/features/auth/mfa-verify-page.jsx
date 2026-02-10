import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'

export default function MfaVerifyPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { verifyMfa } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mfaToken = location.state?.mfaToken

  if (!mfaToken) return <Navigate to="/login" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await verifyMfa(mfaToken, code)
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground mb-2">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
