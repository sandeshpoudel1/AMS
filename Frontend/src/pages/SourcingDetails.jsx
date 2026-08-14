import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const getSingleReferenceName = (value) => {
  const source = String(value || '').trim()
  if (!source) return 'Unknown Reference'

  const splitCandidates = source
    .split(/[|,/;]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  return splitCandidates[0] || source
}

export default function SourcingDetails() {
  const [references, setReferences] = useState([])
  const [candidates, setCandidates] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [referenceFilter, setReferenceFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadReferences = async () => {
    setLoading(true)
    try {
      const response = await api.get('/reference-sources')
      setReferences(Array.isArray(response?.data?.data) ? response.data.data : [])
    } catch {
      // ignore failures here; page can still render
    } finally {
      setLoading(false)
    }
  }

  const loadCandidates = async () => {
    setCandidatesLoading(true)
    try {
      const response = await api.get('/candidates', { params: { per_page: 500 } })
      setCandidates(Array.isArray(response?.data?.data?.candidates) ? response.data.data.candidates : [])
    } catch {
      // ignore failures here; page can still render
    } finally {
      setCandidatesLoading(false)
    }
  }

  const loadProjects = async () => {
    try {
      const res = await api.get('/project-settings', { params: { per_page: 1000 } })
      setProjects(Array.isArray(res?.data?.data) ? res.data.data : [])
    } catch {
      setProjects([])
    }
  }

  const handleDeleteCandidate = async (candidateId) => {
    // Replace delete with toggle active/inactive
    if (!window.confirm('Change active state for this candidate?')) return

    try {
      // Find candidate current state
      const candidate = candidates.find((c) => String(c.id) === String(candidateId))
      const isActive = candidate?.is_active === undefined ? (candidate?.isActive ?? true) : candidate.is_active
      await api.post(`/candidates/${candidateId}/${isActive ? 'deactivate' : 'activate'}`)
      setSuccess(`Candidate ${isActive ? 'deactivated' : 'activated'} successfully`)
      setError('')
      void loadCandidates()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change candidate active state')
      setSuccess('')
    }
  }

  useEffect(() => {
    void loadReferences()
    void loadCandidates()
    void loadProjects()
  }, [])

  const referenceMap = useMemo(() => {
    return references.reduce((acc, reference) => {
      const key = String(reference.reference_name || '').trim().toLowerCase()
      if (!key) return acc
      acc[key] = reference
      return acc
    }, {})
  }, [references])

  const sourcingRows = useMemo(() => {
    if (references.length === 0 || candidates.length === 0) return []

    return candidates
      .map((candidate) => {
        // prefer project settings country when available
        const projectId = candidate.project_id || candidate.project?.id || null
        const projectFromList = projectId ? projects.find((p) => String(p.id) === String(projectId)) : null
        const candidateReference = String(candidate.source || candidate.reference_name || '').trim().toLowerCase()
        const matchedReference = referenceMap[candidateReference]
        if (!matchedReference) return null

        return {
          id: candidate.id,
          referenceName: getSingleReferenceName(matchedReference.reference_name || candidate.source || candidate.reference_name || 'Unknown Reference'),
          candidateName: candidate.full_name || candidate.name || 'Unknown Candidate',
          passportNumber: candidate.passport_number || candidate.passport || '-',
          projectName: candidate.project?.project_name || candidate.project_name || candidate.project_number || 'No Project',
          tradeName: candidate.project?.trade || candidate.project?.trade_name || candidate.project_trade || '-',
          country: (projectFromList && projectFromList.country) || candidate.project?.country || candidate.project?.client?.country || candidate.client_country || '-',
          officeRate: (projectFromList && (projectFromList.office_rate_per_trade || projectFromList.office_rate)) || candidate.project?.office_rate_per_trade || candidate.office_rate || candidate.project?.office_rate || null,
          paidAmount: Number(candidate.paid_amount ?? candidate.paid ?? 0),
          remainingAmount: (function () {
            const rate = Number(candidate.project?.office_rate_per_trade || candidate.office_rate || candidate.project?.office_rate || 0)
            const paid = Number(candidate.paid_amount ?? candidate.paid ?? 0)
            return Number.isFinite(rate) ? Math.max(0, rate - paid) : null
          })(),
          candidateStatus: candidate.status || '-',
          isActive: candidate.is_active === undefined ? (candidate.isActive ?? true) : candidate.is_active,
          projectStatus: projectFromList ? projectFromList.is_active !== false : candidate.project?.is_active !== false,
        }
      })
      .filter(Boolean)
  }, [candidates, referenceMap])

  const referenceCounts = useMemo(() => {
    return sourcingRows.reduce((acc, row) => {
      if (!row.referenceName) return acc
      acc[row.referenceName] = (acc[row.referenceName] || 0) + 1
      return acc
    }, {})
  }, [sourcingRows])

  const filteredRows = useMemo(() => {
    const query = String(searchQuery).trim().toLowerCase()
    return sourcingRows.filter((row) => {
      const matchesReference = !referenceFilter || row.referenceName === referenceFilter
      const matchesQuery = !query || [row.candidateName, row.projectName, row.passportNumber]
        .some((value) => String(value || '').toLowerCase().includes(query))
      return matchesReference && matchesQuery
    })
  }, [sourcingRows, referenceFilter, searchQuery])

  const selectedReferenceCount = useMemo(() => {
    if (!referenceFilter) return sourcingRows.length
    return sourcingRows.filter((row) => row.referenceName === referenceFilter).length
  }, [sourcingRows, referenceFilter])

  const formatAmount = (amount) => {
    if (amount == null || amount === '') return '-'
    const numeric = Number(amount)
    return Number.isFinite(numeric) ? `NPR ${numeric.toLocaleString()}` : '-'
  }

  const handleExportCsv = () => {
    if (!filteredRows.length) return

    const headers = [
      'Reference Name',
      'Candidate Name',
      'Passport Number',
      'Project Name',
      'Trade Name',
      'Country',
      'Office Rate',
      'Paid Amount',
      'Remaining',
      'Candidate Status',
      'Candidate Active',
      'Project Active',
    ]

    const rows = filteredRows.map((row) => [
      row.referenceName,
      row.candidateName,
      row.passportNumber,
      row.projectName,
      row.tradeName,
      row.country,
      row.officeRate ?? '',
      row.paidAmount ?? '',
      row.remainingAmount ?? '',
      row.candidateStatus,
      row.isActive ? 'Active' : 'Inactive',
      row.projectStatus ? 'Active' : 'Inactive',
    ])

    const csvContent = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sourcing-details-${referenceFilter ? referenceFilter.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'all'}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <SidebarLayout title="Sourcing details">
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div>
            <div style={styles.kicker}>Reports</div>
            <h2 style={styles.heroTitle}>Sourcing details</h2>
            <p style={styles.heroText}>View candidates sourced by each reference with related project, trade, country and status.</p>
          </div>
        </div>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Sourcing details</h3>
              <p style={styles.panelText}>This report shows candidates joined to saved reference sources.</p>
            </div>
            <button type="button" style={styles.exportButton} onClick={handleExportCsv}>
              Export CSV
            </button>
          </div>
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <div style={styles.controls}>
            <div style={styles.filterPanel}>
              <div style={styles.filterField}>
                <label style={styles.filterLabel}>Reference</label>
                <select style={styles.filterInput} value={referenceFilter} onChange={(e) => setReferenceFilter(e.target.value)}>
                  <option value="">All references</option>
                  {Object.entries(referenceCounts)
                    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                    .map(([name, count]) => (
                      <option key={name} value={name}>
                        {name} ({count})
                      </option>
                    ))}
                </select>
              </div>

              <div style={styles.filterField}>
                <label style={styles.filterLabel}>Search</label>
                <input
                  style={styles.filterInput}
                  placeholder="Search by project, candidate or passport"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div style={styles.summaryBar}>
              <span style={styles.summaryText}>
                {referenceFilter
                  ? `${referenceFilter} has ${selectedReferenceCount} candidate${selectedReferenceCount === 1 ? '' : 's'}`
                  : `Showing ${filteredRows.length} candidate${filteredRows.length === 1 ? '' : 's'} across ${Object.keys(referenceCounts).length} reference${Object.keys(referenceCounts).length === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>

          {loading || candidatesLoading ? (
            <div style={styles.emptyState}>Loading sourcing details...</div>
          ) : filteredRows.length === 0 ? (
            <div style={styles.emptyState}>No sourcing rows found for the current references.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Reference</th>
                    <th style={styles.th}>Candidate</th>
                    <th style={styles.th}>Passport</th>
                    <th style={styles.th}>Project</th>
                    <th style={styles.th}>Trade</th>
                    <th style={styles.th}>Country</th>
                    <th style={{ ...styles.th, ...styles.officeRateHead }}>Office Rate</th>
                    <th style={{ ...styles.th, ...styles.paidAmountHead }}>Paid</th>
                    <th style={{ ...styles.th, ...styles.remainingHead }}>Remaining</th>
                    <th style={styles.th}>Candidate Status</th>
                    <th style={styles.th}>Project Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} style={styles.tr}>
                      <td style={styles.td}><span style={styles.referenceBadge}>{row.referenceName}</span></td>
                      <td style={styles.td}><strong>{row.candidateName}</strong></td>
                      <td style={styles.td}>{row.passportNumber}</td>
                      <td style={styles.td}>{row.projectName}</td>
                      <td style={styles.td}>{row.tradeName}</td>
                      <td style={styles.td}>{row.country}</td>
                      <td style={{ ...styles.td, ...styles.officeRateCell }}>{formatAmount(row.officeRate)}</td>
                      <td style={{ ...styles.td, ...styles.paidAmountCell }}>{formatAmount(row.paidAmount)}</td>
                      <td style={{ ...styles.td, ...styles.remainingCell }}>{row.remainingAmount == null ? '-' : formatAmount(row.remainingAmount)}</td>
                      <td style={styles.td}><span style={row.candidateStatus?.toLowerCase() === 'selected' ? styles.statusPillGreen : row.candidateStatus?.toLowerCase() === 'rejected' ? styles.statusPillRed : row.candidateStatus?.toLowerCase() === 'deployed' ? styles.statusPillBlue : styles.statusPillGray}>{row.candidateStatus}</span></td>
                      <td style={styles.td}><span style={row.projectStatus ? styles.statusPillGreen : styles.statusPillRed}>{row.projectStatus ? 'Active' : 'Inactive'}</span></td>
                      <td style={styles.td}>
                        <button type="button" style={row.isActive ? styles.activeButton : styles.inactiveButton} onClick={() => handleDeleteCandidate(row.id)}>
                          {row.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </SidebarLayout>
  )
}

const styles = {
  shell: { display: 'flex', flexDirection: 'column', gap: 20 },
  hero: { background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 70%, #334155 100%)', color: '#fff', borderRadius: 20, padding: 24, display: 'flex', justifyContent: 'space-between', gap: 24, boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)' },
  kicker: { textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 12, opacity: 0.75, marginBottom: 8 },
  heroTitle: { margin: 0, fontSize: 30, lineHeight: 1.1 },
  heroText: { margin: '10px 0 0', maxWidth: 680, color: 'rgba(255,255,255,0.84)', fontSize: 14, lineHeight: 1.6 },
  panel: { background: '#f8fbff', borderRadius: 18, padding: 20, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', border: '1px solid #e2e8f0' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 },
  panelTitle: { margin: 0, fontSize: 18, color: '#0f172a' },
  panelText: { margin: '6px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.5 },
  exportButton: { border: 'none', background: 'linear-gradient(135deg, #0f766e 0%, #10b981 100%)', color: '#fff', fontWeight: 700, padding: '10px 16px', borderRadius: 12, cursor: 'pointer', boxShadow: '0 10px 18px rgba(16, 185, 129, 0.2)' },
  controls: { display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 },
  filterPanel: { display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 16, alignItems: 'flex-end' },
  filterField: { display: 'flex', flexDirection: 'column', gap: 6 },
  filterLabel: { fontSize: 12, fontWeight: 700, color: '#334155' },
  filterInput: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 12, background: '#fff', fontSize: 13, color: '#0f172a' },
  summaryBar: { padding: '14px 18px', borderRadius: 14, border: '1px solid #dbe5f0', background: '#ffffff', color: '#0f172a' },
  summaryText: { fontSize: 13, fontWeight: 700 },
  tableWrap: { overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 14px', fontSize: 13, color: '#334155' },
  referenceBadge: { display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: '#eef2ff', color: '#3730a3', fontWeight: 700 },
  statusPillGreen: { display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: '#dcfce7', color: '#166534', fontWeight: 700 },
  statusPillRed: { display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', fontWeight: 700 },
  statusPillBlue: { display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 },
  statusPillGray: { display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: '#e2e8f0', color: '#334155', fontWeight: 700 },
  activeButton: { padding: '7px 12px', borderRadius: 10, background: '#dcfce7', color: '#166534', border: '1px solid #86efac', cursor: 'pointer', fontWeight: 700 },
  inactiveButton: { padding: '7px 12px', borderRadius: 10, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: 700 },
  emptyState: { padding: '28px 12px', textAlign: 'center', color: '#64748b' },
}

styles.officeRateHead = { color: '#92400e' }
styles.paidAmountHead = { color: '#065f46' }
styles.remainingHead = { color: '#b91c1c' }
styles.officeRateCell = { color: '#92400e', fontWeight: 700 }
styles.paidAmountCell = { color: '#059669', fontWeight: 700 }
styles.remainingCell = { color: '#dc2626', fontWeight: 700 }
