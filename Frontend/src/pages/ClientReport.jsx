import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const SELECTED_STATUSES = new Set(['selected', 'certified'])
const SHORTLISTED_STATUSES = new Set(['shortlisted'])
const REJECTED_STATUSES = new Set(['rejected'])

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase()
}

function getClientKey(value) {
  return normalizeValue(value).replace(/\s+/g, ' ')
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return 'N/A'
  return `NPR Rs ${amount.toLocaleString()}`
}

function buildStatusBreakdown(rows) {
  return rows.reduce((acc, row) => {
    const status = normalizeValue(row?.status).replace(/-/g, '_').replace(/\s+/g, '_')
    if (SHORTLISTED_STATUSES.has(status)) acc.shortlisted += 1
    if (SELECTED_STATUSES.has(status)) acc.selected += 1
    if (REJECTED_STATUSES.has(status)) acc.rejected += 1
    return acc
  }, { shortlisted: 0, selected: 0, rejected: 0 })
}

export default function ClientReport() {
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const loadReport = async () => {
    setLoading(true)
    setError('')
    try {
      const [clientRes, projectRes, candidateRes] = await Promise.all([
        api.get('/agencies', { params: { per_page: 500 } }),
        api.get('/project-settings', { params: { is_active: true } }),
        api.get('/candidates', { params: { per_page: 1000 } }),
      ])

      setClients(Array.isArray(clientRes?.data?.data) ? clientRes.data.data : [])
      setProjects(Array.isArray(projectRes?.data?.data) ? projectRes.data.data : [])

      const candidateRows = Array.isArray(candidateRes?.data?.data?.candidates)
        ? candidateRes.data.data.candidates
        : Array.isArray(candidateRes?.data?.data)
          ? candidateRes.data.data
          : []
      setCandidates(candidateRows)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load client wise report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReport()
  }, [])

  const reportRows = useMemo(() => {
    const clientsByKey = new Map()

    clients.forEach((client) => {
      const companyName = client.company_name || client.name || 'Unnamed Client'
      const key = getClientKey(companyName)
      if (!key) return

      clientsByKey.set(key, {
        key,
        companyName,
        contactPerson1: client.contact_person_1 || client.contact_person || '-',
        designation1: client.designation_1 || '-',
        phoneNumber1: client.phone_number_1 || client.phone || '-',
        email1: client.email_1 || client.email || '-',
        contactPerson2: client.contact_person_2 || '-',
        designation2: client.designation_2 || '-',
        phoneNumber2: client.phone_number_2 || '-',
        email2: client.email_2 || '-',
        country: client.country || '-',
        projects: [],
      })
    })

    const candidatesByProjectId = candidates.reduce((acc, candidate) => {
      const projectId = String(candidate?.project_id || candidate?.project?.id || '')
      if (!projectId) return acc
      if (!acc[projectId]) acc[projectId] = []
      acc[projectId].push(candidate)
      return acc
    }, {})

    projects.forEach((project) => {
      const companyName = project.agency_name || project.client || project.company_name || 'Unassigned Client'
      const key = getClientKey(companyName)

      const clientRow = clientsByKey.get(key) || {
        key,
        companyName,
        contactPerson1: '-',
        designation1: '-',
        phoneNumber1: '-',
        email1: '-',
        contactPerson2: '-',
        designation2: '-',
        phoneNumber2: '-',
        email2: '-',
        country: project.country || '-',
        projects: [],
      }

      const projectCandidates = candidatesByProjectId[String(project.id)] || []
      const breakdown = buildStatusBreakdown(projectCandidates)
      const salaryPerTrade = Number(project.salary_per_trade || 0)

      clientRow.projects.push({
        id: project.id,
        projectName: project.project_name || 'Untitled Project',
        referenceCode: project.project_reference_code || '-',
        trade: project.trade || '-',
        country: project.country || '-',
        candidateCount: projectCandidates.length,
        shortlistedCount: breakdown.shortlisted,
        selectedCount: breakdown.selected,
        rejectedCount: breakdown.rejected,
        salaryPerTrade,
        totalSalary: salaryPerTrade > 0 ? salaryPerTrade * projectCandidates.length : 0,
      })

      clientsByKey.set(key, clientRow)
    })

    const query = normalizeValue(search)

    return Array.from(clientsByKey.values())
      .map((clientRow) => {
        const sortedProjects = [...clientRow.projects].sort((left, right) => left.projectName.localeCompare(right.projectName))
        const filteredProjects = sortedProjects.filter((project) => {
          if (!query) return true
          const haystack = [
            clientRow.companyName,
            clientRow.contactPerson1,
            clientRow.designation1,
            clientRow.phoneNumber1,
            clientRow.email1,
            clientRow.contactPerson2,
            clientRow.designation2,
            clientRow.phoneNumber2,
            clientRow.email2,
            clientRow.country,
            project.projectName,
            project.referenceCode,
            project.trade,
            project.country,
          ].map(normalizeValue).join(' ')
          return haystack.includes(query)
        })

        const matchedClient = [
          clientRow.companyName,
          clientRow.contactPerson1,
          clientRow.designation1,
          clientRow.phoneNumber1,
          clientRow.email1,
          clientRow.contactPerson2,
          clientRow.designation2,
          clientRow.phoneNumber2,
          clientRow.email2,
          clientRow.country,
        ]
          .map(normalizeValue)
          .join(' ')
          .includes(query)

        if (query && filteredProjects.length === 0 && !matchedClient) {
          return null
        }

        const visibleProjects = query && filteredProjects.length === 0
          ? sortedProjects
          : filteredProjects.length > 0
            ? filteredProjects
            : sortedProjects

        const totals = visibleProjects.reduce((acc, project) => {
          acc.projects += 1
          acc.candidates += project.candidateCount
          acc.shortlisted += project.shortlistedCount
          acc.selected += project.selectedCount
          acc.rejected += project.rejectedCount
          acc.totalSalary += project.totalSalary
          return acc
        }, { projects: 0, candidates: 0, shortlisted: 0, selected: 0, rejected: 0, totalSalary: 0 })

        return {
          ...clientRow,
          projects: visibleProjects,
          totals,
        }
      })
      .filter(Boolean)
      .sort((left, right) => left.companyName.localeCompare(right.companyName))
  }, [candidates, clients, projects, search])

  const summary = useMemo(() => {
    return reportRows.reduce((acc, clientRow) => {
      acc.clients += 1
      acc.projects += clientRow.totals.projects
      acc.candidates += clientRow.totals.candidates
      acc.shortlisted += clientRow.totals.shortlisted
      acc.selected += clientRow.totals.selected
      acc.rejected += clientRow.totals.rejected
      acc.totalSalary += clientRow.totals.totalSalary
      return acc
    }, { clients: 0, projects: 0, candidates: 0, shortlisted: 0, selected: 0, rejected: 0, totalSalary: 0 })
  }, [reportRows])

  return (
    <SidebarLayout title="Client Wise Report">
      <div style={styles.page} className="reveal-up">
        <div style={styles.heroCard}>
          <div>
            <div style={styles.eyebrow}>Reports</div>
            <h2 style={styles.heading}>Client Wise Report</h2>
            <p style={styles.description}>Track client projects, candidate pipeline, and project salary in one view.</p>
          </div>

          <div style={styles.searchRow}>
            <input
              placeholder="Search client, project, trade, country"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
            <button onClick={() => void loadReport()} style={styles.searchButton}>Refresh</button>
          </div>
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCardPrimary}>
            <div style={styles.summaryLabel}>Clients</div>
            <div style={styles.summaryValue}>{summary.clients}</div>
          </div>
          <div style={styles.summaryCardBlue}>
            <div style={styles.summaryLabel}>Projects</div>
            <div style={styles.summaryValue}>{summary.projects}</div>
          </div>
          <div style={styles.summaryCardSky}>
            <div style={styles.summaryLabel}>Candidates</div>
            <div style={styles.summaryValue}>{summary.candidates}</div>
          </div>
          <div style={styles.summaryCardMint}>
            <div style={styles.summaryLabel}>Selected</div>
            <div style={styles.summaryValue}>{summary.selected}</div>
          </div>
          <div style={styles.summaryCardAmber}>
            <div style={styles.summaryLabel}>Shortlisted</div>
            <div style={styles.summaryValue}>{summary.shortlisted}</div>
          </div>
          <div style={styles.summaryCardRose}>
            <div style={styles.summaryLabel}>Rejected</div>
            <div style={styles.summaryValue}>{summary.rejected}</div>
          </div>
        </div>

        <div style={styles.salaryBanner}>
          <span style={styles.salaryBannerLabel}>Total Project Salary</span>
          <strong style={styles.salaryBannerValue}>{formatCurrency(summary.totalSalary)}</strong>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {loading ? (
          <div style={styles.loading}>Loading client report...</div>
        ) : (
          <div style={styles.tableShell}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Contact 1</th>
                  <th style={styles.th}>Contact 2</th>
                  <th style={styles.th}>Project</th>
                  <th style={styles.th}>Trade</th>
                  <th style={styles.th}>Country</th>
                  <th style={styles.th}>Candidates</th>
                  <th style={styles.th}>Shortlisted</th>
                  <th style={styles.th}>Selected</th>
                  <th style={styles.th}>Rejected</th>
                  <th style={styles.th}>Salary / Trade</th>
                  <th style={styles.th}>Project Salary</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={styles.emptyRow}>No client report data found.</td>
                  </tr>
                ) : reportRows.map((clientRow) => {
                  if (clientRow.projects.length === 0) {
                    return (
                      <tr key={clientRow.key} style={styles.rowMuted}>
                        <td style={styles.tdClient}>
                          <div style={styles.clientName}>{clientRow.companyName}</div>
                          <div style={styles.clientMeta}>0 projects</div>
                        </td>
                        <td style={styles.td}>
                          <div>{clientRow.contactPerson1}</div>
                          <div style={styles.contactMeta}>{clientRow.designation1}</div>
                          <div style={styles.contactMeta}>{clientRow.phoneNumber1}</div>
                          <div style={styles.contactMeta}>{clientRow.email1}</div>
                        </td>
                        <td style={styles.td}>
                          <div>{clientRow.contactPerson2}</div>
                          <div style={styles.contactMeta}>{clientRow.designation2}</div>
                          <div style={styles.contactMeta}>{clientRow.phoneNumber2}</div>
                          <div style={styles.contactMeta}>{clientRow.email2}</div>
                        </td>
                        <td style={styles.td} colSpan={9}>No active project assigned to this client.</td>
                      </tr>
                    )
                  }

                  return clientRow.projects.map((project, index) => (
                    <tr key={`${clientRow.key}-${project.id}`} style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                      {index === 0 && (
                        <td style={styles.tdClient} rowSpan={clientRow.projects.length}>
                          <div style={styles.clientName}>{clientRow.companyName}</div>
                          <div style={styles.clientMeta}>{clientRow.totals.projects} project{clientRow.totals.projects === 1 ? '' : 's'}</div>
                          <div style={styles.clientMeta}>{clientRow.totals.candidates} candidate{clientRow.totals.candidates === 1 ? '' : 's'}</div>
                          <div style={styles.clientBadges}>
                            <span style={{ ...styles.clientBadge, ...styles.clientBadgeAmber }}>{clientRow.totals.shortlisted} shortlisted</span>
                            <span style={{ ...styles.clientBadge, ...styles.clientBadgeGreen }}>{clientRow.totals.selected} selected</span>
                            <span style={{ ...styles.clientBadge, ...styles.clientBadgeRose }}>{clientRow.totals.rejected} rejected</span>
                          </div>
                        </td>
                      )}
                      {index === 0 && (
                        <td style={styles.td} rowSpan={clientRow.projects.length}>
                          <div>{clientRow.contactPerson1}</div>
                          <div style={styles.contactMeta}>{clientRow.designation1}</div>
                          <div style={styles.contactMeta}>{clientRow.phoneNumber1}</div>
                          <div style={styles.contactMeta}>{clientRow.email1}</div>
                        </td>
                      )}
                      {index === 0 && (
                        <td style={styles.td} rowSpan={clientRow.projects.length}>
                          <div>{clientRow.contactPerson2}</div>
                          <div style={styles.contactMeta}>{clientRow.designation2}</div>
                          <div style={styles.contactMeta}>{clientRow.phoneNumber2}</div>
                          <div style={styles.contactMeta}>{clientRow.email2}</div>
                        </td>
                      )}
                      <td style={styles.td}>
                        <div style={styles.projectName}>{project.projectName}</div>
                        <div style={styles.projectRef}>{project.referenceCode}</div>
                      </td>
                      <td style={styles.td}>{project.trade}</td>
                      <td style={styles.td}>{project.country}</td>
                      <td style={styles.tdCenter}><span style={styles.countBubble}>{project.candidateCount}</span></td>
                      <td style={styles.tdCenter}><span style={{ ...styles.statusPill, ...styles.statusPillAmber }}>{project.shortlistedCount}</span></td>
                      <td style={styles.tdCenter}><span style={{ ...styles.statusPill, ...styles.statusPillGreen }}>{project.selectedCount}</span></td>
                      <td style={styles.tdCenter}><span style={{ ...styles.statusPill, ...styles.statusPillRose }}>{project.rejectedCount}</span></td>
                      <td style={styles.td}>{formatCurrency(project.salaryPerTrade)}</td>
                      <td style={styles.tdStrong}>{formatCurrency(project.totalSalary)}</td>
                    </tr>
                  ))
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
  page: {
    padding: 18,
    display: 'grid',
    gap: 18,
    background: 'linear-gradient(180deg, #f6fbff 0%, #eef7ff 100%)',
    minHeight: '100%',
  },
  heroCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    padding: '22px 24px',
    borderRadius: 24,
    border: '1px solid #bfdbfe',
    background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 55%, #f8fafc 100%)',
    boxShadow: '0 18px 36px rgba(29, 78, 216, 0.12)',
  },
  eyebrow: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  heading: {
    margin: '6px 0 0',
    fontSize: 30,
    lineHeight: 1.1,
    color: '#0f172a',
  },
  description: {
    margin: '10px 0 0',
    color: '#475569',
    maxWidth: 620,
    fontSize: 14,
  },
  searchRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    minWidth: 'min(420px, 100%)',
  },
  searchInput: {
    flex: 1,
    minWidth: 220,
    padding: '11px 14px',
    borderRadius: 14,
    border: '1px solid #93c5fd',
    background: '#ffffff',
    color: '#0f172a',
    boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.05)',
  },
  searchButton: {
    padding: '11px 16px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #0f4aa1 0%, #2563eb 100%)',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(37, 99, 235, 0.2)',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 14,
  },
  summaryCardPrimary: {
    padding: 18,
    borderRadius: 20,
    background: 'linear-gradient(140deg, #ffffff 0%, #eef4ff 100%)',
    border: '1px solid #dbeafe',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
  },
  summaryCardBlue: {
    padding: 18,
    borderRadius: 20,
    background: 'linear-gradient(140deg, #e0f2fe 0%, #ffffff 100%)',
    border: '1px solid #bae6fd',
    boxShadow: '0 12px 28px rgba(2, 132, 199, 0.08)',
  },
  summaryCardSky: {
    padding: 18,
    borderRadius: 20,
    background: 'linear-gradient(140deg, #ecfeff 0%, #ffffff 100%)',
    border: '1px solid #a5f3fc',
    boxShadow: '0 12px 28px rgba(6, 182, 212, 0.08)',
  },
  summaryCardMint: {
    padding: 18,
    borderRadius: 20,
    background: 'linear-gradient(140deg, #ecfdf5 0%, #ffffff 100%)',
    border: '1px solid #bbf7d0',
    boxShadow: '0 12px 28px rgba(22, 163, 74, 0.08)',
  },
  summaryCardAmber: {
    padding: 18,
    borderRadius: 20,
    background: 'linear-gradient(140deg, #fffbeb 0%, #ffffff 100%)',
    border: '1px solid #fde68a',
    boxShadow: '0 12px 28px rgba(245, 158, 11, 0.08)',
  },
  summaryCardRose: {
    padding: 18,
    borderRadius: 20,
    background: 'linear-gradient(140deg, #fff1f2 0%, #ffffff 100%)',
    border: '1px solid #fecdd3',
    boxShadow: '0 12px 28px rgba(225, 29, 72, 0.08)',
  },
  summaryLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  summaryValue: {
    marginTop: 12,
    color: '#0f172a',
    fontSize: 28,
    fontWeight: 900,
  },
  salaryBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    padding: '16px 18px',
    borderRadius: 18,
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
    color: '#ffffff',
    boxShadow: '0 16px 34px rgba(15, 23, 42, 0.18)',
  },
  salaryBannerLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.78)',
    fontWeight: 800,
  },
  salaryBannerValue: {
    fontSize: 24,
    fontWeight: 900,
  },
  error: {
    padding: 14,
    borderRadius: 16,
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
  },
  loading: {
    padding: 18,
    color: '#334155',
    fontWeight: 700,
  },
  tableShell: {
    overflowX: 'auto',
    borderRadius: 22,
    border: '1px solid #dbeafe',
    background: '#ffffff',
    boxShadow: '0 18px 44px rgba(15, 23, 42, 0.08)',
  },
  table: {
    width: '100%',
    minWidth: 1320,
    borderCollapse: 'collapse',
  },
  th: {
    padding: '14px 16px',
    textAlign: 'left',
    fontSize: 12,
    color: '#1e3a5f',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    background: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)',
    borderBottom: '1px solid #bfdbfe',
  },
  td: {
    padding: '14px 16px',
    color: '#334155',
    borderBottom: '1px solid #eff6ff',
    verticalAlign: 'top',
    fontSize: 13,
  },
  tdClient: {
    padding: '16px',
    color: '#0f172a',
    borderBottom: '1px solid #eff6ff',
    verticalAlign: 'top',
    background: 'linear-gradient(180deg, rgba(239,246,255,0.78) 0%, rgba(248,250,252,0.96) 100%)',
    minWidth: 220,
  },
  tdCenter: {
    padding: '14px 16px',
    color: '#334155',
    borderBottom: '1px solid #eff6ff',
    verticalAlign: 'top',
    textAlign: 'center',
  },
  tdStrong: {
    padding: '14px 16px',
    color: '#0f172a',
    fontWeight: 800,
    borderBottom: '1px solid #eff6ff',
    verticalAlign: 'top',
  },
  rowEven: {
    background: '#ffffff',
  },
  rowOdd: {
    background: '#f8fbff',
  },
  rowMuted: {
    background: '#ffffff',
  },
  clientName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
  },
  clientMeta: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    fontWeight: 700,
  },
  clientBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  clientBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    border: '1px solid transparent',
  },
  clientBadgeAmber: {
    background: '#fef3c7',
    color: '#92400e',
    borderColor: '#fde68a',
  },
  clientBadgeGreen: {
    background: '#dcfce7',
    color: '#166534',
    borderColor: '#bbf7d0',
  },
  clientBadgeRose: {
    background: '#ffe4e6',
    color: '#be123c',
    borderColor: '#fecdd3',
  },
  contactMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
  projectName: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0f172a',
  },
  projectRef: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
  countBubble: {
    display: 'inline-grid',
    placeItems: 'center',
    minWidth: 34,
    height: 34,
    padding: '0 10px',
    borderRadius: 999,
    background: '#dbeafe',
    color: '#1d4ed8',
    fontWeight: 900,
  },
  statusPill: {
    display: 'inline-grid',
    placeItems: 'center',
    minWidth: 34,
    height: 30,
    padding: '0 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: '1px solid transparent',
  },
  statusPillAmber: {
    background: '#fef3c7',
    color: '#92400e',
    borderColor: '#fde68a',
  },
  statusPillGreen: {
    background: '#dcfce7',
    color: '#166534',
    borderColor: '#bbf7d0',
  },
  statusPillRose: {
    background: '#ffe4e6',
    color: '#be123c',
    borderColor: '#fecdd3',
  },
  emptyRow: {
    padding: 24,
    textAlign: 'center',
    color: '#64748b',
    fontWeight: 700,
  },
}
