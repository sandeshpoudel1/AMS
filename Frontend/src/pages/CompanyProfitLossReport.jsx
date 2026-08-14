import { useEffect, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const currency = (value) => `NPR Rs ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CompanyProfitLossReport() {
  const [profitReport, setProfitReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const handlePrintExport = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print()
    }
  }

  useEffect(() => {
    const loadProfitOverview = async () => {
      try {
        setLoading(true)
        const res = await api.get('/reports/overall')
        setProfitReport(res?.data?.data || null)
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load company profit and loss report.')
      } finally {
        setLoading(false)
      }
    }

    loadProfitOverview()
  }, [])

  const periodReports = profitReport?.period_reports || {}
  const monthlyBreakdown = Array.isArray(profitReport?.monthly_profit_loss)
    ? [...profitReport.monthly_profit_loss].reverse()
    : []
  const totalIncome = monthlyBreakdown.reduce((sum, row) => sum + Number(row?.income || 0), 0)
  const totalExpense = monthlyBreakdown.reduce((sum, row) => sum + Number(row?.expense || 0), 0)
  const totalProfitLoss = monthlyBreakdown.reduce((sum, row) => sum + Number(row?.profit_loss || 0), 0)
  const compactPeriods = [
    ['Weekly', periodReports?.weekly],
    ['Yearly', periodReports?.yearly],
  ]

  const renderPeriodCard = (label, report = {}) => {
    const value = Number(report?.profit_loss || 0)
    const income = Number(report?.total_income || 0)
    const expenses = Number(report?.total_expenses || 0)
    const balance = income - expenses
    const isPositive = value >= 0

    return (
      <div style={styles.periodCard} key={label}>
        <div style={styles.periodLabel}>{label}</div>
        <div style={{ ...styles.periodValue, color: isPositive ? '#065f46' : '#b91c1c' }}>{currency(value)}</div>

        <div style={styles.detailList}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Income</span>
            <span style={styles.detailValue}>{currency(income)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Expenses</span>
            <span style={styles.detailValue}>{currency(expenses)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Balance</span>
            <span style={{ ...styles.detailValue, color: balance >= 0 ? '#065f46' : '#b91c1c' }}>{currency(balance)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <SidebarLayout title="Company Profit and Loss">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .company-profit-loss-report-print-area,
          .company-profit-loss-report-print-area * {
            visibility: visible;
          }
          .company-profit-loss-report-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .company-profit-loss-report-no-print {
            display: none !important;
          }
        }
      `}</style>

      <div style={styles.container} className="reveal-up company-profit-loss-report-print-area">
        <div style={styles.headerRow} className="company-profit-loss-report-no-print">
          <h2 style={styles.heading}>Company Profit and Loss</h2>
          <button type="button" style={styles.printButton} onClick={handlePrintExport}>Print / Export</button>
        </div>

        {error ? (
          <div style={styles.error}>{error}</div>
        ) : loading ? (
          <div style={styles.loading}>Loading company profit and loss summary...</div>
        ) : (
          <>
            <div style={styles.grid}>
              {renderPeriodCard('Daily', periodReports?.daily)}
              {renderPeriodCard('Weekly', periodReports?.weekly)}
              {renderPeriodCard('Monthly', periodReports?.monthly)}
            </div>

            <div style={styles.compactWrapper}>
              <div style={styles.tableTitle}>Quick Weekly & Yearly Summary</div>
              <div style={styles.compactGrid}>
                {compactPeriods.map(([label, report]) => {
                  const totalValue = Number(report?.profit_loss || 0)
                  const income = Number(report?.total_income || 0)
                  const expenses = Number(report?.total_expenses || 0)
                  const balance = income - expenses

                  return (
                    <div style={styles.compactCard} key={label}>
                      <div style={styles.compactLabel}>{label}</div>
                      <div style={{ ...styles.compactValue, color: totalValue >= 0 ? '#065f46' : '#b91c1c' }}>{currency(totalValue)}</div>
                      <div style={styles.compactRow}><span style={styles.compactMeta}>Income</span><span style={styles.compactMetaValue}>{currency(income)}</span></div>
                      <div style={styles.compactRow}><span style={styles.compactMeta}>Expense</span><span style={styles.compactMetaValue}>{currency(expenses)}</span></div>
                      <div style={styles.compactRow}><span style={styles.compactMeta}>Balance</span><span style={{ ...styles.compactMetaValue, color: balance >= 0 ? '#065f46' : '#b91c1c' }}>{currency(balance)}</span></div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={styles.tableWrapper}>
              <div style={styles.tableTitle}>Monthly Breakdown</div>
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Month</th>
                      <th style={styles.th}>Income</th>
                      <th style={styles.th}>Expense</th>
                      <th style={styles.th}>Profit / Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={styles.emptyCell}>No monthly breakdown available.</td>
                      </tr>
                    ) : (
                      monthlyBreakdown.map((row, index) => {
                        const profitValue = Number(row?.profit_loss || 0)
                        return (
                          <tr key={`${row?.label || 'month'}-${index}`}>
                            <td style={styles.td}>{row?.label || '-'}</td>
                            <td style={styles.td}>{currency(row?.income)}</td>
                            <td style={styles.td}>{currency(row?.expense)}</td>
                            <td style={{ ...styles.td, color: profitValue >= 0 ? '#065f46' : '#b91c1c', fontWeight: 800 }}>{currency(profitValue)}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={styles.totalCell}>Total</td>
                      <td style={styles.totalCell}>{currency(totalIncome)}</td>
                      <td style={styles.totalCell}>{currency(totalExpense)}</td>
                      <td style={{ ...styles.totalCell, color: totalProfitLoss >= 0 ? '#065f46' : '#b91c1c' }}>{currency(totalProfitLoss)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: { display: 'grid', gap: 12, padding: 6 },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  heading: { margin: 0, fontSize: 20, color: '#0f2742' },
  printButton: { border: '1px solid #0f2742', background: '#0f2742', color: 'white', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 10 },
  periodCard: { background: 'white', border: '1px solid #dbe7f7', borderRadius: 12, padding: 16 },
  periodLabel: { fontSize: 12, color: '#5f779b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 },
  periodValue: { marginTop: 8, fontSize: 18, fontWeight: 800 },
  detailList: { marginTop: 10, display: 'grid', gap: 6 },
  detailRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #eef4fb', paddingTop: 6 },
  detailLabel: { fontSize: 12, color: '#5f779b', fontWeight: 700 },
  detailValue: { fontSize: 12, fontWeight: 700, color: '#0f2742' },
  compactWrapper: { marginTop: 14, background: 'white', border: '1px solid #dbe7f7', borderRadius: 12, padding: 14 },
  compactGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  compactCard: { background: '#f8fbff', border: '1px solid #dbe7f7', borderRadius: 10, padding: 12 },
  compactLabel: { fontSize: 12, color: '#5f779b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 },
  compactValue: { marginTop: 8, fontSize: 16, fontWeight: 800 },
  compactRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6, borderTop: '1px solid #e9f0fb', paddingTop: 6 },
  compactMeta: { fontSize: 11, color: '#5f779b', fontWeight: 700 },
  compactMetaValue: { fontSize: 11, color: '#0f2742', fontWeight: 700 },
  tableWrapper: { marginTop: 14, background: 'white', border: '1px solid #dbe7f7', borderRadius: 12, padding: 14 },
  tableTitle: { fontSize: 14, fontWeight: 800, color: '#0f2742', marginBottom: 10 },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', background: '#f8fbff', padding: 10, borderBottom: '1px solid #dbe7f7', color: '#5f779b', fontWeight: 800 },
  td: { padding: 10, borderBottom: '1px solid #eef4fb', color: '#0f2742' },
  totalCell: { padding: 10, borderTop: '1px solid #dbe7f7', fontWeight: 800, color: '#0f2742', background: '#f8fbff' },
  emptyCell: { padding: 14, textAlign: 'center', color: '#64748b' },
  loading: { fontSize: 13, color: '#5f779b' },
  error: { fontSize: 13, color: '#b91c1c', background: '#fff1f2', borderRadius: 8, padding: 8 },
}
