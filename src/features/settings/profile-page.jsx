import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { updateProfile } from '@/api/users'
import { uploadFile, getDownloadUrl } from '@/api/attachments'
import { enrollMfa, confirmMfa } from '@/api/auth'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { RecipeCategoriesManager } from './recipe-categories-manager'
import { ShieldCheck, User, Camera, Pencil, Phone, MapPin } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { toast } from 'sonner'
import { useRef } from 'react'

export default function ProfilePage() {
  const { user, fetchUser } = useAuth()
  const queryClient = useQueryClient()
  const photoInputRef = useRef(null)

  // Profile editing
  const [editOpen, setEditOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)

  // MFA enrollment
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollData, setEnrollData] = useState(null)
  const [confirmCode, setConfirmCode] = useState('')

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      toast.success('Profile updated')
      fetchUser()
      setEditOpen(false)
    },
    onError: () => toast.error('Failed to update profile'),
  })

  const enrollMutation = useMutation({
    mutationFn: enrollMfa,
    onSuccess: (data) => setEnrollData(data),
    onError: () => toast.error('Failed to start MFA enrollment'),
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmMfa(confirmCode),
    onSuccess: () => {
      toast.success('MFA enabled successfully!')
      setEnrollOpen(false)
      setEnrollData(null)
      setConfirmCode('')
    },
    onError: () => toast.error('Invalid code, try again'),
  })

  function openEditProfile() {
    setDisplayName(user?.display_name || '')
    setPhone(user?.phone || '')
    setAddress(user?.address || '')
    setEditOpen(true)
  }

  function handleSaveProfile() {
    profileMutation.mutate({
      display_name: displayName,
      phone: phone || null,
      address: address || null,
    })
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const result = await uploadFile(file)
      await updateProfile({ profile_photo_attachment_id: result.attachment_id })
      await fetchUser()
      toast.success('Profile photo updated')
    } catch {
      toast.error('Failed to upload photo')
    } finally {
      setPhotoUploading(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const initials = user?.display_name
    ? user.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  const photoUrl = user?.profile_photo_attachment_id
    ? getDownloadUrl(user.profile_photo_attachment_id)
    : null

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <div className="space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" /> Profile
              </CardTitle>
              <Button variant="outline" size="sm" onClick={openEditProfile}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Photo */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    {photoUrl && <AvatarImage src={photoUrl} alt={user?.display_name} />}
                    <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <button
                    type="button"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                {photoUploading && (
                  <span className="text-xs text-muted-foreground">Uploading...</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Display Name</p>
                  <p className="font-medium">{user?.display_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p>{user?.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> Phone
                  </p>
                  <p>{user?.phone || <span className="text-muted-foreground italic">Not set</span>}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> Address
                  </p>
                  <p>{user?.address || <span className="text-muted-foreground italic">Not set</span>}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Roles</p>
                  <div className="flex gap-1 mt-1">
                    {user?.roles?.map((role) => (
                      <Badge key={role} variant="outline">{role}</Badge>
                    ))}
                    {(!user?.roles || user.roles.length === 0) && <span>—</span>}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Login</p>
                  <p>{formatDateTime(user?.last_login_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Account Status</p>
                  <Badge variant={user?.is_active ? 'success' : 'destructive'}>
                    {user?.is_active ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MFA Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Two-Factor Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  MFA is{' '}
                  <Badge variant={user?.mfa_enabled ? 'success' : 'outline'}>
                    {user?.mfa_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {user?.mfa_enabled
                    ? 'Your account is protected with two-factor authentication'
                    : 'Add an extra layer of security to your account'}
                </p>
              </div>
              {!user?.mfa_enabled && (
                <Button
                  onClick={() => {
                    setEnrollOpen(true)
                    enrollMutation.mutate()
                  }}
                >
                  Enable MFA
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recipe Categories */}
        <RecipeCategoriesManager />
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Display Name</Label>
              <Input
                id="edit-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, city, state, zip"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={!displayName.trim() || profileMutation.isPending}>
              {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MFA Enrollment Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
          </DialogHeader>

          {enrollMutation.isPending && <p className="text-sm">Loading...</p>}

          {enrollData && (
            <div className="space-y-4">
              <div>
                <p className="text-sm mb-2">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
                </p>
                <div className="bg-white p-4 rounded-md inline-block">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(enrollData.qr_uri)}`}
                    alt="MFA QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Or enter this secret manually:
                </p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {enrollData.secret}
                </code>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-2">Recovery codes (save these!):</p>
                <div className="grid grid-cols-2 gap-1">
                  {enrollData.recovery_codes?.map((code, i) => (
                    <code key={i} className="text-xs bg-muted p-1 rounded text-center font-mono">
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Confirm with a code from your app:</Label>
                <Input
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center font-mono text-lg"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEnrollOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmCode.length !== 6 || confirmMutation.isPending}
                >
                  {confirmMutation.isPending ? 'Verifying...' : 'Confirm & Enable'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
