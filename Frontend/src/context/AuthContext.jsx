import { createContext, useContext, useState } from 'react'
import api from '../api'

const AuthContext = createContext(null)

const isMissingRouteError = (err) => {
  const status = err?.response?.status
  const message = String(err?.response?.data?.message || '')
  return status === 404 || message.includes('could not be found')
}

const tryRequestWithFallback = async (primary, fallback) => {
  try {
    return await primary()
  } catch (err) {
    if (!isMissingRouteError(err) || !fallback) {
      throw err
    }
    return await fallback()
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [pending2FA, setPending2FA] = useState(null)

  const login = async (email, password) => {
    const res = await tryRequestWithFallback(
      () => api.post('/auth/login', { email, password }),
      () => api.post('/login', { email, password })
    )
    const payload = res.data?.data || {}

    if (payload.requires_2fa) {
      setPending2FA({
        challengeToken: payload.challenge_token,
        user: payload.user,
      })
      return { requires2FA: true, user: payload.user }
    }

    const { token, user: userData } = payload
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    setPending2FA(null)
    return { requires2FA: false, user: userData }
  }

  const verify2FALogin = async (code) => {
    if (!pending2FA?.challengeToken) {
      throw new Error('Two-factor challenge is missing. Please login again.')
    }

    const res = await tryRequestWithFallback(
      () => api.post('/auth/login/2fa/verify', {
        challenge_token: pending2FA.challengeToken,
        code,
      }),
      () => api.post('/login/2fa/verify', {
        challenge_token: pending2FA.challengeToken,
        code,
      })
    )

    const { token, user: userData } = res.data.data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    setPending2FA(null)
    return userData
  }

  const refreshUser = async () => {
    const res = await tryRequestWithFallback(
      () => api.get('/auth/me'),
      () => api.get('/user')
    )
    const userData = res.data?.data?.user || res.data?.data || res.data
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
    }
    return userData
  }

  const cancel2FAChallenge = () => {
    setPending2FA(null)
  }

  const logout = async () => {
    try {
      await tryRequestWithFallback(
        () => api.post('/auth/logout'),
        () => api.post('/logout')
      )
    } catch {}
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setPending2FA(null)
  }

  return (
    <AuthContext.Provider value={{ user, pending2FA, login, verify2FALogin, refreshUser, cancel2FAChallenge, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
