import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { getDownloadUrl } from '@/api/attachments'
import logo from '@/assets/logo.png'

export function Topbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
    <header className="flex items-center justify-between border-b bg-card px-4 md:px-6 h-14 no-print">
      <div className="flex items-center gap-2 md:hidden">
        <img src={logo} alt="Beaux's Bistro" className="w-8 h-8 rounded-full object-cover" />
        <span className="font-heading text-lg font-semibold">Beaux&apos;s Bistro</span>
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted transition-colors cursor-pointer"
        >
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user?.display_name}
          </span>
          <Avatar className="h-8 w-8">
            {photoUrl && <AvatarImage src={photoUrl} alt={user?.display_name} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </button>
        <Button variant="ghost" size="icon" onClick={logout} className="h-9 w-9">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
