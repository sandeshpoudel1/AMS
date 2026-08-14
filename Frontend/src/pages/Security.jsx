import { useEffect, useState } from 'react'
import api from '../api'
import SidebarLayout from '../components/SidebarLayout'
import { useAuth } from '../context/AuthContext'

export default function Security() {
  const { user, refreshUser } = useAuth()
  const [setupData, setSetupData] = useState(null)
  const [setupCode, setSetupCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [twoFaApiAvailable, setTwoFaApiAvailable] = useState(true)

  useEffect(() => {
    setSetupData(null)
    setSetupCode('')
    setDisableCode('')
    setPassword('')
  }, [user?.two_factor_enabled])

  const clearFeedback = () => {
    setMessage('')
    setError('')
  }

  const isTwoFaRouteUnavailable = (err) => {
    const status = err?.response?.status
    const msg = String(err?.response?.data?.message || '').toLowerCase()
    return status === 404 && msg.includes('route api/2fa/')
  }

  const handleTwoFaUnavailable = () => {
    setTwoFaApiAvailable(false)
    setSetupData(null)
    setMessage('Security is in preview mode because 2FA endpoints are unavailable on this backend.')
  }

  const beginSetup = async () => {
    setLoading(true)
    clearFeedback()
    try {
      const res = await api.post('/2fa/setup')
      setTwoFaApiAvailable(true)
      setSetupData(res.data?.data || null)
      setMessage('Scan the QR code with Google Authenticator, Microsoft Authenticator, or Authy, then verify with a 6-digit code.')
    } catch (err) {
      if (isTwoFaRouteUnavailable(err)) {
        handleTwoFaUnavailable()
      } else {
        setError(err.response?.data?.message || 'Failed to start 2FA setup')
      }
    } finally {
      setLoading(false)
    }
  }

  const verifySetup = async (e) => {
    e.preventDefault()
    setLoading(true)
    clearFeedback()
    try {
      await api.post('/2fa/setup/verify', { code: setupCode })
      await refreshUser()
      setTwoFaApiAvailable(true)
      setSetupData(null)
      setSetupCode('')
      setMessage('Two-factor authentication enabled successfully.')
    } catch (err) {
      if (isTwoFaRouteUnavailable(err)) {
        handleTwoFaUnavailable()
      } else {
        setError(err.response?.data?.message || 'Failed to verify setup code')
      }
    } finally {
      setLoading(false)
    }
  }

  const disableTwoFactor = async (e) => {
    e.preventDefault()
    setLoading(true)
    clearFeedback()
    try {
      await api.post('/2fa/disable', {
        password,
        code: disableCode,
      })
      await refreshUser()
      setTwoFaApiAvailable(true)
      setDisableCode('')
      setPassword('')
      setMessage('Two-factor authentication has been disabled.')
    } catch (err) {
      if (isTwoFaRouteUnavailable(err)) {
        handleTwoFaUnavailable()
      } else {
        setError(err.response?.data?.message || 'Failed to disable 2FA')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SidebarLayout title="Security">
      <div style={styles.pageWrap}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Login Security</h3>
          <p style={styles.description}>
            Protect your account with password + one-time verification code from your phone.
          </p>
          <div style={styles.statusRow}>
            <span style={styles.statusLabel}>2FA Status:</span>
            <span style={user?.two_factor_enabled ? styles.statusOn : styles.statusOff}>
              {user?.two_factor_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {message && <div style={styles.success}>{message}</div>}
          {error && <div style={styles.error}>{error}</div>}

          {!user?.two_factor_enabled && twoFaApiAvailable && (
            <div style={styles.section}>
              <button style={loading ? styles.btnDisabled : styles.btn} onClick={beginSetup} disabled={loading}>
                {loading ? 'Generating...' : 'Enable 2FA'}
              </button>

              {setupData && (
                <div style={styles.setupArea}>
                  <div style={styles.qrWrap}>
                    <img src={setupData.qr_url} alt="2FA QR" style={styles.qrImage} />
                  </div>
                  <p style={styles.secretLabel}>Manual key (if scan is unavailable)</p>
                  <div style={styles.secretBox}>{setupData.secret}</div>

                  <form onSubmit={verifySetup}>
                    <label style={styles.inputLabel}>Enter 6-digit code from app</label>
                    <input
                      style={styles.input}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="000000"
                      required
                    />
                    <button style={loading ? styles.btnDisabled : styles.btn} type="submit" disabled={loading || setupCode.length !== 6}>
                      {loading ? 'Verifying...' : 'Verify & Activate'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {user?.two_factor_enabled && twoFaApiAvailable && (
            <form onSubmit={disableTwoFactor} style={styles.section}>
              <h4 style={styles.subTitle}>Disable 2FA</h4>
              <p style={styles.description}>
                For security, confirm your password and a current authenticator code.
              </p>
              <label style={styles.inputLabel}>Current Password</label>
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <label style={styles.inputLabel}>Authenticator Code</label>
              <input
                style={styles.input}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                required
              />

              <button
                style={loading ? styles.btnDangerDisabled : styles.btnDanger}
                type="submit"
                disabled={loading || disableCode.length !== 6}
              >
                {loading ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </form>
          )}

          {!twoFaApiAvailable && (
            <div style={styles.section}>
              <p style={styles.description}>
                2FA setup and disable actions are hidden because the backend does not currently provide the required routes.
              </p>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  )
}

const styles = {
  pageWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '6px 0 14px',
  },
  card: {
    width: '100%',
    maxWidth: 640,
    background: '#ffffff',
    border: '1px solid #dce7f7',
    borderRadius: 16,
    boxShadow: '0 16px 30px rgba(20, 55, 100, 0.08)',
    padding: 22,
  },
  cardTitle: {
    margin: '0 0 8px',
    color: '#0f2a4f',
    fontSize: 22,
    fontWeight: 800,
  },
  subTitle: {
    margin: '0 0 8px',
    color: '#0f2a4f',
    fontSize: 18,
    fontWeight: 700,
  },
  description: {
    margin: '0 0 12px',
    color: '#4f6486',
    fontSize: 14,
    lineHeight: 1.4,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  statusLabel: {
    color: '#27466f',
    fontWeight: 700,
    fontSize: 13,
  },
  statusOn: {
    background: '#e8fff1',
    color: '#166534',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: '1px solid #bbf7d0',
  },
  statusOff: {
    background: '#fff4e6',
    color: '#9a3412',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: '1px solid #fed7aa',
  },
  section: {
    marginTop: 14,
    borderTop: '1px solid #edf2fb',
    paddingTop: 14,
  },
  setupArea: {
    marginTop: 14,
    background: '#f8fbff',
    border: '1px solid #d8e6fa',
    borderRadius: 12,
    padding: 14,
  },
  qrWrap: {
    display: 'grid',
    placeItems: 'center',
    paddingBottom: 8,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 10,
    border: '1px solid #cfdaea',
    background: '#fff',
  },
  secretLabel: {
    margin: '8px 0 6px',
    color: '#24426b',
    fontWeight: 700,
    fontSize: 13,
  },
  secretBox: {
    background: '#eef4ff',
    border: '1px solid #c9d8f2',
    borderRadius: 10,
    padding: '10px 12px',
    color: '#1a3f71',
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: '0.04em',
    marginBottom: 14,
  },
  inputLabel: {
    display: 'block',
    color: '#27466f',
    fontWeight: 700,
    fontSize: 13,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #cfdaea',
    borderRadius: 10,
    fontSize: 14,
    color: '#0f2a4f',
    background: '#fff',
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%',
    marginTop: 12,
    padding: '12px',
    background: 'linear-gradient(135deg, #0a3772, #0f4d9d)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
  },
  btnDisabled: {
    width: '100%',
    marginTop: 12,
    padding: '12px',
    background: '#90a3c2',
    color: '#f4f8ff',
    border: 'none',
    borderRadius: 10,
    cursor: 'not-allowed',
    fontSize: 14,
    fontWeight: 800,
  },
  btnDanger: {
    width: '100%',
    marginTop: 12,
    padding: '12px',
    background: 'linear-gradient(135deg, #b91c1c, #dc2626)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
  },
  btnDangerDisabled: {
    width: '100%',
    marginTop: 12,
    padding: '12px',
    background: '#d7a1a1',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'not-allowed',
    fontSize: 14,
    fontWeight: 800,
  },
  success: {
    background: '#ecfdf3',
    border: '1px solid #bbf7d0',
    borderRadius: 10,
    padding: '10px 12px',
    color: '#166534',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 12,
  },
  error: {
    background: '#fff0f1',
    border: '1px solid #fecdd3',
    borderRadius: 10,
    padding: '10px 12px',
    color: '#be123c',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 12,
  },
}
