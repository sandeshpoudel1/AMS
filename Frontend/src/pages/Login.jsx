import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/motherland-logo.svg'

export default function Login() {
  const { login, verify2FALogin, pending2FA, cancel2FAChallenge } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const navigateByRole = (loggedInUser) => {
    const role = (loggedInUser?.role || loggedInUser?.role_label || '').toLowerCase().replace(/ /g, '_')
    const target = role === 'candidate_officer'
      ? '/candidates'
      : role === 'finance_officer'
        ? '/finance'
        : '/dashboard'
    navigate(target)
  }

  const handleCredentialSubmit = async (e) => {
    e.preventDefault()
    const email = form.email.trim()
    const password = form.password

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await login(email, password)
      if (result?.requires2FA) {
        setOtpCode('')
        return
      }

      navigateByRole(result?.user)
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const loggedInUser = await verify2FALogin(otpCode)
      navigateByRole(loggedInUser)
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.bgOrbOne} />
      <div style={styles.bgOrbTwo} />
      <div style={styles.card} className="reveal-up">
        <div style={styles.brandBlock}>
          <div style={styles.logoShell}>
            <img src={logo} alt="Motherland logo" style={styles.logoImg} />
          </div>
          <div style={styles.brandTextWrap}>
            <div style={styles.logoText}>Motherland Overseas</div>
            <div style={styles.logoSubText}>Record Management System</div>
          </div>
        </div>
        <h2 style={styles.title}>{pending2FA ? 'Verify Security Code' : 'Welcome Back'}</h2>
        <p style={styles.subtitle}>
          {pending2FA
            ? 'Enter the 6-digit code from your authenticator app to complete login'
            : 'Sign in to continue to your operations workspace'}
        </p>
        {error && <div style={styles.error}>{error}</div>}
        {pending2FA ? (
          <form onSubmit={handleOtpSubmit}>
            <div style={styles.field}>
              <label style={styles.label}>Authenticator Code</label>
              <input
                style={styles.input}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                required
              />
            </div>
            <button style={loading ? styles.btnDisabled : styles.btn} type="submit" disabled={loading || otpCode.length !== 6}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <button
              style={styles.secondaryBtn}
              type="button"
              onClick={() => {
                cancel2FAChallenge()
                setOtpCode('')
                setError('')
              }}
              disabled={loading}
            >
              Use Different Account
            </button>
          </form>
        ) : (
          <form onSubmit={handleCredentialSubmit} noValidate>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                type="email"
                inputMode="email"
                autoComplete="username"
                value={form.email}
                placeholder="Enter your email"
                onChange={e => setForm({ ...form, email: e.target.value.replace(/[|\s]+/g, '').replace(/\.+@/g, '@') })}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                autoComplete="current-password"
                value={form.password}
                placeholder="Enter your password"
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button style={loading ? styles.btnDisabled : styles.btn} type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(130deg, #08274f 0%, #0f4d9d 52%, #1d74d5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Outfit', 'Segoe UI', sans-serif",
  },
  bgOrbOne: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: '50%',
    top: -160,
    right: -100,
    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.26) 0%, rgba(255,255,255,0) 70%)',
  },
  bgOrbTwo: {
    position: 'absolute',
    width: 350,
    height: 350,
    borderRadius: '50%',
    left: -120,
    bottom: -120,
    background: 'radial-gradient(circle, rgba(255, 165, 102, 0.35) 0%, rgba(255, 165, 102, 0) 70%)',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    background: 'rgba(255,255,255,0.94)',
    border: '1px solid rgba(255,255,255,0.7)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: 24,
    padding: '30px 28px',
    boxShadow: '0 25px 50px rgba(5, 26, 56, 0.35)',
    position: 'relative',
    zIndex: 1,
  },
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  logoShell: {
    width: 66,
    height: 66,
    borderRadius: 16,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(145deg, #eaf2ff, #ffffff)',
    border: '1px solid #d6e5fb',
  },
  logoImg: { width: 44, height: 44, objectFit: 'contain' },
  brandTextWrap: { display: 'flex', flexDirection: 'column', gap: 2 },
  logoText: { color: '#0f2a4f', fontSize: 14, fontWeight: 800, lineHeight: 1.2 },
  logoSubText: { color: '#4f6486', fontSize: 12, fontWeight: 600 },
  title: { color: '#0f2a4f', fontSize: 28, fontWeight: 800, margin: '14px 0 4px' },
  subtitle: { color: '#4f6486', fontSize: 14, marginBottom: 22 },
  error: {
    background: '#fff0f1',
    border: '1px solid #fecdd3',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#be123c',
    fontSize: 13,
    marginBottom: 16,
    fontWeight: 600,
  },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#27466f', marginBottom: 6 },
  input: {
    width: '100%',
    padding: '12px 13px',
    border: '1px solid #cfdaea',
    borderRadius: 10,
    fontSize: 14,
    color: '#0f2a4f',
    background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
    boxSizing: 'border-box',
    outline: 'none',
  },
  btn: {
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #0a3772, #0f4d9d 55%, #1c6bd0)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    marginTop: 8,
    boxShadow: '0 14px 28px rgba(15, 77, 157, 0.32)',
  },
  btnDisabled: {
    width: '100%',
    padding: '13px',
    background: '#90a3c2',
    color: '#f4f8ff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'not-allowed',
    marginTop: 8,
  },
  secondaryBtn: {
    width: '100%',
    padding: '11px',
    background: '#eef4ff',
    color: '#1a3f71',
    border: '1px solid #c9d8f2',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 10,
  },
  hint: { color: '#6f87a8', fontSize: 11, textAlign: 'left', marginTop: 8, fontWeight: 600 },
}
