import { createContext, useState, useCallback, useEffect } from 'react'
import { getMe } from '@/api/users'
import * as authApi from '@/api/auth'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/storage'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const me = await getMe()
      setUser(me)
    } catch {
      setUser(null)
      clearTokens()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (getAccessToken()) {
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [fetchUser])

  const login = useCallback(async (email, password) => {
    const result = await authApi.login(email, password)
    if (result.mfa_required) {
      return result // { mfa_required: true, mfa_token }
    }
    setTokens(result.access_token, result.refresh_token)
    await fetchUser()
    return result
  }, [fetchUser])

  const verifyMfa = useCallback(async (mfaToken, code) => {
    const result = await authApi.verifyMfa(mfaToken, code)
    setTokens(result.access_token, result.refresh_token)
    await fetchUser()
    return result
  }, [fetchUser])

  const logout = useCallback(async () => {
    try {
      const rt = getRefreshToken()
      if (rt) await authApi.logout(rt)
    } catch {
      // ignore logout errors
    } finally {
      clearTokens()
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyMfa, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}
