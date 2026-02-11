import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { updateProfile } from '@/api/users'
import { uploadFile, getDownloadUrl } from '@/api/attachments'
import { enrollMfa, confirmMfa } from '@/api/auth'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  LogOut,
  Pencil,
  Camera,
  ShieldCheck,
  Phone,
  MapPin,
} from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { toast } from 'sonner'
import logo from '@/assets/logo.png'

export function Topbar() {
  const { user, logout, fetchUser } = useAuth()
  const photoInputRef = useRef(null)

  const [popoverOpen, setPopoverOpen] = useState(false)

  // Edit profile
  const [editOpen, setEditOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)

  // MFA
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

  function openEditProfile() {
    setPopoverOpen(false)
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

  function openMfaEnroll() {
    setPopoverOpen(false)
    setEnrollOpen(true)
    enrollMutation.mutate()
  }

  return (
    <>
      <header className="flex items-center justify-between border-b bg-card px-4 md:px-6 h-14 no-print">
        <div className="flex items-center gap-2 md:hidden">
          <img src={logo} alt="Beaux's Bistro" className="w-8 h-8 rounded-full object-cover" />
          <span className="font-heading text-lg font-semibold">Beaux&apos;s Bistro</span>
        </div>
        <div className="hidden md:block" />
        <div className="flex items-center gap-3">
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted transition-colors cursor-pointer">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user?.display_name}
                </span>
                <Avatar className="h-8 w-8">
                  {photoUrl && <AvatarImage src={photoUrl} alt={user?.display_name} />}
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              {/* Profile summary */}
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-14 w-14">
                      {photoUrl && <AvatarImage src={photoUrl} alt={user?.display_name} />}
                      <AvatarFallback className="text-lg">{initials}</AvatarFallback>
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
                      className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={photoUploading}
                    >
                      <Camera className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user?.display_name}</p>
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                    <div className="flex gap-1 mt-1">
                      {user?.roles?.map((role) => (
                        <Badge key={role} variant="outline" className="text-[10px] px-1.5 py-0">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {photoUploading && (
                  <p className="text-xs text-muted-foreground mt-1">Uploading photo...</p>
                )}
              </div>

              <Separator />

              {/* Profile details */}
              <div className="px-4 py-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{user?.phone || 'No phone set'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{user?.address || 'No address set'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>
                    MFA{' '}
                    <Badge variant={user?.mfa_enabled ? 'success' : 'outline'} className="text-[10px] px-1.5 py-0">
                      {user?.mfa_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </span>
                </div>
                {user?.last_login_at && (
                  <p className="text-xs text-muted-foreground">
                    Last login: {formatDateTime(user.last_login_at)}
                  </p>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="p-2 space-y-1">
                <button
                  className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                  onClick={openEditProfile}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Profile
                </button>
                {!user?.mfa_enabled && (
                  <button
                    className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    onClick={openMfaEnroll}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Enable MFA
                  </button>
                )}
                <button
                  className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors text-left text-destructive"
                  onClick={() => { setPopoverOpen(false); logout() }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

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
    </>
  )
}
