import axios from 'axios'

const isElectronRuntime =
  typeof window !== 'undefined' &&
  window.location.protocol === 'file:'

// Prefer one shared endpoint across all devices/runtimes.
const sharedBaseURL = import.meta.env.VITE_API_BASE_URL || ''
const electronBaseURL = import.meta.env.VITE_ELECTRON_API_BASE_URL || 'http://localhost:8000/api'
const webBaseURL = '/api'
const baseURL = sharedBaseURL || (isElectronRuntime ? electronBaseURL : webBaseURL)

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const requestUrl = String(err.config?.url || '')
    const isAuthFlowRequest = requestUrl.includes('/login') || requestUrl.includes('/forgot-password') || requestUrl.includes('/reset-password')

    if (err.response?.status === 401 && !isAuthFlowRequest) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (isElectronRuntime) {
        window.location.hash = '#/login'
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
