import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

export function AuthGuard({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />

  return children
}
