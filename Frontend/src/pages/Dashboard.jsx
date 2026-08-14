import { useEffect, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const parseRows = (responseData) => {
    const payload = responseData?.data
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.users)) return payload.users
    if (Array.isArray(payload?.candidates)) return payload.candidates
    if (Array.isArray(payload?.entries)) return payload.entries
    if (Array.isArray(payload?.staff)) return payload.staff
    if (Array.isArray(payload?.data)) return payload.data
    return []
  }

  const toNumber = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const buildFallbackStats = async () => {
    const [usersResult, candidatesResult, payrollResult, daybookResult] = await Promise.allSettled([
      api.get('/users', { params: { per_page: 500, page: 1 } }),
      api.get('/candidates', { params: { per_page: 500, page: 1 } }),
      api.get('/payroll?per_page=500&page=1'),
      api.get('/daybook', { params: { per_page: 500, page: 1 } }).catch(async (err) => {
        const status = err?.response?.status
        if (status === 404 || status === 405) {
          return api.get('/day-book', { params: { per_page: 500, page: 1 } })
        }
        throw err
      }),
    ])

    const usersRows = usersResult.status === 'fulfilled' ? parseRows(usersResult.value?.data) : []
    const candidateRows = candidatesResult.status === 'fulfilled' ? parseRows(candidatesResult.value?.data) : []
    const payrollRows = payrollResult.status === 'fulfilled' ? parseRows(payrollResult.value?.data) : []
    const daybookRows = daybookResult.status === 'fulfilled' ? parseRows(daybookResult.value?.data) : []
    const daybookSummaryPayload = daybookResult.status === 'fulfilled'
      ? (daybookResult.value?.data?.data?.summary || daybookResult.value?.data?.data || {})
      : {}

    const usersByRoleMap = usersRows.reduce((acc, userRow) => {
      const role = String(userRow.role || 'unknown')
      acc[role] = (acc[role] || 0) + 1
      return acc
    }, {})

    const usersByRole = Object.entries(usersByRoleMap).map(([role, count]) => ({
      role,
      role_label: role.replaceAll('_', ' '),
      count,
    }))

    const activeUsers = usersRows.filter((userRow) => {
      if (typeof userRow.is_active === 'boolean') return userRow.is_active
      return String(userRow.status || '').toLowerCase() === 'active'
    }).length

    const deployedCandidates = candidateRows.filter((candidate) => String(candidate.status || '').toLowerCase() === 'deployed').length
    const certifiedCandidates = candidateRows.filter((candidate) => String(candidate.status || '').toLowerCase() === 'certified').length

    const normalizedPayroll = payrollRows.map((row) => {
      const grossAmount = toNumber(row.gross_amount ?? row.salary_amount)
      const totalDeductions = toNumber(row.total_deductions ?? row.tax_deduction)
      const netAmount = toNumber(row.net_amount ?? (grossAmount - totalDeductions) ?? row.salary_amount)
      const amountPaid = toNumber(row.amount_paid ?? row.paid_amount ?? row.paid)
      return {
        ...row,
        gross_amount: grossAmount,
        net_amount: netAmount,
        amount_paid: amountPaid,
      }
    })

    const activeCertificates = normalizedPayroll.filter((row) => row.amount_paid > 0).length

    const totalPayrollNet = normalizedPayroll.reduce((sum, row) => sum + row.net_amount, 0)
    const totalPayrollPaid = normalizedPayroll.reduce((sum, row) => sum + row.amount_paid, 0)
    const totalPayrollDue = normalizedPayroll.reduce((sum, row) => sum + Math.max(row.net_amount - row.amount_paid, 0), 0)

    const computedDaybookReceipts = daybookRows
      .filter((row) => String(row.type || '').toLowerCase() === 'receipt')
      .reduce((sum, row) => sum + toNumber(row.amount), 0)
    const computedDaybookPayments = daybookRows
      .filter((row) => String(row.type || '').toLowerCase() === 'payment')
      .reduce((sum, row) => sum + toNumber(row.amount), 0)

    const totalDaybookReceipts = toNumber(
      daybookSummaryPayload.total_receipt
      ?? daybookSummaryPayload.total_received
      ?? daybookSummaryPayload.total_receipts
      ?? computedDaybookReceipts
    )
    const totalDaybookPayments = toNumber(
      daybookSummaryPayload.total_payment
      ?? daybookSummaryPayload.total_payments
      ?? computedDaybookPayments
    )
    const daybookBalance = toNumber(
      daybookSummaryPayload.closing_balance
      ?? daybookSummaryPayload.net_balance
      ?? (totalDaybookReceipts - totalDaybookPayments)
    )

    return {
      users: {
        total: usersRows.length,
        active: activeUsers,
        by_role: usersByRole,
      },
      candidates: {
        total: candidateRows.length,
        deployed: deployedCandidates,
        certified: certifiedCandidates,
      },
      assessments: {
        total: 0,
        pass_rate: 0,
      },
      certificates: {
        active: activeCertificates,
      },
      deployments: {
        total: deployedCandidates,
      },
      finance_summary: {
        daybook_receipts: totalDaybookReceipts,
        daybook_payments: totalDaybookPayments,
        daybook_balance: daybookBalance,
        payroll_net: totalPayrollNet,
        payroll_paid: totalPayrollPaid,
        payroll_due: totalPayrollDue,
      },
      recent_activities: [],
    }
  }

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const [statsResult, healthResult] = await Promise.allSettled([
          api.get('/dashboard/stats'),
          api.get('/dashboard/health'),
        ])

        if (!mounted) return

        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value?.data?.data ?? null)
          setError('')
          setInfo('')
        } else {
          const fallbackStats = await buildFallbackStats()
          if (!mounted) return
          const hasFallbackData =
            (fallbackStats?.users?.total || 0) > 0
            || (fallbackStats?.candidates?.total || 0) > 0
            || (fallbackStats?.deployments?.total || 0) > 0

          setStats(fallbackStats)
          setError('')
          setInfo(
            hasFallbackData
              ? 'Dashboard is in preview mode. Live totals are shown from available modules.'
              : 'Dashboard data is unavailable in this backend build. Other modules can still be used.'
          )
        }

        setHealth(healthResult.status === 'fulfilled' ? (healthResult.value?.data?.data ?? null) : null)
      } catch (err) {
        if (!mounted) return
        setStats(null)
        setHealth(null)
        setError('Dashboard data is unavailable in this backend build. Other modules can still be used.')
        setInfo('')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const statCards = stats ? [
    { label: 'Total Users', value: stats.users.total, color: '#0f4d9d', icon: '👥' },
    { label: 'Active Users', value: stats.users.active, color: '#059669', icon: '✅' },
    { label: 'Total Candidates', value: stats.candidates.total, color: '#f97316', icon: '🧑‍💼' },
    { label: 'Deployed', value: stats.candidates.deployed, color: '#2563eb', icon: '✈️' },
    { label: 'Certified', value: stats.candidates.certified, color: '#0ea5e9', icon: '🎓' },
    { label: 'Assessments', value: stats.assessments.total, color: '#dc2626', icon: '📝' },
    { label: 'Pass Rate', value: stats.assessments.pass_rate + '%', color: '#16a34a', icon: '🏆' },
    { label: 'Certificates', value: stats.certificates.active, color: '#f59e0b', icon: '📜' },
    { label: 'Deployments', value: stats.deployments.total, color: '#0284c7', icon: '🌍' },
  ] : []

  return (
    <SidebarLayout
      title="Dashboard"
      headerExtra={
        health ? (
          <span style={health.database === 'connected' ? styles.badgeGreen : styles.badgeRed}>
            DB: {health.database} | PHP {health.version.php} | Laravel {health.version.laravel}
          </span>
        ) : null
      }
    >
      <div className="reveal-up" style={styles.wrapper}>
        {loading ? (
          <div style={styles.loading}>Loading stats...</div>
        ) : (
          <>
            {info && <div style={styles.infoBanner}>{info}</div>}
            {error && <div style={styles.errorBanner}>{error}</div>}
            <div style={styles.grid}>
              {statCards.map((c) => (
                <div key={c.label} style={{ ...styles.card, borderTop: `4px solid ${c.color}` }}>
                  <div style={styles.cardIconWrap}>
                    <div style={{ ...styles.cardIconBubble, background: `${c.color}18`, color: c.color }}>{c.icon}</div>
                  </div>
                  <div style={styles.cardValue}>{c.value}</div>
                  <div style={styles.cardLabel}>{c.label}</div>
                </div>
              ))}
            </div>

            {stats?.finance_summary && (
              <div style={styles.financePanel}>
                <h3 style={styles.panelTitle}>Quick Finance Summary</h3>
                <div style={styles.financeGrid}>
                  <div style={styles.financeCard}>
                    <div style={styles.financeLabel}>Daybook Receipts</div>
                    <div style={styles.financeValueGreen}>NPR Rs {toNumber(stats.finance_summary.daybook_receipts).toLocaleString()}</div>
                  </div>
                  <div style={styles.financeCard}>
                    <div style={styles.financeLabel}>Daybook Payments</div>
                    <div style={styles.financeValueRed}>NPR Rs {toNumber(stats.finance_summary.daybook_payments).toLocaleString()}</div>
                  </div>
                  <div style={styles.financeCard}>
                    <div style={styles.financeLabel}>Daybook Balance</div>
                    <div style={toNumber(stats.finance_summary.daybook_balance) >= 0 ? styles.financeValueGreen : styles.financeValueRed}>
                      NPR Rs {toNumber(stats.finance_summary.daybook_balance).toLocaleString()}
                    </div>
                  </div>
                  <div style={styles.financeCard}>
                    <div style={styles.financeLabel}>Payroll Net</div>
                    <div style={styles.financeValue}>NPR Rs {toNumber(stats.finance_summary.payroll_net).toLocaleString()}</div>
                  </div>
                  <div style={styles.financeCard}>
                    <div style={styles.financeLabel}>Payroll Paid</div>
                    <div style={styles.financeValueGreen}>NPR Rs {toNumber(stats.finance_summary.payroll_paid).toLocaleString()}</div>
                  </div>
                  <div style={styles.financeCard}>
                    <div style={styles.financeLabel}>Payroll Due</div>
                    <div style={styles.financeValueRed}>NPR Rs {toNumber(stats.finance_summary.payroll_due).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            <div style={styles.row}>
              <div style={styles.panel}>
                <h3 style={styles.panelTitle}>Recent Activity</h3>
                {stats?.recent_activities?.length === 0 && <p style={styles.empty}>No recent activity</p>}
                {stats?.recent_activities?.map((a) => (
                  <div key={a.id} style={styles.activityItem}>
                    <div style={styles.activityDot} />
                    <div>
                      <div style={styles.activityAction}>{a.action}</div>
                      <div style={styles.activityMeta}>{a.user?.name} · {a.module} · {a.time_ago}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.panel}>
                <h3 style={styles.panelTitle}>Users by Role</h3>
                {stats?.users?.by_role?.length === 0 && <p style={styles.empty}>No data</p>}
                {stats?.users?.by_role?.map((r) => (
                  <div key={r.role} style={styles.roleItem}>
                    <span style={styles.roleLabel}>{r.role_label}</span>
                    <span style={styles.roleCount}>{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  )
}

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 22 },
  badgeGreen: {
    background: '#dcfce7',
    color: '#166534',
    border: '1px solid #86efac',
    padding: '5px 13px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  badgeRed: {
    background: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    padding: '5px 13px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  loading: {
    textAlign: 'center',
    color: '#526686',
    padding: 80,
    fontSize: 16,
    borderRadius: 18,
    border: '1px solid #d8e1ee',
    background: 'rgba(255,255,255,0.75)',
  },
  errorBanner: {
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#9f1239',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 12,
  },
  infoBanner: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1e3a8a',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 12,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 },
  financePanel: {
    background: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 18,
    border: '1px solid #dce5f2',
    padding: 20,
    boxShadow: '0 12px 25px rgba(17, 34, 64, 0.07)',
    marginBottom: 16,
  },
  financeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
  },
  financeCard: {
    border: '1px solid #dbe5f3',
    borderRadius: 12,
    background: '#f8fbff',
    padding: 12,
  },
  financeLabel: {
    fontSize: 11,
    color: '#4f6486',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 700,
    marginBottom: 6,
  },
  financeValue: { fontSize: 18, fontWeight: 800, color: '#0f2a4f' },
  financeValueGreen: { fontSize: 18, fontWeight: 800, color: '#166534' },
  financeValueRed: { fontSize: 18, fontWeight: 800, color: '#9f1239' },
  card: {
    background: 'linear-gradient(165deg, rgba(255,255,255,0.94), rgba(250,253,255,0.88))',
    border: '1px solid #dde6f3',
    borderRadius: 18,
    padding: 18,
    boxShadow: '0 14px 24px rgba(17, 34, 64, 0.08)',
  },
  cardIconWrap: { marginBottom: 10 },
  cardIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    fontSize: 22,
    border: '1px solid rgba(15,77,157,0.12)',
  },
  cardValue: { fontSize: 30, fontWeight: 800, color: '#0f2a4f', lineHeight: 1.1 },
  cardLabel: { fontSize: 12, color: '#4f6486', marginTop: 6, fontWeight: 600, letterSpacing: '0.02em' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  panel: {
    background: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 18,
    border: '1px solid #dce5f2',
    padding: 20,
    boxShadow: '0 12px 25px rgba(17, 34, 64, 0.07)',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0f2a4f',
    marginTop: 0,
    marginBottom: 16,
    borderBottom: '1px solid #e7eef8',
    paddingBottom: 10,
    letterSpacing: '0.01em',
  },
  empty: { color: '#6c84a6', fontSize: 13, fontWeight: 500 },
  activityItem: { display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  activityDot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    background: 'linear-gradient(180deg, #3b82f6, #0f4d9d)',
    marginTop: 5,
    flexShrink: 0,
  },
  activityAction: { fontSize: 13, fontWeight: 700, color: '#173864' },
  activityMeta: { fontSize: 11, color: '#6881a4', marginTop: 2 },
  roleItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #edf3fb',
  },
  roleLabel: { fontSize: 13, color: '#27466f', fontWeight: 600 },
  roleCount: {
    background: '#e8f1ff',
    color: '#114388',
    border: '1px solid #cfe1fb',
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 800,
  },
}
