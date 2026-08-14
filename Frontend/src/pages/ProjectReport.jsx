import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const STATUS_LABELS = ['registered', 'shortlisted', 'selected', 'certified', 'deployed', 'rejected']

const normalizeStatus = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')

export default function ProjectReport() {
  const [projects, setProjects] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const visibleProjects = useMemo(
    () => projects.filter((project) => project.is_active !== false),
    [projects]
  )

  const groupedProjects = useMemo(() => {
    const groups = {}
    visibleProjects.forEach((project) => {
      const key = project.project_reference_code || project.project_name || project.id
      if (!groups[key]) {
        groups[key] = {
          project_name: project.project_name || 'Untitled Project',
          project_reference_code: project.project_reference_code,
          client: project.agency_name || project.client,
          country: project.country,
          is_active: project.is_active,
          rows: [],
        }
      }
      groups[key].rows.push(project)
    })
    return Object.values(groups)
  }, [visibleProjects])

  const projectStatusMap = useMemo(() => {
    const map = {}

    visibleProjects.forEach((project) => {
      const list = candidates.filter((candidate) => String(candidate.project_id || candidate.project?.id || '') === String(project.id))
      const counts = STATUS_LABELS.reduce((acc, key) => {
        acc[key] = list.filter((candidate) => normalizeStatus(candidate.status) === key).length
        return acc
      }, {})

      map[project.id] = {
        demand: Number(project.total_demand || project.number_of_requirements || 0),
        candidates: list.length,
        selected: counts.selected + counts.certified,
        rejected: counts.rejected,
        deployed: counts.deployed,
        shortlisted: counts.shortlisted,
        registered: counts.registered,
      }
    })

    return map
  }, [candidates, visibleProjects])

  const summary = useMemo(() => {
    const activeCount = groupedProjects.length
    const tradeCount = visibleProjects.reduce((sum, project) => sum + (project.trade ? 1 : 0), 0)
    const averageRate = groupedProjects.length
      ? groupedProjects.reduce((sum, group) => sum + Number(group.rows[0]?.office_rate_per_trade || 0), 0) / groupedProjects.length
      : 0

    const totalDemand = visibleProjects.reduce((sum, project) => sum + Number(project.total_demand || project.number_of_requirements || 0), 0)
    const totalCandidates = Object.values(projectStatusMap).reduce((sum, item) => sum + Number(item.candidates || 0), 0)
    const totalSelected = Object.values(projectStatusMap).reduce((sum, item) => sum + Number(item.selected || 0), 0)
    const totalRejected = Object.values(projectStatusMap).reduce((sum, item) => sum + Number(item.rejected || 0), 0)
    const totalDeployed = Object.values(projectStatusMap).reduce((sum, item) => sum + Number(item.deployed || 0), 0)

    return {
      activeCount,
      tradeCount,
      averageRate,
      totalDemand,
      totalCandidates,
      totalSelected,
      totalRejected,
      totalDeployed,
    }
  }, [visibleProjects, groupedProjects, projectStatusMap])

  const countryCounts = useMemo(() => {
    return visibleProjects.reduce((acc, project) => {
      const country = project.country?.trim() || 'Unknown'
      acc[country] = (acc[country] || 0) + 1
      return acc
    }, {})
  }, [visibleProjects])

  const rateThresholds = useMemo(() => {
    const rates = visibleProjects
      .map((project) => Number(project.office_rate_per_trade || 0))
      .filter((rate) => rate > 0)

    const averageRate = rates.length
      ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length
      : 0

    return {
      high: averageRate * 1.15,
      low: averageRate * 0.85,
      averageRate,
    }
  }, [visibleProjects])

  const getRateRowStyle = (rate) => {
    const numericRate = Number(rate || 0)
    if (numericRate === 0) return { background: '#f8fafc' }
    if (numericRate >= rateThresholds.high) {
      return { background: '#ecfdf5', borderLeft: '4px solid #16a34a' }
    }
    if (numericRate <= rateThresholds.low) {
      return { background: '#fffbeb', borderLeft: '4px solid #f59e0b' }
    }
    return { background: '#f8fafc', borderLeft: '4px solid #60a5fa' }
  }

  const getProfitEstimate = (project) => {
    const salary = Number(project.salary_per_trade || 0)
    const rate = Number(project.office_rate_per_trade || 0)
    if (salary <= 0 || rate <= 0) return null
    return rate - salary
  }

  const loadProjects = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { is_active: true }
      if (search) params.search = search
      const [projectRes, candidateRes] = await Promise.all([
        api.get('/project-settings', { params }),
        api.get('/candidates', { params: { per_page: 1000 } }),
      ])

      const projectRows = Array.isArray(projectRes?.data?.data) ? projectRes.data.data : []
      const candidateRows = Array.isArray(candidateRes?.data?.data?.candidates)
        ? candidateRes.data.data.candidates
        : Array.isArray(candidateRes?.data?.data)
          ? candidateRes.data.data
          : []

      setProjects(projectRows)
      setCandidates(candidateRows)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadProjects() }, [])

  return (
    <SidebarLayout title="Project Wise Report">
      <div style={styles.page} className="reveal-up">
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.heading}>Project Wise Report</h2>
            <p style={styles.description}>Showing configured active projects with office rate, trade, and status details.</p>
          </div>
          <div style={styles.searchRow}>
            <input
              placeholder="Search project name, client or trade"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
            <button onClick={() => void loadProjects()} style={styles.searchButton}>Search</button>
          </div>
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Active Projects</div>
            <div style={styles.summaryValue}>{summary.activeCount}</div>
          </div>
          <div style={styles.summaryCardAlt}>
            <div style={styles.summaryLabel}>Total Demand</div>
            <div style={styles.summaryValue}>{summary.totalDemand}</div>
          </div>
          <div style={styles.summaryCardAlt}>
            <div style={styles.summaryLabel}>Total Candidate Enrolled</div>
            <div style={styles.summaryValue}>{summary.totalCandidates}</div>
          </div>
          <div style={styles.summaryCardAlt}>
            <div style={styles.summaryLabel}>Deployed</div>
            <div style={styles.summaryValue}>{summary.totalDeployed}</div>
          </div>
          <div style={styles.summaryCardAlt}>
            <div style={styles.summaryLabel}>Selected</div>
            <div style={styles.summaryValue}>{summary.totalSelected}</div>
          </div>
          <div style={styles.summaryCardAlt}>
            <div style={styles.summaryLabel}>Rejected</div>
            <div style={styles.summaryValue}>{summary.totalRejected}</div>
          </div>
        </div>

        <div style={styles.countryBadgeRow}>
          {Object.entries(countryCounts).map(([country, count]) => (
            <div key={country} style={styles.countryBadge}>
              <span style={styles.countryName}>{country}</span>
              <span style={styles.countryCount}>{count}</span>
            </div>
          ))}
        </div>

        <div style={styles.legendRow}>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#16a34a' }} />
            Above average office rate
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#60a5fa' }} />
            Near average office rate
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#f59e0b' }} />
            Below average office rate
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {loading ? (
          <div style={styles.loading}>Loading projects...</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Project</th>
                  <th style={styles.th}>Reference</th>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Trade</th>
                  <th style={styles.th}>Office Rate</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleProjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={styles.emptyRow}>No active projects found.</td>
                  </tr>
                ) : groupedProjects.map((group) => {
                  return group.rows.map((project, index) => {
                    const rate = Number(project.office_rate_per_trade || 0)
                    const projectStats = projectStatusMap[project.id] || { demand: 0, candidates: 0, selected: 0, rejected: 0, deployed: 0, shortlisted: 0, registered: 0 }
                    const statusList = [
                      { key: 'Enrolled', value: projectStats.candidates },
                      { key: 'Demand', value: projectStats.demand },
                      { key: 'Registered', value: projectStats.registered },
                      { key: 'Shortlisted', value: projectStats.shortlisted },
                      { key: 'Selected', value: projectStats.selected },
                      { key: 'Deployed', value: projectStats.deployed },
                      { key: 'Rejected', value: projectStats.rejected },
                    ]

                    return (
                      <tr key={`${group.project_reference_code || group.project_name}-${project.id}`} style={{ ...styles.row, ...getRateRowStyle(rate) }}>
                        {index === 0 && (
                          <td style={styles.td} rowSpan={group.rows.length}>
                            <div style={styles.projectName}>{group.project_name}</div>
                            <div style={styles.projectMeta}>{group.country || 'No country'}</div>
                          </td>
                        )}
                        {index === 0 && (
                          <td style={styles.td} rowSpan={group.rows.length}>{group.project_reference_code || '-'}</td>
                        )}
                        {index === 0 && (
                          <td style={styles.td} rowSpan={group.rows.length}>{group.client || '-'}</td>
                        )}
                        <td style={styles.td}>{project.trade || project.role_name || '-'}</td>
                        <td style={styles.td}>{rate > 0 ? `NPR Rs ${rate.toLocaleString()}` : '-'}</td>
                        {index === 0 && (
                          <td style={{ ...styles.td, color: project.is_active ? '#0f813a' : '#b91c1c' }} rowSpan={group.rows.length}>
                            <div style={styles.statusHeaderRow}>
                              <span style={styles.activeBadge}>{project.is_active ? 'Active' : 'Inactive'}</span>
                            </div>
                            <div style={styles.statusCompact}>
                              {statusList.map((item) => (
                                <span key={`${project.id}-${item.key}`} style={styles.metaPillAccent}>{item.key}: {item.value}</span>
                              ))}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}

const styles = {
  page: { padding: 20, display: 'grid', gap: 18 },
  headerRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  heading: { margin: 0, fontSize: 26, color: '#0f2742' },
  description: { margin: '8px 0 0', color: '#51627a' },
  searchRow: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  searchInput: { minWidth: 220, flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid #d6dde9', outline: 'none' },
  searchButton: { padding: '10px 16px', borderRadius: 12, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 },
  summaryCard: { padding: 18, borderRadius: 18, background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)', border: '1px solid #dbe7ff' },
  summaryCardAlt: { padding: 18, borderRadius: 18, background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', border: '1px solid #dfe7ef' },
  summaryLabel: { fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4b5563' },
  summaryValue: { marginTop: 10, fontSize: 24, fontWeight: 800, color: '#0f2742' },
  error: { padding: 14, borderRadius: 14, background: '#fff1f2', border: '1px solid #fecaca', color: '#991b1b' },
  loading: { padding: 20, color: '#475569' },
  tableWrap: { overflowX: 'auto', borderRadius: 18, boxShadow: '0 16px 36px rgba(15, 39, 66, 0.08)' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 760, background: '#fff' },
  th: { padding: '14px 16px', textAlign: 'left', color: '#334155', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '14px 16px', color: '#475569', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
  row: { transition: 'background 0.2s ease', borderRadius: 18 },
  projectName: { fontSize: 15, fontWeight: 700, color: '#0f2742' },
  projectMeta: { marginTop: 4, fontSize: 13, color: '#64748b' },
  projectMetaSmall: { fontSize: 12, color: '#94a3b8' },
  countryBadgeRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  countryBadge: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, background: '#eff6ff', color: '#0f3d91', fontWeight: 700, fontSize: 13 },
  countryName: { marginRight: 8, color: '#0f2742' },
  countryCount: { minWidth: 26, height: 26, borderRadius: 999, background: '#1d4ed8', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12 },
  legendRow: { display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18, alignItems: 'center' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 999, background: '#f8fafc', color: '#334155', fontSize: 12, border: '1px solid #e2e8f0' },
  legendDot: { width: 12, height: 12, borderRadius: '50%', display: 'inline-block' },
  statusHeaderRow: { marginBottom: 8 },
  activeBadge: { display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  statusCompact: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  metaPillAccent: { background: '#eef2ff', color: '#1e3a8a', fontSize: 10, display: 'inline-flex', padding: '4px 7px', borderRadius: 999, fontWeight: 700 },
  emptyRow: { padding: 20, textAlign: 'center', color: '#6b7280' },
}
