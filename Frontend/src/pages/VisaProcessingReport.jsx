import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

export default function VisaProcessingReport() {
  const [entries, setEntries] = useState([])
  const [totals, setTotals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({})
  const [error, setError] = useState('')
  const [subHeadBreakdown, setSubHeadBreakdown] = useState({})
  const [viewMode, setViewMode] = useState('reference')

  const parseAmount = (value) => {
    const normalized = String(value ?? '').replace(/[^0-9.-]/g, '')
    const amount = Number(normalized)
    return Number.isFinite(amount) ? amount : 0
  }

  const groupedEntries = useMemo(() => {
    const referenceMap = entries.reduce((acc, entry) => {
      const rawReference = entry.reference_name || entry.source || entry.candidate?.source || entry.candidate_source || 'Unknown Reference'
      const reference = String(rawReference || '').trim() || 'Unknown Reference'
      const candidateKey = entry.candidate_id || entry.candidate?.id || entry.candidate_name || entry.candidate?.full_name || 'unknown-candidate'
      const project = (entry.project_name || entry.project_number || '').trim() || 'unknown-project'
      const fee = parseAmount(entry.office_rate ?? entry.total_fee)
      const paid = parseAmount(entry.paid_amount ?? entry.paid ?? (entry.advance_1 || 0) + (entry.advance_2 || 0) + (entry.advance_3 || 0))
      const dedupeKey = `${candidateKey}||${project}||${fee}||${paid}`

      if (!acc[reference]) {
        acc[reference] = { entries: [], seen: new Set() }
      }

      if (acc[reference].seen.has(dedupeKey)) {
        return acc
      }

      acc[reference].seen.add(dedupeKey)
      acc[reference].entries.push(entry)
      return acc
    }, {})

    return Object.entries(referenceMap).map(([reference, group]) => ({ reference, entries: group.entries }))
  }, [entries])

  const candidateGroups = useMemo(() => {
    const map = {}

    entries.forEach((entry) => {
      const rawReference = entry.reference_name || entry.source || entry.candidate?.source || entry.candidate_source || 'Unknown Reference'
      const reference = String(rawReference || '').trim() || 'Unknown Reference'
      const candidateKey = entry.candidate_id || entry.candidate?.id || entry.candidate_name || entry.candidate?.full_name || `unknown-candidate-${entry.id}`
      const candidateName = entry.candidate_name || entry.candidate?.full_name || 'Unknown Candidate'
      const project = (entry.project_name || entry.project_number || '').trim() || 'Unknown Project'
      const officeRate = parseAmount(entry.office_rate ?? entry.total_fee)
      const paidAmount = parseAmount(entry.paid_amount ?? entry.paid ?? (entry.advance_1 || 0) + (entry.advance_2 || 0) + (entry.advance_3 || 0))
      const key = `${candidateKey}||${project}`

      if (!map[key]) {
        map[key] = {
          key,
          reference,
          candidateName,
          project,
          officeRate: 0,
          paidAmount: 0,
          dueAmount: 0,
        }
      }

      map[key].officeRate += officeRate
      map[key].paidAmount += paidAmount
      map[key].dueAmount = Math.max(0, map[key].officeRate - map[key].paidAmount)
    })

    return Object.values(map)
  }, [entries])

  const formattedTotals = useMemo(() => {
    const totalReceived = Number(totals?.total_received || 0)
    const totalDue = Number(totals?.total_due || 0)
    const totalCandidates = new Set(entries.map((entry) => String(entry.candidate_id || entry.candidate?.id || entry.candidate_name || entry.candidate?.full_name || '').trim() || `unknown-${entry.id}`)).size
    return {
      totalReferences: groupedEntries.length,
      totalCandidates,
      totalReceived,
      totalDue,
    }
  }, [entries, groupedEntries.length, totals])

  const load = async (p = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = { page: p, per_page: 50 }
      if (search) params.search = search
      if (country) params.country = country
      const res = await api.get('/candidate-flown', { params })
      setEntries(res.data.data.entries || [])
      setTotals(res.data.data.totals || null)
      setPagination(res.data.pagination || {})
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load Candidate Flown entries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load(page) }, [page])

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (country) params.set('country', country)

      const query = params.toString()
      const token = localStorage.getItem('token')
      const response = await fetch(`${api.defaults.baseURL}/candidate-flown/export${query ? `?${query}` : ''}`, {
        method: 'GET',
        headers: {
          Accept: 'text/csv',
          Authorization: token ? `Bearer ${token}` : '',
        },
      })

      if (!response.ok) {
        const text = await response.text()
        let message = 'Failed to export Candidate Flown CSV'
        try {
          const parsed = JSON.parse(text)
          message = parsed?.message || message
        } catch {
          if (text) message = text
        }
        throw new Error(message)
      }

      const disposition = response.headers.get('content-disposition') || ''
      const match = disposition.match(/filename\s*=\s*"?([^";]+)"?/) || disposition.match(/filename\*=UTF-8''([^;]+)/)
      const fileName = match ? decodeURIComponent(match[1]) : 'candidate_flown_export.csv'
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (e) {
      setError(e?.message || 'Failed to export Candidate Flown CSV')
    }
  }

  const renderBreakdownCell = (candidateId) => {
    const breakdown = subHeadBreakdown[candidateId]
    if (!breakdown) return '—'

    const items = breakdown.split('|').map((item) => item.trim()).filter(Boolean)
    if (items.length === 0) return '—'

    const chipPalette = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#ede9fe', '#cffafe']

    return (
      <div style={{ display: 'grid', gap: 5, maxWidth: 340 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {items.length} sub-head{items.length > 1 ? 's' : ''}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {items.map((item, index) => (
            <div
              key={`${candidateId}-${index}`}
              style={{
                padding: '4px 7px',
                borderRadius: 999,
                background: chipPalette[index % chipPalette.length],
                border: '1px solid rgba(59, 130, 246, 0.25)',
                fontSize: 10,
                color: '#1e3a8a',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                maxWidth: 310,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={item}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    )
  }

  useEffect(() => {
    const candidateIds = [...new Set(entries
      .map((entry) => entry?.candidate_id)
      .filter((value) => value != null && value !== ''))]

    if (candidateIds.length === 0) {
      setSubHeadBreakdown({})
      return
    }

    let isMounted = true

    const loadBreakdown = async () => {
      const breakdownMap = {}

      try {
        const daybookRes = await api.get('/daybook', {
          params: {
            type: 'receipt',
            page: 1,
            per_page: 500,
          },
        })

        const approvedEntries = Array.isArray(daybookRes?.data?.data?.entries) ? daybookRes.data.data.entries : []

        await Promise.all(candidateIds.map(async (candidateId) => {
          try {
            const res = await api.get('/sub-head-candidate-charges', {
              params: {
                candidate_id: candidateId,
                is_active: true,
              },
            })

            const rows = Array.isArray(res?.data?.data) ? res.data.data : []
            const tally = {}
            const linkLookup = new Map(rows.map((row) => [String(row?.id), row]))

            approvedEntries.forEach((entry) => {
              if (entry?.linked_module !== 'sub_head') return
              if (String(entry?.approval_status || 'pending').toLowerCase() === 'rejected') return

              const ref = String(entry?.sub_passport_number || '')
              const amount = Number(entry?.amount || 0)
              if (amount <= 0) return

              let linkedCandidateId = null
              let headLabel = entry?.expenseHead?.name || entry?.expense_head?.name || 'Sub Head'

              if (ref.startsWith('subhead_link:')) {
                const linkId = String(ref.replace('subhead_link:', ''))
                const matchedLink = linkLookup.get(linkId)
                if (matchedLink) {
                  linkedCandidateId = String(matchedLink.candidate_id || '')
                  headLabel = matchedLink?.expense_head?.name || matchedLink?.expenseHead?.name || matchedLink?.name || headLabel
                }
              } else if (ref.startsWith('candidate:')) {
                linkedCandidateId = String(ref.replace('candidate:', ''))
              }

              if (String(linkedCandidateId) !== String(candidateId)) return

              tally[headLabel] = (tally[headLabel] || 0) + amount
            })

            breakdownMap[candidateId] = Object.keys(tally).length > 0
              ? Object.entries(tally)
                .map(([name, value]) => `${name}: NPR Rs ${Number(value || 0).toLocaleString()}`)
                .join(' | ')
              : '—'
          } catch {
            breakdownMap[candidateId] = '—'
          }
        }))
      } catch {
        candidateIds.forEach((candidateId) => {
          breakdownMap[candidateId] = '—'
        })
      }

      if (isMounted) {
        setSubHeadBreakdown(breakdownMap)
      }
    }

    void loadBreakdown()

    return () => {
      isMounted = false
    }
  }, [entries])

  return (
    <SidebarLayout title="Candidate Flown Wise Report">
      <div style={{ padding: 12 }} className="reveal-up">
        <h2>Reference Report</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input placeholder="Search by reference, candidate, or project" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 220, padding: 8, borderRadius: 10, border: '1px solid #d1d5db' }} />
          <button onClick={() => void load(1)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Filter</button>
          <button onClick={handleExport} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer' }}>Export CSV</button>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button onClick={() => setViewMode('reference')} style={{ padding: '10px 16px', borderRadius: 10, border: viewMode === 'reference' ? '2px solid #1d4ed8' : '1px solid #cbd5e1', background: viewMode === 'reference' ? '#eff6ff' : '#fff', color: '#0f172a', cursor: 'pointer' }}>
              Reference View
            </button>
            <button onClick={() => setViewMode('candidate')} style={{ padding: '10px 16px', borderRadius: 10, border: viewMode === 'candidate' ? '2px solid #1d4ed8' : '1px solid #cbd5e1', background: viewMode === 'candidate' ? '#eff6ff' : '#fff', color: '#0f172a', cursor: 'pointer' }}>
              All Candidates
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: 16, borderRadius: 18, background: '#eff6ff', border: '1px solid #dbeafe' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>References</div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{formattedTotals.totalReferences}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: '#ecfdf5', border: '1px solid #d1fae5' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#047857' }}>Candidates</div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{formattedTotals.totalCandidates}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: '#fef3c7', border: '1px solid #fde047' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Total Received</div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>NPR Rs {formattedTotals.totalReceived.toLocaleString()}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: '#fee2e2', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>Total Due</div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>NPR Rs {formattedTotals.totalDue.toLocaleString()}</div>
          </div>
        </div>


        {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
        {loading ? (
          <div>Loading Candidate Flown entries...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                  <th style={{ padding: 12 }}>Reference Name</th>
                  <th style={{ padding: 12 }}>Candidate</th>
                  <th style={{ padding: 12 }}>Project Assigned</th>
                  <th style={{ padding: 12 }}>Office Rate</th>
                  <th style={{ padding: 12 }}>Paid Amount</th>
                  <th style={{ padding: 12 }}>Due Amount</th>
                </tr>
              </thead>
              <tbody>
                {viewMode === 'reference' && groupedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, color: '#6b7280' }}>No reference report entries found.</td>
                  </tr>
                ) : viewMode === 'candidate' && candidateGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, color: '#6b7280' }}>No candidate report entries found.</td>
                  </tr>
                ) : viewMode === 'reference' ? (
                  groupedEntries.map((group) => (
                    group.entries.map((e, index) => {
                      const paidAmount = parseAmount(e.paid_amount ?? e.paid ?? (e.advance_1 || 0) + (e.advance_2 || 0) + (e.advance_3 || 0))
                      const totalFee = parseAmount(e.total_fee ?? e.office_rate)
                      const dueAmount = Math.max(0, totalFee - paidAmount)
                      const paidColor = paidAmount > 0 ? '#16a34a' : '#0f172a'
                      const dueColor = dueAmount > 0 ? '#dc2626' : '#16a34a'
                      return (
                        <tr key={`${group.reference}-${e.id}-${index}`} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          {index === 0 && (
                            <td style={{ padding: 12, fontWeight: 700 }} rowSpan={group.entries.length}>{group.reference}</td>
                          )}
                          <td style={{ padding: 12 }}>{e.candidate_name || e.candidate?.full_name}</td>
                          <td style={{ padding: 12 }}>{e.project_name || e.project_number || '-'}</td>
                          <td style={{ padding: 12 }}>{totalFee > 0 ? `NPR Rs ${totalFee.toLocaleString()}` : '-'}</td>
                          <td style={{ padding: 12, color: paidColor, fontWeight: 700 }}>NPR Rs {paidAmount.toLocaleString()}</td>
                          <td style={{ padding: 12, color: dueColor, fontWeight: 700 }}>NPR Rs {dueAmount.toLocaleString()}</td>
                        </tr>
                      )
                    })
                  ))
                ) : (
                  candidateGroups.map((group, index) => {
                    const paidColor = group.paidAmount > 0 ? '#16a34a' : '#0f172a'
                    const dueColor = group.dueAmount > 0 ? '#dc2626' : '#16a34a'
                    return (
                      <tr key={`${group.key}-${index}`} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: 12 }}>{group.reference}</td>
                        <td style={{ padding: 12 }}>{group.candidateName}</td>
                        <td style={{ padding: 12 }}>{group.project}</td>
                        <td style={{ padding: 12 }}>{group.officeRate > 0 ? `NPR Rs ${group.officeRate.toLocaleString()}` : '-'}</td>
                        <td style={{ padding: 12, color: paidColor, fontWeight: 700 }}>NPR Rs {group.paidAmount.toLocaleString()}</td>
                        <td style={{ padding: 12, color: dueColor, fontWeight: 700 }}>NPR Rs {group.dueAmount.toLocaleString()}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            {pagination.last_page > 1 && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button disabled={pagination.current_page <= 1} onClick={() => setPage((p) => Math.max(1, p-1))}>Prev</button>
                <div>Page {pagination.current_page} / {pagination.last_page}</div>
                <button disabled={pagination.current_page >= pagination.last_page} onClick={() => setPage((p) => Math.min(pagination.last_page, p+1))}>Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
