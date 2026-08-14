import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const money = (value) => `NPR Rs ${Number(value || 0).toLocaleString()}`

export default function CandidateReport() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [error, setError] = useState('')
  const [visaEntries, setVisaEntries] = useState([])
  const [viewMode, setViewMode] = useState('overview')

  const loadProjects = async () => {
    try {
      const res = await api.get('/project-settings')
      setProjects(Array.isArray(res?.data?.data) ? res.data.data : [])
    } catch {
      setProjects([])
    }
  }

  const loadCandidates = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { per_page: 500 }
      if (search) params.search = search
      if (projectFilter) params.project_id = projectFilter
      const res = await api.get('/candidates', { params })
      const rows = res.data.data.candidates || res.data.data || []
      setCandidates(rows)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load candidates')
    } finally {
      setLoading(false)
    }
  }

  const loadVisaEntries = async () => {
    try {
      const res = await api.get('/candidate-flown', { params: { per_page: 1000 } })
      const rows = Array.isArray(res?.data?.data?.entries)
        ? res.data.data.entries
        : Array.isArray(res?.data?.data)
          ? res.data.data
          : []
      setVisaEntries(rows)
    } catch {
      setVisaEntries([])
    }
  }

  useEffect(() => {
    void loadProjects()
    void loadCandidates()
    void loadVisaEntries()
  }, [])

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase()
    return candidates.filter((candidate) => {
      const matchesSearch = !query || [candidate.full_name, candidate.passport_number, candidate.project_name, candidate.reference_name].join(' ').toLowerCase().includes(query)
      const matchesProject = !projectFilter || String(candidate.project_id) === String(projectFilter) || String(candidate.project?.id) === String(projectFilter)
      return matchesSearch && matchesProject
    })
  }, [candidates, search, projectFilter])

  const summary = useMemo(() => {
    const rows = filteredCandidates.map((candidate) => {
      const entry = visaEntries.find((item) => String(item.candidate_id) === String(candidate.id)) || null
      const totalFee = Number(entry?.total_fee || entry?.office_rate || candidate.total_fee || 0)
      const paid = Number(candidate.paid_amount || candidate.paid || (entry ? (Number(entry.advance_1 || 0) + Number(entry.advance_2 || 0) + Number(entry.advance_3 || 0)) : 0))
      const remaining = Math.max(totalFee - paid, 0)
      const profit = Number(entry?.total_fee ? (Number(entry.total_fee || 0) - Number(entry.office_rate || 0)) : 0)
      return { totalFee, paid, remaining, profit }
    })

    return {
      candidates: rows.length,
      totalPaid: rows.reduce((sum, row) => sum + row.paid, 0),
      totalDue: rows.reduce((sum, row) => sum + row.remaining, 0),
      totalProfit: rows.reduce((sum, row) => sum + row.profit, 0),
      totalFee: rows.reduce((sum, row) => sum + row.totalFee, 0),
    }
  }, [filteredCandidates, visaEntries])

  const handleSearch = (e) => {
    e.preventDefault()
    void loadCandidates()
  }

  const handleReset = () => {
    setSearch('')
    setProjectFilter('')
    setViewMode('overview')
    setTimeout(() => loadCandidates(), 0)
  }

  const handleExportCsv = () => {
    const rows = filteredCandidates.map((candidate) => {
      const entry = visaEntries.find((item) => String(item.candidate_id) === String(candidate.id)) || null
      const totalFee = Number(entry?.total_fee || entry?.office_rate || candidate.total_fee || 0)
      const paid = Number(candidate.paid_amount || candidate.paid || (entry ? (Number(entry.advance_1 || 0) + Number(entry.advance_2 || 0) + Number(entry.advance_3 || 0)) : 0))
      const remaining = Math.max(totalFee - paid, 0)
      const profit = Number(entry?.total_fee ? (Number(entry.total_fee || 0) - Number(entry.office_rate || 0)) : 0)
      return {
        Name: candidate.full_name || '-',
        Passport: candidate.passport_number || '-',
        Reference: candidate.reference_name || candidate.source || '-',
        Project: candidate.project?.project_name || candidate.project_name || '-',
        TotalFee: totalFee,
        Paid: paid,
        Remaining: remaining,
        ProfitLoss: profit,
        Status: candidate.status || '-',
      }
    })

    const headers = ['Name', 'Passport', 'Reference', 'Project', 'TotalFee', 'Paid', 'Remaining', 'ProfitLoss', 'Status']
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'candidate-wise-report.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const getCandidateMetrics = (candidate) => {
    const entry = visaEntries.find((item) => String(item.candidate_id) === String(candidate.id)) || null
    const totalFee = Number(entry?.total_fee || entry?.office_rate || candidate.total_fee || 0)
    const paid = Number(candidate.paid_amount || candidate.paid || (entry ? (Number(entry.advance_1 || 0) + Number(entry.advance_2 || 0) + Number(entry.advance_3 || 0)) : 0))
    const remaining = Math.max(totalFee - paid, 0)
    const profit = Number(entry?.total_fee ? (Number(entry.total_fee || 0) - Number(entry.office_rate || 0)) : 0)
    return { totalFee, paid, remaining, profit, status: candidate.status || 'active' }
  }

  return (
    <SidebarLayout title="Candidate Wise Report">
      <div style={styles.pageWrap} className="reveal-up">
        <div style={styles.headerPanel}>
          <div>
            <div style={styles.eyebrow}>Operations overview</div>
            <h2 style={styles.pageTitle}>Candidate Wise Report</h2>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.secondaryButton} type="button" onClick={() => navigate('/candidates')}>
              View candidates
            </button>
            <button style={styles.primaryButton} type="button" onClick={handleExportCsv}>
              Export CSV
            </button>
          </div>
        </div>

        <div style={styles.toolbar}>
          <form onSubmit={handleSearch} style={styles.searchForm}>
            <div style={styles.searchInputWrap}>
              <span style={styles.searchIcon}>⌕</span>
              <input
                placeholder="Search name / passport / project"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={styles.selectInput}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.project_name}</option>
              ))}
            </select>
            <button type="submit" style={styles.primaryButton}>Apply</button>
            <button type="button" style={styles.secondaryButton} onClick={handleReset}>Reset</button>
          </form>
        </div>

        <div style={styles.segmentedNav}>
          {['overview', 'payments', 'profit'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setViewMode(item)}
              style={{
                ...styles.segmentButton,
                ...(viewMode === item ? styles.segmentButtonActive : {}),
              }}
            >
              {item === 'overview' ? 'Overview' : item === 'payments' ? 'Payments' : 'Profit'}
            </button>
          ))}
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.statsGrid}>
          <div style={{ ...styles.statCard, ...styles.statCardBlue }}>
            <div style={styles.statLabel}>Candidates</div>
            <div style={styles.statValue}>{filteredCandidates.length}</div>
            <div style={styles.statFoot}>Total visible</div>
          </div>
          <div style={{ ...styles.statCard, ...styles.statCardGreen }}>
            <div style={styles.statLabel}>Total Paid</div>
            <div style={styles.statValue}>{money(summary.totalPaid)}</div>
            <div style={styles.statFoot}>Collected</div>
          </div>
          <div style={{ ...styles.statCard, ...styles.statCardOrange }}>
            <div style={styles.statLabel}>Total Due</div>
            <div style={styles.statValue}>{money(summary.totalDue)}</div>
            <div style={styles.statFoot}>Outstanding</div>
          </div>
          <div style={{ ...styles.statCard, ...styles.statCardPurple }}>
            <div style={styles.statLabel}>Profit / Loss</div>
            <div style={styles.statValue}>{money(summary.totalProfit)}</div>
            <div style={styles.statFoot}>Net margin</div>
          </div>
        </div>

        {loading ? (
          <div style={styles.loadingBox}>Loading candidates report...</div>
        ) : (
          <div style={styles.tableCard}>
            <div style={styles.tableInfoBar}>
              <span style={styles.tableTitle}>Candidate details</span>
              <span style={styles.tableMeta}>{filteredCandidates.length} records</span>
            </div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeadRow}>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Passport</th>
                    <th style={styles.th}>Reference</th>
                    <th style={styles.th}>Project</th>
                    <th style={styles.th}>Total Fee</th>
                    <th style={styles.th}>Advance Paid</th>
                    <th style={styles.th}>Remaining</th>
                    <th style={styles.th}>Profit / Loss</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate) => {
                    const metrics = getCandidateMetrics(candidate)
                    const referenceName = candidate.reference_name || candidate.source || candidate.reference?.reference_name || '-'
                    return (
                      <tr key={candidate.id} style={styles.tr}>
                        <td style={styles.td}>{candidate.full_name || '-'}</td>
                        <td style={styles.td}>{candidate.passport_number || '-'}</td>
                        <td style={styles.td}>{referenceName}</td>
                        <td style={styles.td}>{candidate.project?.project_name || candidate.project_name || '-'}</td>
                        <td style={styles.td}>{metrics.totalFee > 0 ? money(metrics.totalFee) : '—'}</td>
                        <td style={{ ...styles.td, color: metrics.paid > 0 ? '#0b8c5a' : '#475569', fontWeight: 700 }}>{money(metrics.paid)}</td>
                        <td style={{ ...styles.td, color: metrics.remaining > 0 ? '#d97706' : '#0f766e', fontWeight: 700 }}>{money(metrics.remaining)}</td>
                        <td style={{ ...styles.td, color: metrics.profit >= 0 ? '#0b8c5a' : '#b91c1c', fontWeight: 700 }}>{money(metrics.profit)}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.statusBadge, ...(metrics.status.toLowerCase().includes('selected') ? styles.statusSelected : metrics.status.toLowerCase().includes('training') ? styles.statusTraining : styles.statusDefault) }}>
                            {metrics.status || 'active'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={styles.rowButton}
                            onClick={() => navigate(`/candidates/${candidate.id}`)}
                          >
                            View report
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}

const styles = {
  pageWrap: {
    padding: 16,
  },
  headerPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    border: '1px solid #dfe7f5',
    background: 'linear-gradient(135deg, rgba(14, 72, 130, 0.04), rgba(17, 24, 39, 0.02))',
    borderRadius: 18,
    padding: '20px 22px',
    marginBottom: 18,
  },
  eyebrow: {
    color: '#4b6b92',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pageTitle: {
    margin: 0,
    color: '#0f2a4f',
    fontSize: 34,
    fontWeight: 800,
    lineHeight: 1.1,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 'none',
    borderRadius: 10,
    background: 'linear-gradient(135deg, #0a3772, #0f4d9d 58%, #1d74d5)',
    color: '#fff',
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 12px 20px rgba(16, 82, 151, 0.2)',
  },
  secondaryButton: {
    border: '1px solid #d4e0f3',
    borderRadius: 10,
    background: '#f8fbff',
    color: '#173e6d',
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  toolbar: {
    background: '#fff',
    border: '1px solid #e7edf7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    boxShadow: '0 10px 20px rgba(15, 42, 79, 0.03)',
  },
  searchForm: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 240,
    display: 'flex',
    alignItems: 'center',
    background: '#f8fbff',
    border: '1px solid #dfeaf8',
    borderRadius: 10,
    padding: '0 12px',
  },
  searchIcon: {
    color: '#6985ad',
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: 14,
    color: '#0f2a4f',
    padding: '12px 0',
    outline: 'none',
  },
  selectInput: {
    minWidth: 180,
    border: '1px solid #dfeaf8',
    borderRadius: 10,
    background: '#f8fbff',
    color: '#0f2a4f',
    padding: '12px 14px',
    fontSize: 14,
    outline: 'none',
  },
  segmentedNav: {
    display: 'inline-flex',
    background: '#edf4ff',
    border: '1px solid #dfeaf8',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 18,
  },
  segmentButton: {
    border: 'none',
    borderRadius: 10,
    background: 'transparent',
    color: '#47617d',
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  segmentButtonActive: {
    background: '#fff',
    color: '#0f2a4f',
    boxShadow: '0 4px 12px rgba(15, 42, 79, 0.08)',
  },
  errorBox: {
    border: '1px solid #fecdc2',
    background: '#fff1f1',
    color: '#b42318',
    padding: '11px 14px',
    borderRadius: 10,
    marginBottom: 16,
    fontWeight: 600,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14,
    marginBottom: 18,
  },
  statCard: {
    borderRadius: 16,
    padding: 16,
    border: '1px solid #e5edf8',
    minHeight: 118,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  statCardBlue: {
    background: 'linear-gradient(135deg, #eef5ff, #ffffff)',
  },
  statCardGreen: {
    background: 'linear-gradient(135deg, #ebfff6, #ffffff)',
  },
  statCardOrange: {
    background: 'linear-gradient(135deg, #fff5eb, #ffffff)',
  },
  statCardPurple: {
    background: 'linear-gradient(135deg, #f4f0ff, #ffffff)',
  },
  statLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0f2a4f',
    lineHeight: 1.2,
    marginTop: 10,
  },
  statFoot: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  loadingBox: {
    background: '#fff',
    border: '1px solid #e7edf7',
    borderRadius: 16,
    padding: 22,
    color: '#47617d',
    fontWeight: 600,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCard: {
    background: '#fff',
    border: '1px solid #e7edf7',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 10px 22px rgba(15, 42, 79, 0.04)',
  },
  tableInfoBar: {
    padding: '16px 18px',
    borderBottom: '1px solid #edf2f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#f8fbff',
  },
  tableTitle: {
    fontWeight: 800,
    color: '#0f2a4f',
    fontSize: 16,
  },
  tableMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 1100,
  },
  tableHeadRow: {
    background: '#f5f9ff',
  },
  th: {
    padding: '12px 10px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 800,
    color: '#35507a',
    borderBottom: '1px solid #edf2f9',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tr: {
    borderBottom: '1px solid #f3f6fb',
    transition: 'background 0.2s ease',
  },
  td: {
    padding: '12px 10px',
    color: '#0f2a4f',
    fontSize: 13,
    fontWeight: 600,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 86,
    padding: '5px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'capitalize',
  },
  statusDefault: {
    background: '#eaf2ff',
    color: '#1d4ed8',
  },
  statusSelected: {
    background: '#ecfdf5',
    color: '#047857',
  },
  statusTraining: {
    background: '#fff7ed',
    color: '#b45309',
  },
  rowButton: {
    border: '1px solid #cfe0ff',
    borderRadius: 8,
    background: '#edf5ff',
    color: '#123d68',
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
