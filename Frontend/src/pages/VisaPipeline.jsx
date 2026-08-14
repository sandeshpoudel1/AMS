import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const formatCurrency = (value) => `NPR Rs ${Number(value || 0).toLocaleString()}`

const COLUMN_PREFS_KEY = 'mopl.candidate_flown.columns.v1'
const DEFAULT_COLUMNS = [
  { id: 'candidate_id', label: 'Candidate ID' },
  { id: 'candidate', label: 'Candidate' },
  { id: 'passport', label: 'Passport' },
  { id: 'company', label: 'Company' },
  { id: 'project', label: 'Project' },
  { id: 'country', label: 'Country' },
  { id: 'trade', label: 'Trade' },
  { id: 'office_rate', label: 'Office Rate' },
  { id: 'paid', label: 'Total Paid' },
  { id: 'sub_head_booked', label: 'Sub Head Booked' },
  { id: 'total_due', label: 'Total Due' },
  { id: 'remaining', label: 'Remaining' },
  { id: 'actions', label: 'Actions' },
]

const getDefaultColumnOrder = () => DEFAULT_COLUMNS.map((col) => col.id)

const readColumnPrefs = () => {
  if (typeof window === 'undefined') {
    return {
      order: getDefaultColumnOrder(),
      hidden: [],
    }
  }

  try {
    const raw = localStorage.getItem(COLUMN_PREFS_KEY)
    if (!raw) {
      return {
        order: getDefaultColumnOrder(),
        hidden: [],
      }
    }

    const parsed = JSON.parse(raw)
    const known = new Set(getDefaultColumnOrder())
    const parsedOrder = Array.isArray(parsed?.order) ? parsed.order.filter((id) => known.has(id)) : []
    const appendedDefaults = getDefaultColumnOrder().filter((id) => !parsedOrder.includes(id))
    const finalOrder = [...parsedOrder, ...appendedDefaults]
    const hidden = Array.isArray(parsed?.hidden)
      ? parsed.hidden.filter((id) => known.has(id))
      : []

    return {
      order: finalOrder,
      hidden,
    }
  } catch {
    return {
      order: getDefaultColumnOrder(),
      hidden: [],
    }
  }
}

export default function VisaPipeline() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [totals, setTotals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({})
  const [error, setError] = useState('')
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [subHeadModules, setSubHeadModules] = useState([])
  const [configuredSubHeads, setConfiguredSubHeads] = useState([])
  const [bookedSubHeadAmounts, setBookedSubHeadAmounts] = useState({})
  const [showColumnManager, setShowColumnManager] = useState(false)
  const [columnOrder, setColumnOrder] = useState(() => readColumnPrefs().order)
  const [hiddenColumns, setHiddenColumns] = useState(() => readColumnPrefs().hidden)
  const [sortField, setSortField] = useState('candidate_id')
  const [sortDirection, setSortDirection] = useState('asc')

  const columnsById = DEFAULT_COLUMNS.reduce((map, column) => {
    map[column.id] = column
    return map
  }, {})

  const orderedColumns = columnOrder
    .map((id) => columnsById[id])
    .filter(Boolean)

  const visibleColumns = orderedColumns.filter((column) => !hiddenColumns.includes(column.id))

  const visibleColumnCount = visibleColumns.length

  const load = async (p = 1) => {
    setLoading(true)
    setError('')

    try {
      const params = { page: p, per_page: 50 }
      if (search) params.search = search
      const res = await api.get('/candidate-flown', { params })
      setEntries(res.data.data.entries || [])
      setTotals(res.data.data.totals || null)
      setPagination(res.data.pagination || {})
      if (selectedEntry) {
        const updated = (res.data.data.entries || []).find((entry) => String(entry.id) === String(selectedEntry.id))
        setSelectedEntry(updated || null)
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load Candidate Flown entries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load(page) }, [page])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify({
      order: columnOrder,
      hidden: hiddenColumns,
    }))
  }, [columnOrder, hiddenColumns])

  const handleSearch = (e) => {
    if (e) e.preventDefault()
    setPage(1)
    void load(1)
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)

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

  const handleSelect = (entry) => {
    setSelectedEntry(entry)
  }

  const moveColumnByOffset = (columnId, direction) => {
    setColumnOrder((prev) => {
      const currentIndex = prev.indexOf(columnId)
      if (currentIndex === -1) return prev

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= prev.length) return prev

      const next = [...prev]
      const [moved] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const toggleColumnVisibility = (columnId) => {
    setHiddenColumns((prev) => {
      const isHidden = prev.includes(columnId)
      if (isHidden) {
        return prev.filter((id) => id !== columnId)
      }

      if (visibleColumnCount <= 1) return prev
      return [...prev, columnId]
    })
  }

  const clearHiddenColumns = () => setHiddenColumns([])

  const resetColumnOrder = () => setColumnOrder(getDefaultColumnOrder())

  const moveColumn = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return

    setColumnOrder((prev) => {
      const sourceIndex = prev.indexOf(sourceId)
      const targetIndex = prev.indexOf(targetId)
      if (sourceIndex === -1 || targetIndex === -1) return prev

      const next = prev.filter((id) => id !== sourceId)
      const insertIndex = next.indexOf(targetId)
      next.splice(insertIndex, 0, sourceId)
      return next
    })
  }

  const handleColumnDragStart = (columnId, event) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', columnId)
  }

  const handleColumnDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleColumnDrop = (targetId, event) => {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain')
    moveColumn(sourceId, targetId)
  }

  const handleDeleteEntry = async (entry) => {
    if (!entry?.id) return
    if (!window.confirm('Delete this Candidate Flown entry?')) return

    try {
      await api.delete(`/candidate-flown/${entry.id}`)
      setError('')
      void load(page)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete Candidate Flown entry')
    }
  }

  const handleSort = (columnId) => {
    if (columnId === 'candidate') {
      if (sortField === 'candidate_name') {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField('candidate_name')
        setSortDirection('asc')
      }
      return
    }

    if (columnId === 'project') {
      if (sortField === 'project_number') {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField('project_number')
        setSortDirection('asc')
      }
      return
    }

    if (columnId === 'paid') {
      if (sortField === 'paid_amount') {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField('paid_amount')
        setSortDirection('asc')
      }
      return
    }

    if (columnId === 'total_due') {
      if (sortField === 'total_due_amount') {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField('total_due_amount')
        setSortDirection('desc')
      }
      return
    }

    if (columnId === 'passport') {
      if (sortField === 'passport_number') {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField('passport_number')
        setSortDirection('asc')
      }
      return
    }

    if (columnId === 'candidate_id' || columnId === 'id') {
      if (sortField === 'candidate_id') {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField('candidate_id')
        setSortDirection('asc')
      }
    }
  }

  const sortIndicator = (columnId) => {
    const fieldMap = {
      candidate: 'candidate_name',
      project: 'project_number',
      paid: 'paid_amount',
      total_due: 'total_due_amount',
      passport: 'passport_number',
      candidate_id: 'candidate_id',
    }

    const lookupField = fieldMap[columnId] || ''
    if (sortField !== lookupField) return '↕'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const loadConfiguredSubHeads = async () => {
    try {
      const res = await api.get('/expense-heads')
      setConfiguredSubHeads(Array.isArray(res?.data?.data) ? res.data.data.filter((row) => row?.is_active !== false) : [])
    } catch {
      setConfiguredSubHeads([])
    }
  }

  const loadSubHeadModules = async (candidateId) => {
    if (!candidateId) {
      setSubHeadModules([])
      return
    }

    try {
      const res = await api.get('/sub-head-candidate-charges', {
        params: {
          candidate_id: candidateId,
          is_active: true,
        },
      })
      setSubHeadModules(Array.isArray(res?.data?.data) ? res.data.data : [])
    } catch {
      setSubHeadModules([])
    }
  }

  const loadBookedSubHeadAmounts = async (candidateId) => {
    if (!candidateId) {
      setBookedSubHeadAmounts({})
      return
    }

    try {
      const res = await api.get('/daybook', {
        params: {
          page: 1,
          per_page: 500,
        },
      })

      const entries = Array.isArray(res?.data?.data?.entries) ? res.data.data.entries : []
      const tally = {}

      entries.forEach((entry) => {
        if (entry?.linked_module !== 'sub_head') return
        if (entry?.approval_status === 'rejected') return

        const ref = String(entry?.sub_passport_number || '')
        const amount = Number(entry?.amount || 0)
        if (amount <= 0) return

        let linkedCandidateId = null
        let linkedHeadId = entry?.expense_head_id != null ? String(entry.expense_head_id) : ''

        if (ref.startsWith('subhead_link:')) {
          const linkId = String(ref.replace('subhead_link:', ''))
          const matchedLink = subHeadModules.find((item) => String(item.id) === linkId)
          if (matchedLink) {
            linkedCandidateId = String(matchedLink.candidate_id || '')
            linkedHeadId = String(matchedLink.expense_head_id || linkedHeadId)
          }
        } else if (ref.startsWith('candidate:')) {
          linkedCandidateId = String(ref.replace('candidate:', ''))
        }

        if (!linkedCandidateId || String(linkedCandidateId) !== String(candidateId)) return
        if (!linkedHeadId) return

        tally[linkedHeadId] = (tally[linkedHeadId] || 0) + amount
      })

      setBookedSubHeadAmounts(tally)
    } catch {
      setBookedSubHeadAmounts({})
    }
  }

  useEffect(() => {
    void loadConfiguredSubHeads()
  }, [])

  useEffect(() => {
    void loadSubHeadModules(selectedEntry?.candidate_id)
  }, [selectedEntry?.candidate_id])

  useEffect(() => {
    if (!selectedEntry?.candidate_id) {
      setBookedSubHeadAmounts({})
      return
    }

    void loadBookedSubHeadAmounts(selectedEntry.candidate_id)
  }, [selectedEntry?.candidate_id, subHeadModules])

  const totalReceived = Number(selectedEntry?.paid_amount ?? (Number(selectedEntry?.advance_1 || 0) + Number(selectedEntry?.advance_2 || 0) + Number(selectedEntry?.advance_3 || 0)))
  const totalFee = Number(selectedEntry?.total_fee || selectedEntry?.office_rate || 0)
  const totalDue = totalFee - totalReceived
  const subHeadBookedAmount = Number(selectedEntry?.sub_head_booked_amount || 0)
  const remainingDue = totalDue - subHeadBookedAmount
  const selectedSubHeadCards = configuredSubHeads.map((head) => ({
    label: head?.name || 'Sub Head Module',
    value: Number(bookedSubHeadAmounts[String(head?.id)] || 0),
  })).filter((card) => card.label)

  const formatOfficeRate = (value) => {
    const amount = Number(value || 0)
    return amount > 0 ? formatCurrency(amount) : '—'
  }

  const dedupedEntries = Object.values(entries.reduce((map, entry) => {
    const key = String(entry.candidate_id || entry.id || '')
    if (!key) return map

    const existing = map[key]
    if (!existing || new Date(entry.created_at || 0) > new Date(existing.created_at || 0)) {
      map[key] = entry
    }
    return map
  }, {}))

  const sortedDedupedEntries = useMemo(() => {
    const rows = [...dedupedEntries]

    rows.sort((a, b) => {
      if (sortField === 'candidate_id') {
        return Number(a.candidate_id || a.id || 0) - Number(b.candidate_id || b.id || 0)
      }

      if (sortField === 'candidate_name') {
        const aName = String(a.candidate_name || '').trim().toLowerCase()
        const bName = String(b.candidate_name || '').trim().toLowerCase()
        return aName.localeCompare(bName)
      }

      if (sortField === 'project_number') {
        const aProject = String(a.project_number || '').trim().toLowerCase()
        const bProject = String(b.project_number || '').trim().toLowerCase()
        return aProject.localeCompare(bProject)
      }

      if (sortField === 'passport_number') {
        const aPassport = String(a.passport_number || '').trim().toLowerCase()
        const bPassport = String(b.passport_number || '').trim().toLowerCase()
        return aPassport.localeCompare(bPassport)
      }

      if (sortField === 'paid_amount') {
        return Number(a.paid_amount ?? (Number(a.advance_1 || 0) + Number(a.advance_2 || 0) + Number(a.advance_3 || 0))) - Number(b.paid_amount ?? (Number(b.advance_1 || 0) + Number(b.advance_2 || 0) + Number(b.advance_3 || 0)))
      }

      if (sortField === 'total_due_amount') {
        const aTotal = Number(a.total_fee || a.office_rate || 0) - Number(a.paid_amount ?? (Number(a.advance_1 || 0) + Number(a.advance_2 || 0) + Number(a.advance_3 || 0)))
        const bTotal = Number(b.total_fee || b.office_rate || 0) - Number(b.paid_amount ?? (Number(b.advance_1 || 0) + Number(b.advance_2 || 0) + Number(b.advance_3 || 0)))
        return aTotal - bTotal
      }

      return 0
    })

    return sortDirection === 'asc' ? rows : rows.reverse()
  }, [dedupedEntries, sortDirection, sortField])

  const uniqueCandidatesCount = dedupedEntries.length

  return (
    <SidebarLayout title="Candidate Flown">
      <div style={styles.container}>
        {error && <div style={{ ...styles.alert, ...styles.alertError }}>{error}</div>}

        {totals && (
          <div style={styles.summaryRow}>
            <div style={{ ...styles.summaryCard, borderLeft: '4px solid #1e3a5f' }}>
              <div style={styles.summaryLabel}>Total Candidates</div>
              <div style={styles.summaryValue}>{uniqueCandidatesCount}</div>
            </div>
            <div style={{ ...styles.summaryCard, borderLeft: '4px solid #92400e' }}>
              <div style={styles.summaryLabel}>Total Fees</div>
              <div style={styles.summaryValue}>{formatCurrency(totals.total_fee)}</div>
            </div>
            <div style={{ ...styles.summaryCard, borderLeft: '4px solid #047857' }}>
              <div style={styles.summaryLabel}>Total Received</div>
              <div style={styles.summaryValue}>{formatCurrency(totals.total_received)}</div>
            </div>
            <div style={{ ...styles.summaryCard, borderLeft: '4px solid #b45309' }}>
              <div style={styles.summaryLabel}>Total Sub Head Booked</div>
              <div style={styles.summaryValue}>{formatCurrency(totals.total_sub_head_booked_amount)}</div>
            </div>
            <div style={{ ...styles.summaryCard, borderLeft: '4px solid #be123c' }}>
              <div style={styles.summaryLabel}>Total Due</div>
              <div style={styles.summaryValue}>{formatCurrency(totals.total_due)}</div>
            </div>
          </div>
        )}

        <div style={styles.toolbar}>
          <form onSubmit={handleSearch} style={styles.searchRow}>
            <input
              style={styles.searchInput}
              placeholder="Search by name, passport, project, company, or country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" style={styles.searchBtn}>Search</button>
          </form>
          <button type="button" style={styles.columnsBtn} onClick={handleExport}>Export CSV</button>
          <button
            type="button"
            style={styles.columnsBtn}
            onClick={() => setShowColumnManager((prev) => !prev)}
          >
            {showColumnManager ? 'Close Columns' : 'Columns'}
          </button>
        </div>

        {showColumnManager ? (
          <div style={styles.columnManager}>
            <div style={styles.columnManagerTitle}>Manage Table Columns</div>
            <div style={styles.columnManagerSubTitle}>Hide/unhide columns and change order.</div>
            <div style={styles.columnList}>
              {orderedColumns.map((column, index) => {
                const isHidden = hiddenColumns.includes(column.id)
                return (
                  <div key={column.id} style={styles.columnItem}>
                    <label style={styles.columnCheckboxLabel}>
                      <input
                        type="checkbox"
                        checked={!isHidden}
                        onChange={() => toggleColumnVisibility(column.id)}
                      />
                      <span>{column.label}</span>
                    </label>
                    <div style={styles.columnItemActions}>
                      <button
                        type="button"
                        style={styles.columnActionBtn}
                        disabled={index === 0}
                        onClick={() => moveColumnByOffset(column.id, 'up')}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        style={styles.columnActionBtn}
                        disabled={index === orderedColumns.length - 1}
                        onClick={() => moveColumnByOffset(column.id, 'down')}
                      >
                        Down
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {selectedEntry ? (
          <div style={styles.detailCard}>
            <div style={styles.detailHeader}>
              <div>
                <div style={styles.detailTitle}>Selected Candidate</div>
                <div style={styles.detailSubtitle}>{selectedEntry.candidate_name || 'Unknown candidate'}</div>
              </div>
              <div style={styles.detailStatus}>{selectedEntry.is_payment_booked ? 'Payment Booked' : 'Pending Booked'}</div>
            </div>

            <div style={styles.detailGrid}>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Passport</div>
                <div style={styles.detailValue}>{selectedEntry.passport_number || '—'}</div>
              </div>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Company</div>
                <div style={styles.detailValue}>{selectedEntry.company_name || '—'}</div>
              </div>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Project</div>
                <div style={styles.detailValue}>{selectedEntry.project_number || '—'}</div>
              </div>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Trade</div>
                <div style={styles.detailValue}>{selectedEntry.project_trade || '—'}</div>
              </div>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Country</div>
                <div style={styles.detailValue}>{selectedEntry.country || '—'}</div>
              </div>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Office Rate</div>
                <div style={styles.detailValue}>{formatOfficeRate(selectedEntry.office_rate || selectedEntry.total_fee)}</div>
              </div>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Total Fee</div>
                <div style={styles.detailValue}>{formatCurrency(totalFee)}</div>
              </div>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Total Received</div>
                <div style={styles.detailValue}>{formatCurrency(totalReceived)}</div>
              </div>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Total Due</div>
                <div style={styles.detailValue}>{formatCurrency(totalDue)}</div>
              </div>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Remaining Due</div>
                <div style={styles.detailValue}>{formatCurrency(remainingDue)}</div>
              </div>
              <div style={styles.detailField}>
                <div style={styles.detailLabel}>Flight Date</div>
                <div style={styles.detailValue}>{selectedEntry.flight_date ? new Date(selectedEntry.flight_date).toLocaleDateString('en-GB') : '—'}</div>
              </div>
            </div>

            <div style={styles.subHeadModuleGrid}>
              {selectedSubHeadCards.length > 0 ? selectedSubHeadCards.map((field) => (
                <div key={field.label} style={styles.subHeadModuleCard}>
                  <div style={styles.subHeadModuleLabel}>{field.label}</div>
                  <div style={styles.subHeadModuleValue}>{formatCurrency(field.value)}</div>
                </div>
              )) : (
                <div style={styles.detailField}>
                  <div style={styles.detailLabel}>Sub Head Modules</div>
                  <div style={styles.detailValue}>No configured sub-head modules</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.emptyCard}>Select a candidate from the list below to see Candidate Flown details, including sub-head linked amounts and remaining due.</div>
        )}

        <div style={styles.tableWrap}>
          {hiddenColumns.length > 0 && (
            <div style={styles.hiddenBar}>
              <span style={styles.hiddenBarLabel}>Hidden columns:</span>
              {hiddenColumns.map((columnId) => (
                <button
                  key={columnId}
                  type="button"
                  onClick={() => toggleColumnVisibility(columnId)}
                  style={styles.unhideBtn}
                >
                  Unhide {columnsById[columnId]?.label || columnId}
                </button>
              ))}
              <button type="button" onClick={clearHiddenColumns} style={styles.resetColumnsBtn}>
                Reset Columns
              </button>
            </div>
          )}
          <div style={styles.orderBar}>
            <span style={styles.orderBarLabel}>Drag column headers to reorder them.</span>
            <button type="button" onClick={resetColumnOrder} style={styles.resetColumnsBtn}>
              Reset Order
            </button>
          </div>
          {loading ? (
            <div style={styles.loading}>Loading Candidate Flown…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {visibleColumns.map((column) => (
                      <th
                        key={column.id}
                        style={styles.th}
                        draggable
                        onDragStart={(event) => handleColumnDragStart(column.id, event)}
                        onDragOver={handleColumnDragOver}
                        onDrop={(event) => handleColumnDrop(column.id, event)}
                      >
                        <div style={styles.thInner}>
                          <button
                            type="button"
                            style={styles.sortHeaderBtn}
                            onClick={() => handleSort(column.id)}
                          >
                            <span>{column.label}</span>
                            <span style={styles.sortIndicator}>{sortIndicator(column.id)}</span>
                          </button>
                          <button
                            type="button"
                            title={`Hide ${column.label}`}
                            aria-label={`Hide ${column.label}`}
                            onClick={() => toggleColumnVisibility(column.id)}
                            style={styles.hideColumnBtn}
                          >
                            ×
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(visibleColumns.length, 1)} style={styles.empty}>No candidates found matching your search.</td>
                    </tr>
                  )}
                  {sortedDedupedEntries.map((entry) => {
                    const candidateId = Number(entry.candidate_id || entry.candidate || entry.id || 0)
                    const candidateName = entry.candidate_name || 'Unknown'
                    const entryTotalFee = Number(entry.total_fee || entry.office_rate || 0)
                    const entryReceived = Number(entry.paid_amount ?? (Number(entry.advance_1 || 0) + Number(entry.advance_2 || 0) + Number(entry.advance_3 || 0)))
                    const entrySubHeadBookedAmount = Number(entry.sub_head_booked_amount || 0)
                    const entryDue = entryTotalFee - entryReceived
                    const entryRemaining = entryDue - entrySubHeadBookedAmount
                    const selected = selectedEntry && String(selectedEntry.id) === String(entry.id)
                    const officeRateValue = Number(entry.office_rate || entry.total_fee || 0)
                    const rowCells = {
                      candidate_id: (
                        <button
                          type="button"
                          style={styles.linkBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            const candidateRowId = entry.candidate_id || entry.id
                            if (candidateRowId) {
                              navigate(`/candidates/${candidateRowId}`)
                            }
                          }}
                        >
                          {entry.candidate_id || entry.id || '—'}
                        </button>
                      ),
                      candidate: <strong>{candidateName}</strong>,
                      passport: entry.passport_number || '—',
                      company: entry.company_name || '—',
                      project: entry.project_number || '—',
                      country: entry.country || '—',
                      trade: entry.project_trade || '—',
                      office_rate: officeRateValue > 0 ? formatCurrency(officeRateValue) : '—',
                      paid: formatCurrency(entryReceived),
                      sub_head_booked: formatCurrency(entrySubHeadBookedAmount),
                      total_due: formatCurrency(entryDue),
                      remaining: formatCurrency(entryRemaining),
                      actions: (
                        <div style={{ display: 'flex', gap: 6, minWidth: 140 }}>
                          <button
                            type="button"
                            style={styles.actionBtn}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelect(entry)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDeleteEntry(entry)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ),
                    }

                    return (
                      <tr
                        key={entry.id}
                        style={{ ...styles.tr, ...(selected ? styles.trSelected : {}) }}
                        onClick={() => handleSelect(entry)}
                      >
                        {visibleColumns.map((column) => {
                          const isPaid = column.id === 'paid'
                          const isDue = column.id === 'total_due'
                          const isRemaining = column.id === 'remaining'

                          let cellStyle = styles.td
                          if (isPaid) {
                            cellStyle = { ...styles.td, color: entryReceived > 0 ? '#059669' : '#374151' }
                          } else if (isDue) {
                            cellStyle = { ...styles.td, color: entryDue > 0 ? '#dc2626' : '#059669' }
                          } else if (isRemaining) {
                            cellStyle = { ...styles.td, color: entryRemaining > 0 ? '#dc2626' : '#059669' }
                          }

                          return (
                            <td key={column.id} style={cellStyle}>
                              {rowCells[column.id]}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination.last_page > 1 && (
          <div style={styles.pagination}>
            <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
            <span style={styles.pageInfo}>Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)</span>
            <button style={styles.pageBtn} disabled={page === pagination.last_page} onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))}>Next →</button>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: {},
  alert: { borderRadius: 6, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  alertError: { background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 },
  summaryCard: {
    background: 'linear-gradient(180deg, #f8fbff 0%, #f3f7fb 100%)',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #cfe0f4',
    boxShadow: '0 6px 16px rgba(14, 116, 144, 0.06)',
    minHeight: 88,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  summaryLabel: { fontSize: 10, color: '#1d4ed8', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' },
  summaryValue: { fontSize: 18, fontWeight: 800, color: '#0f172a' },
  toolbar: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  columnsBtn: { padding: '8px 14px', background: '#fff', color: '#1e3a5f', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 },
  columnManager: { marginBottom: 16, background: '#ffffff', border: '1px solid #dbe5f0', borderRadius: 10, padding: 12 },
  columnManagerTitle: { fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 4 },
  columnManagerSubTitle: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  columnList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 },
  columnItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' },
  columnCheckboxLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#0f172a', fontWeight: 700 },
  columnItemActions: { display: 'flex', gap: 6 },
  columnActionBtn: { padding: '4px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#334155', fontWeight: 700 },
  hiddenBar: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '8px 10px', background: '#f8fafc', border: '1px solid #dbe5f0', borderRadius: 8 },
  hiddenBarLabel: { fontSize: 12, fontWeight: 800, color: '#0f172a' },
  unhideBtn: { padding: '4px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 },
  resetColumnsBtn: { padding: '4px 8px', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 },
  orderBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, color: '#475569' },
  orderBarLabel: { fontWeight: 700 },
  thInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  sortHeaderBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#1f2937', fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 },
  sortIndicator: { color: '#1d4ed8', fontSize: 10, fontWeight: 900 },
  linkBtn: { border: 'none', background: 'transparent', color: '#1d4ed8', fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline' },
  hideColumnBtn: { border: 'none', background: 'transparent', color: '#64748b', fontSize: 15, cursor: 'pointer', lineHeight: 1 },
  searchRow: { display: 'flex', gap: 8, flex: 1, minWidth: 280 },
  searchInput: { flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 },
  searchBtn: { padding: '8px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  detailCard: {
    background: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
    border: '1px solid #e2e8f0',
  },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 },
  detailTitle: { fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em' },
  detailSubtitle: { fontSize: 22, color: '#0f172a', marginTop: 4, fontWeight: 800, lineHeight: 1.2 },
  detailStatus: { padding: '8px 14px', borderRadius: 999, background: '#e9e7ff', color: '#4338ca', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', border: '1px solid #c7d2fe' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 },
  subHeadModuleGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 14 },
  referenceTableWrapper: { overflowX: 'auto', borderRadius: 14, border: '1px solid #dbe5f0', background: '#f8fbff', marginTop: 18 },
  referenceTable: { width: '100%', minWidth: 760, borderCollapse: 'collapse' },
  referenceTableHeader: { textAlign: 'left', padding: '14px 16px', background: '#eef4ff', color: '#1e3a5f', fontSize: 12, fontWeight: 800, borderBottom: '1px solid #dbe5f0' },
  referenceTableCell: { padding: '14px 16px', borderBottom: '1px solid #e9eff7', color: '#334155', fontSize: 13 },
  subHeadModuleCard: {
    padding: 12,
    background: 'linear-gradient(180deg, #eff8ff 0%, #ecfeff 100%)',
    borderRadius: 12,
    border: '1px solid #93c5fd',
    minHeight: 96,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: '0 6px 16px rgba(14, 116, 144, 0.08)',
  },
  subHeadModuleLabel: { fontSize: 10, color: '#0f4c81', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' },
  subHeadModuleValue: { fontSize: 16, fontWeight: 800, color: '#0f172a' },
  detailField: { padding: 10, background: '#f8fafc', borderRadius: 10, border: '1px solid #dbe2ea' },
  detailLabel: { fontSize: 11, color: '#475569', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' },
  detailValue: { fontSize: 15, fontWeight: 800, color: '#0f172a' },
  section: { marginBottom: 20, padding: 18, background: '#f8fafc', borderRadius: 16, border: '1px solid #dbe5f0' },
  sectionTitle: { margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' },
  emptyCard: { padding: 24, marginBottom: 20, borderRadius: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#475569' },
  tableWrap: { background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#1f2937', background: '#f3f4f6', borderBottom: '2px solid #d1d5db', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #e5e7eb', cursor: 'pointer' },
  trSelected: { background: '#eef2ff' },
  td: { padding: '9px 12px', textAlign: 'left', fontSize: 12, color: '#374151', verticalAlign: 'middle' },
  empty: { textAlign: 'center', padding: '40px 20px', color: '#6b7280' },
  loading: { textAlign: 'center', padding: '40px 20px', color: '#6b7280', fontSize: 14 },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 },
  pageBtn: { padding: '6px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  pageInfo: { fontSize: 13, color: '#64748b' },
  actionBtn: { padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: 11, fontWeight: 700 },
  deleteBtn: { background: '#fff1f2', borderColor: '#fecdd3', color: '#be123c' },
  statusSelect: { padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11, background: '#fff' },
}
