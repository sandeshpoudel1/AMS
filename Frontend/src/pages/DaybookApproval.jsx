import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function DaybookApproval() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [queueRows, setQueueRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [hours, setHours] = useState(24)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState([])
  const [subHeadCandidateLinks, setSubHeadCandidateLinks] = useState([])
  const [selectedType, setSelectedType] = useState('receipt')
  const [selectedDate, setSelectedDate] = useState('')

  const formatAmount = (value) => `NPR ${Number(value || 0).toLocaleString()}`

  const getSubHeadLabel = (row) => {
    if (row.linked_module === 'sub_head') {
      if (row.linked_record_name) {
        return String(row.linked_record_name).split(' - ')[0].trim() || row.linked_record_name
      }
      if (row.particulars?.toLowerCase().includes('sub head')) {
        return row.particulars
      }
      return 'Sub head'
    }

    return row.linked_record_name || (row.expenseHead && row.expenseHead.name) || row.expense_head || 'N/A'
  }

  const getLinkedModuleLabel = (row) => {
    if (!row.linked_module) return '-'
    return String(row.linked_module).split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
  }

  const getLinkedLabel = (row) => {
    if (!row) return '-'

    if (row.linked_module === 'candidates') {
      return row.linked_record_name || (row.linked_record_id ? `Candidate #${row.linked_record_id}` : '-')
    }

    if (row.linked_module === 'sub_head') {
      const ref = String(row.sub_passport_number || row.linked_record_id || '')
      if (ref.startsWith('candidate:')) {
        const id = String(ref.replace('candidate:', ''))
        const matched = candidates.find((c) => String(c.id) === id)
        if (matched) return matched.full_name || matched.name || `Candidate #${id}`
        return `Candidate #${id}`
      }
      if (ref.startsWith('subhead_link:')) {
        const linkId = String(ref.replace('subhead_link:', ''))
        const link = subHeadCandidateLinks.find((l) => String(l.id) === linkId)
        const candId = link?.candidate_id || link?.candidate?.id
        if (candId) {
          const cand = candidates.find((c) => String(c.id) === String(candId))
          if (cand) return cand.full_name || cand.name || `Candidate #${candId}`
          return `Candidate #${candId}`
        }
        return `Sub head link #${linkId}`
      }
      if (ref) {
        const byPassport = candidates.find((c) => String(c.passport_number || c.passport || '') === ref || String(c.id) === ref)
        if (byPassport) return byPassport.full_name || byPassport.name || `Candidate #${byPassport.id}`
      }
    }

    return row.company_name || row.linked_record_name || '-' 
  }

  const receiptRows = useMemo(() => rows.filter((r) => r.type === 'receipt'), [rows])
  const paymentRows = useMemo(() => rows.filter((r) => r.type === 'payment'), [rows])

  const visibleTotals = useMemo(() => ({
    receipts: receiptRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    payments: paymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    pending: rows.filter(r => r.approval_status === 'pending').reduce((sum, row) => sum + Number(row.amount || 0), 0),
  }), [rows, receiptRows, paymentRows])

  const receiptQueueGroups = useMemo(() => {
    const groups = queueRows
      .filter((r) => r.type === 'receipt')
      .reduce((acc, row) => {
        const entryDate = String(row.entry_date || '').slice(0, 10) || 'Unknown'
        if (!acc[entryDate]) acc[entryDate] = []
        acc[entryDate].push(row)
        return acc
      }, {})

    return Object.entries(groups)
      .map(([date, entries]) => ({
        date,
        entries,
        count: entries.length,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [queueRows])

  const paymentQueueGroups = useMemo(() => {
    const groups = queueRows
      .filter((r) => r.type === 'payment')
      .reduce((acc, row) => {
        const entryDate = String(row.entry_date || '').slice(0, 10) || 'Unknown'
        if (!acc[entryDate]) acc[entryDate] = []
        acc[entryDate].push(row)
        return acc
      }, {})

    return Object.entries(groups)
      .map(([date, entries]) => ({
        date,
        entries,
        count: entries.length,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [queueRows])

  const shownSummary = selectedDate ? summary : {
    total_receipts: visibleTotals.receipts,
    total_payments: visibleTotals.payments,
    net_balance: visibleTotals.receipts - visibleTotals.payments,
    receipt_count: receiptRows.length,
    payment_count: paymentRows.length,
    pending_amount: visibleTotals.pending,
    pending_count: rows.filter((r) => r.approval_status === 'pending').length,
  }

  const openingBalanceValue = Number(summary?.opening_balance ?? 0)
  const totalReceiptsValue = Number(summary?.total_receipts ?? visibleTotals.receipts)
  const totalPaymentsValue = Number(summary?.total_payments ?? visibleTotals.payments)
  const closingBalanceValue = Number(summary?.closing_balance ?? (openingBalanceValue + totalReceiptsValue - totalPaymentsValue))

  const formatDay = (dateString) => {
    if (!dateString || dateString === 'Unknown') return 'Unknown date'
    const date = new Date(`${dateString}T00:00:00`)
    if (Number.isNaN(date.getTime())) return dateString
    return date.toLocaleDateString('en-GB')
  }

  const renderApprovalCard = (r) => (
    <div key={r.id} style={styles.entryCard}>
      <div style={styles.entryCardHeader}>
        <div>
          <div style={styles.entryCardTitle}>{r.particulars || r.description || (r.type === 'receipt' ? 'Receipt entry' : 'Payment entry')}</div>
          <div style={styles.entryCardMeta}>{r.entry_date ? new Date(r.entry_date).toLocaleDateString('en-GB') : 'Date unknown'}</div>
        </div>
        <div style={styles.entryAmount}>
          <div style={styles.entryTypeBadge(r.type === 'payment' ? { background: '#fee2e2', color: '#7f1d1d' } : {})}>{r.type === 'payment' ? 'Payment' : 'Receipt'}</div>
          <div style={{ ...styles.entryAmountValue, color: r.type === 'payment' ? '#7f1d1d' : '#0f2742' }}>{formatAmount(r.amount)}</div>
        </div>
      </div>

      <div style={styles.entryCardBody}>
        <div style={styles.entryRow}>
          <div style={styles.entryRowLabel}>Module</div>
          <div style={styles.entryRowValue}>{getLinkedModuleLabel(r)}</div>
        </div>
        <div style={styles.entryRow}>
          <div style={styles.entryRowLabel}>Sub-head</div>
          <div style={styles.entryRowValue}>{getSubHeadLabel(r)}</div>
        </div>
        <div style={styles.entryRow}>
          <div style={styles.entryRowLabel}>Linked</div>
          <div style={styles.entryRowValue}>{getLinkedLabel(r)}</div>
        </div>
        <div style={styles.entryRow}>
          <div style={styles.entryRowLabel}>Description</div>
          <div style={styles.entryRowValue}>{r.description || r.particulars || '-'}</div>
        </div>
        <div style={styles.entryRow}>
          <div style={styles.entryRowLabel}>Status</div>
          <div style={styles.statusBadge(r.approval_status)}>{(r.approval_status || 'approved') === 'approved' ? 'Approved' : r.approval_status === 'pending' ? 'Pending' : 'Rejected'}</div>
        </div>
      </div>
    </div>
  )


  const loadEntries = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { per_page: 500 }
      if (statusFilter && statusFilter !== 'all') params.approval_status = statusFilter
      // When a specific date is selected, load both receipts and payments for that date.
      if (!selectedDate && selectedType) params.type = selectedType
      if (selectedDate) params.date = selectedDate
      const res = await api.get('/daybook', { params })
      setRows(res.data.data.entries || [])
    } catch (err) {
      console.error('DaybookApproval.loadEntries error:', err)
      setError(err?.response?.data?.message || 'Failed to load daybook entries')
      if (err?.response?.status === 403) {
        alert('You do not have permission to view daybook approvals. Contact admin.')
      }
      setRows([])
    } finally { setLoading(false) }
  }

  const loadQueueRows = async () => {
    try {
      const res = await api.get('/daybook', { params: { per_page: 500, approval_status: 'pending' } })
      setQueueRows(res.data.data.entries || [])
    } catch {
      setQueueRows([])
    }
  }

  const loadSettings = async () => {
    try {
      const res = await api.get('/daybook/settings')
      setHours(res.data.data.edit_lock_hours || 24)
    } catch {}
  }

  const loadCandidates = async () => {
    try {
      const res = await api.get('/candidates', { params: { per_page: 500 } })
      const rows = Array.isArray(res?.data?.data?.candidates) ? res.data.data.candidates : []
      setCandidates(rows)
    } catch (e) {
      setCandidates([])
    }
  }

  const loadSubHeadCandidateLinks = async () => {
    try {
      const res = await api.get('/sub-head-candidate-charges', { params: { is_active: true } })
      setSubHeadCandidateLinks(Array.isArray(res?.data?.data) ? res.data.data : [])
    } catch (e) {
      setSubHeadCandidateLinks([])
    }
  }

  const roleLower = (user?.role || user?.role_label || '').toLowerCase().replace(/ /g, '_')
  // Admin and superadmin may final-approve daybook entries and summaries
  const canApprove = roleLower === 'superadmin' || roleLower === 'super_admin' || roleLower === 'admin'

  useEffect(() => {
    loadQueueRows()
    loadEntries()
    loadSettings()
    loadCandidates()
    loadSubHeadCandidateLinks()
  }, [statusFilter, selectedDate, selectedType])

  const loadSummary = async (date = null) => {
    try {
      const params = {}
      if (date) params.date = date
      const res = await api.get('/daybook/summary', { params })
      setSummary(res.data?.data || null)
    } catch (err) {
      setSummary(null)
    }
  }

  useEffect(() => { void loadSummary(selectedDate) }, [selectedDate])

  const formatDate = (d) => {
    if (!d) return ''
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return d
    return dt.toLocaleDateString('en-GB')
  }

  const ledgerRows = useMemo(() => {
    const sorted = [...rows].sort((left, right) => {
      const leftDate = String(left.entry_date || '')
      const rightDate = String(right.entry_date || '')

      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate)
      return Number(left.id || 0) - Number(right.id || 0)
    })

    let runningBalance = Number(summary?.opening_balance) || 0

    return sorted.map((entry, index) => {
      const amount = Number(entry.amount || 0)
      const receiptAmount = entry.type === 'receipt' ? amount : 0
      const paymentAmount = entry.type === 'payment' ? amount : 0

      const ssfAmount = Number(entry.ssf_amount ?? entry.ssf ?? entry.ssf_fee ?? entry.fee_ssf ?? 0)
      const welfareAmount = Number(entry.welfare_amount ?? entry.welfare ?? entry.welfare_fee ?? entry.fee_welfare ?? 0)
      const insuranceAmount = Number(entry.insurance_amount ?? entry.insurance ?? entry.insurance_fee ?? entry.fee_insurance ?? 0)

      runningBalance += receiptAmount - paymentAmount

      return {
        ...entry,
        rowNumber: index + 1,
        receiptAmount,
        paymentAmount,
        ssfAmount,
        welfareAmount,
        insuranceAmount,
        runningBalance,
      }
    })
  }, [rows, summary])

  const receiptLedgerRows = useMemo(() => ledgerRows.filter((entry) => entry.type === 'receipt'), [ledgerRows])
  const paymentLedgerRows = useMemo(() => ledgerRows.filter((entry) => entry.type === 'payment'), [ledgerRows])

  const ledgerTotals = useMemo(() => {
    return ledgerRows.reduce((totals, row) => ({
      receipts: totals.receipts + row.receiptAmount,
      payments: totals.payments + row.paymentAmount,
      ssf: totals.ssf + (Number(row.ssfAmount || 0) || 0),
      welfare: totals.welfare + (Number(row.welfareAmount || 0) || 0),
      insurance: totals.insurance + (Number(row.insuranceAmount || 0) || 0),
      closing: row.runningBalance,
    }), { receipts: 0, payments: 0, ssf: 0, welfare: 0, insurance: 0, closing: Number(summary?.opening_balance) || 0 })
  }, [ledgerRows, summary])

  const approveRow = async (id) => {
    if (!canApprove) { alert('Only superadmin can perform this action'); return }
    try {
      await api.post(`/daybook/${id}/approve`)
      await loadEntries()
      await loadQueueRows()
      if (selectedDate) await loadSummary(selectedDate)
    } catch (err) { alert('Approve failed') }
  }

  const rejectRow = async (id) => {
    if (!canApprove) { alert('Only superadmin can perform this action'); return }
    try {
      await api.post(`/daybook/${id}/reject`)
      await loadEntries()
      await loadQueueRows()
      if (selectedDate) await loadSummary(selectedDate)
    } catch (err) { alert('Reject failed') }
  }

  const approveSelectedQueue = async () => {
    if (!canApprove) { alert('Only superadmin can perform this action'); return }
    const pending = rows.filter((r) => r.approval_status === 'pending')
    if (!pending.length) return
    if (!window.confirm(`Approve all shown ${selectedType} entries for ${formatDay(selectedDate)}?`)) return
    try {
      for (const row of pending) {
        // sequential to keep API rate reasonable
        // eslint-disable-next-line no-await-in-loop
        await api.post(`/daybook/${row.id}/approve`)
      }
      await loadEntries()
      await loadQueueRows()
      if (selectedDate) await loadSummary(selectedDate)
      alert(`Approved ${pending.length} entries for ${formatDay(selectedDate)}`)
    } catch (err) {
      alert('Bulk approve failed')
    }
  }

  const rejectSelectedQueue = async () => {
    if (!canApprove) { alert('Only superadmin can perform this action'); return }
    const pending = rows.filter((r) => r.approval_status === 'pending')
    if (!pending.length) return
    if (!window.confirm(`Reject all shown ${selectedType} entries for ${formatDay(selectedDate)}?`)) return
    try {
      for (const row of pending) {
        // sequential to keep API rate reasonable
        // eslint-disable-next-line no-await-in-loop
        await api.post(`/daybook/${row.id}/reject`)
      }
      await loadEntries()
      await loadQueueRows()
      if (selectedDate) await loadSummary(selectedDate)
      alert(`Rejected ${pending.length} entries for ${formatDay(selectedDate)}`)
    } catch (err) {
      alert('Bulk reject failed')
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.post('/daybook/settings', { edit_lock_hours: Number(hours) })
      alert('Settings saved')
    } catch (err) { alert('Save failed') } finally { setSaving(false) }
  }


  return (
    <SidebarLayout title="Daybook Approval">
      <div style={{ padding: 12 }}>
        <div style={styles.pageHeader}>
          <div style={styles.headerLeft}>
            <div>
              <div style={styles.eyebrow}>FINANCE CONTROL</div>
              <h3 style={styles.pageTitle}>Daybook Approvals</h3>
              <p style={styles.pageSubtitle}>Review daily receipts and payments before they are finalized.</p>
            </div>
            <div style={styles.filterBar}>
              <div style={styles.filterGroup}>
                <label style={styles.controlLabel}>Date</label>
                <input
                  type="date"
                  style={styles.control}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.controlLabel}>Type</label>
                <select style={styles.control} value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                  <option value="receipt">Receipt</option>
                  <option value="payment">Payment</option>
                </select>
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.controlLabel}>Status</label>
                <select style={styles.control} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.controlLabel}>Lock</label>
                <select style={styles.control} value={hours} onChange={e => setHours(e.target.value)}>
                  <option value={24}>24h</option>
                  <option value={48}>48h</option>
                  <option value={72}>72h</option>
                </select>
              </div>
              <button onClick={saveSettings} style={styles.secondaryButton} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>

        <section style={styles.summaryGrid}>
          <div style={{ ...styles.summaryCard, borderTopColor: '#0f2742' }}>
            <div style={styles.summaryCardTop}><span style={styles.summaryLabel}>Opening Balance</span><span style={{ ...styles.summaryIcon, background: '#eff6ff', color: '#0f2742' }}>OPEN</span></div>
            <strong style={{ ...styles.summaryValue, color: '#0f2742' }}>{formatAmount(openingBalanceValue)}</strong>
            <span style={styles.summaryHint}>Start of the day</span>
          </div>
          <div style={{ ...styles.summaryCard, borderTopColor: '#0f2742' }}>
            <div style={styles.summaryCardTop}><span style={styles.summaryLabel}>Today's Receipt</span><span style={{ ...styles.summaryIcon, background: '#eff6ff', color: '#0f2742' }}>IN</span></div>
            <strong style={{ ...styles.summaryValue, color: '#0f2742' }}>{formatAmount(totalReceiptsValue)}</strong>
            <span style={styles.summaryHint}>{summary?.receipt_count ?? 0} receipt entries</span>
          </div>
          <div style={{ ...styles.summaryCard, borderTopColor: '#7f1d1d' }}>
            <div style={styles.summaryCardTop}><span style={styles.summaryLabel}>Today's Payment</span><span style={{ ...styles.summaryIcon, background: '#fee2e2', color: '#7f1d1d' }}>OUT</span></div>
            <strong style={{ ...styles.summaryValue, color: '#7f1d1d' }}>{formatAmount(totalPaymentsValue)}</strong>
            <span style={styles.summaryHint}>{summary?.payment_count ?? 0} payment entries</span>
          </div>
          <div style={{ ...styles.summaryCard, borderTopColor: '#0f2742' }}>
            <div style={styles.summaryCardTop}><span style={styles.summaryLabel}>Closing Balance</span><span style={{ ...styles.summaryIcon, background: '#eff6ff', color: '#0f2742' }}>CLOSE</span></div>
            <strong style={{ ...styles.summaryValue, color: closingBalanceValue >= 0 ? '#0f2742' : '#7f1d1d' }}>{formatAmount(closingBalanceValue)}</strong>
            <span style={styles.summaryHint}>End of the day</span>
          </div>
        </section>

        {error ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ padding: 12, borderRadius: 8, background: '#fee2e2', border: '1px solid #f5c6a5', color: '#7f1d1d' }}>
              <strong>Error:</strong> {error}
            </div>
          </div>
        ) : null}

        {loading ? <div>Loading…</div> : (
          <>
            <section style={styles.queueGrid}>
              <div style={styles.queueCard}>
                <div style={styles.queueCardHeader}>
                  <div>Receipt queue</div>
                  <div style={styles.queueBadge}>{receiptQueueGroups.reduce((sum, group) => sum + group.count, 0)} pending</div>
                </div>
                <div style={styles.queueList}>
                  {receiptQueueGroups.length === 0 ? (
                    <div style={styles.emptyState}>No pending receipt dates</div>
                  ) : receiptQueueGroups.map((group) => (
                    <button
                      key={group.date}
                      type="button"
                      style={{
                        ...styles.queueItem,
                        ...(selectedDate === group.date ? styles.queueItemActive : {}),
                      }}
                      onClick={() => {
                        setSelectedDate(group.date)
                      }}
                    >
                      <span>{formatDay(group.date)}</span>
                      <span>{group.count} entries</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.queueCard}>
                <div style={styles.queueCardHeader}>
                  <div>Payment queue</div>
                  <div style={styles.queueBadge}>{paymentQueueGroups.reduce((sum, group) => sum + group.count, 0)} pending</div>
                </div>
                <div style={styles.queueList}>
                  {paymentQueueGroups.length === 0 ? (
                    <div style={styles.emptyState}>No pending payment dates</div>
                  ) : paymentQueueGroups.map((group) => (
                    <button
                      key={group.date}
                      type="button"
                      style={{
                        ...styles.queueItem,
                        ...(selectedDate === group.date ? styles.queueItemActive : {}),
                      }}
                      onClick={() => {
                        setSelectedDate(group.date)
                      }}
                    >
                      <span>{formatDay(group.date)}</span>
                      <span>{group.count} entries</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {selectedDate ? (
              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <div>
                      <h4 style={{ margin: 0, color: '#0f2742' }}>Daybook approvals</h4>
                      <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                        {formatDay(selectedDate)} · {receiptLedgerRows.length} receipts · {paymentLedgerRows.length} payments
                      </div>
                    </div>
                  {canApprove && rows.some((r) => r.approval_status === 'pending') ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={{ ...styles.secondaryButton, borderColor: '#7f1d1d', color: '#7f1d1d', background: '#fee2e2' }} onClick={rejectSelectedQueue}>
                        Reject all
                      </button>
                      <button style={{ ...styles.primaryButton, background: '#0f2742' }} onClick={approveSelectedQueue}>
                        Approve all
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Approval cards removed — use ledger below for approvals */}
                {/* Ledger view for the selected date */}
                <div style={{ height: 18 }} />
                <div style={styles.splitLedgerGrid}>
                  <div style={styles.splitLedgerHalf}>
                    <div style={styles.splitLedgerTitle}>Receipt part</div>
                    <div style={styles.tableScroll}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>#</th>
                            <th style={styles.th}>Date</th>
                            <th style={styles.th}>Company</th>
                            <th style={styles.th}>Particulars</th>
                            <th style={styles.th}>Ref / Passport</th>
                            <th style={styles.th}>Linked Source</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Receipt</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>SSF</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Welfare</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Insurance</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Balance</th>
                            <th style={styles.th}>Approval</th>
                            <th style={styles.th}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receiptLedgerRows.length === 0 ? (
                            <tr>
                              <td colSpan={13} style={styles.emptyState}>No receipt rows for this date</td>
                            </tr>
                          ) : (
                            receiptLedgerRows.map((entry) => (
                              <tr key={entry.id}>
                                <td style={styles.td}>{entry.rowNumber}</td>
                                <td style={styles.td}>{formatDate(entry.entry_date)}</td>
                                <td style={styles.td}>{entry.company_name || '-'}</td>
                                <td style={styles.td}>{entry.particulars || '-'}</td>
                                <td style={styles.td}>{entry.reference_number || entry.sub_passport_number || '-'}</td>
                                <td style={styles.td}>{entry.linked_module ? getLinkedLabel(entry) : '-'}</td>
                                <td style={{ ...styles.td, ...styles.amountCell, ...styles.receipt }}>{entry.receiptAmount ? formatAmount(entry.receiptAmount) : '—'}</td>
                                <td style={{ ...styles.td, ...styles.amountCell }}>{entry.ssfAmount ? formatAmount(entry.ssfAmount) : '—'}</td>
                                <td style={{ ...styles.td, ...styles.amountCell }}>{entry.welfareAmount ? formatAmount(entry.welfareAmount) : '—'}</td>
                                <td style={{ ...styles.td, ...styles.amountCell }}>{entry.insuranceAmount ? formatAmount(entry.insuranceAmount) : '—'}</td>
                                <td style={{ ...styles.td, ...styles.amountCell, ...styles.balance }}>{formatAmount(entry.runningBalance)}</td>
                                <td style={styles.td}>{entry.approval_status ? entry.approval_status.charAt(0).toUpperCase() + entry.approval_status.slice(1) : 'Approved'}</td>
                                <td style={styles.td}>
                                  {entry.approval_status === 'pending' && canApprove ? (
                                    <div style={styles.entryActions}>
                                      <button style={styles.secondaryButton} onClick={() => rejectRow(entry.id)}>Reject</button>
                                      <button style={styles.primaryButton} onClick={() => approveRow(entry.id)}>Approve</button>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {receiptLedgerRows.length > 0 && (
                          <tfoot>
                            <tr style={styles.footerRow}>
                              <td style={styles.td} colSpan={6}>Totals</td>
                              <td style={{ ...styles.td, ...styles.amountCell, ...styles.receipt }}>{formatAmount(ledgerTotals.receipts)}</td>
                              <td style={{ ...styles.td, ...styles.amountCell }}>{formatAmount(ledgerTotals.ssf)}</td>
                              <td style={{ ...styles.td, ...styles.amountCell }}>{formatAmount(ledgerTotals.welfare)}</td>
                              <td style={{ ...styles.td, ...styles.amountCell }}>{formatAmount(ledgerTotals.insurance)}</td>
                              <td style={{ ...styles.td, ...styles.amountCell, ...styles.balance }}>{formatAmount(ledgerTotals.closing)}</td>
                              <td style={styles.td}></td>
                              <td style={styles.td}></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  <div style={styles.splitLedgerHalf}>
                    <div style={styles.splitLedgerTitle}>Payment part</div>
                    <div style={styles.tableScroll}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>#</th>
                            <th style={styles.th}>Date</th>
                            <th style={styles.th}>Company</th>
                            <th style={styles.th}>Particulars</th>
                            <th style={styles.th}>Ref / Passport</th>
                            <th style={styles.th}>Linked Source</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Payment</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>SSF</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Welfare</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Insurance</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Balance</th>
                            <th style={styles.th}>Approval</th>
                            <th style={styles.th}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentLedgerRows.length === 0 ? (
                            <tr>
                              <td colSpan={13} style={styles.emptyState}>No payment rows for this date</td>
                            </tr>
                          ) : (
                            paymentLedgerRows.map((entry) => (
                              <tr key={entry.id}>
                                <td style={styles.td}>{entry.rowNumber}</td>
                                <td style={styles.td}>{formatDate(entry.entry_date)}</td>
                                <td style={styles.td}>{entry.company_name || '-'}</td>
                                <td style={styles.td}>{entry.particulars || '-'}</td>
                                <td style={styles.td}>{entry.reference_number || entry.sub_passport_number || '-'}</td>
                                <td style={styles.td}>{entry.linked_module ? getLinkedLabel(entry) : '-'}</td>
                                <td style={{ ...styles.td, ...styles.amountCell, ...styles.payment }}>{entry.paymentAmount ? formatAmount(entry.paymentAmount) : '—'}</td>
                                <td style={{ ...styles.td, ...styles.amountCell }}>{entry.ssfAmount ? formatAmount(entry.ssfAmount) : '—'}</td>
                                <td style={{ ...styles.td, ...styles.amountCell }}>{entry.welfareAmount ? formatAmount(entry.welfareAmount) : '—'}</td>
                                <td style={{ ...styles.td, ...styles.amountCell }}>{entry.insuranceAmount ? formatAmount(entry.insuranceAmount) : '—'}</td>
                                <td style={{ ...styles.td, ...styles.amountCell, ...styles.balance }}>{formatAmount(entry.runningBalance)}</td>
                                <td style={styles.td}>{entry.approval_status ? entry.approval_status.charAt(0).toUpperCase() + entry.approval_status.slice(1) : 'Approved'}</td>
                                <td style={styles.td}>
                                  {entry.approval_status === 'pending' && canApprove ? (
                                    <div style={styles.entryActions}>
                                      <button style={styles.secondaryButton} onClick={() => rejectRow(entry.id)}>Reject</button>
                                      <button style={styles.primaryButton} onClick={() => approveRow(entry.id)}>Approve</button>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {paymentLedgerRows.length > 0 && (
                          <tfoot>
                            <tr style={styles.footerRow}>
                              <td style={styles.td} colSpan={6}>Totals</td>
                              <td style={{ ...styles.td, ...styles.amountCell, ...styles.payment }}>{formatAmount(ledgerTotals.payments)}</td>
                              <td style={{ ...styles.td, ...styles.amountCell }}>{formatAmount(ledgerTotals.ssf)}</td>
                              <td style={{ ...styles.td, ...styles.amountCell }}>{formatAmount(ledgerTotals.welfare)}</td>
                              <td style={{ ...styles.td, ...styles.amountCell }}>{formatAmount(ledgerTotals.insurance)}</td>
                              <td style={{ ...styles.td, ...styles.amountCell, ...styles.balance }}>{formatAmount(ledgerTotals.closing)}</td>
                              <td style={styles.td}></td>
                              <td style={styles.td}></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <div style={styles.emptyState}>Select a date from the receipt or payment queue above to view approval entries.</div>
            )}
          </>
        )}
      </div>
    </SidebarLayout>
  )
}

const styles = {
  pageHeader: { display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 18, padding: '8px 2px' },
  headerLeft: { display: 'grid', gap: 18 },
  eyebrow: { color: '#7f1d1d', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' },
  pageTitle: { margin: '4px 0', color: '#0f2742', fontSize: 26 },
  pageSubtitle: { margin: 0, color: '#475569', fontSize: 13 },
  controlLabel: { color: '#475569', fontSize: 12, fontWeight: 700 },
  control: { border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', background: '#fff', color: '#0f2742' },
  primaryButton: { border: 0, borderRadius: 8, background: '#0f2742', color: '#fff', padding: '9px 13px', fontWeight: 700, cursor: 'pointer' },
  secondaryButton: { border: '1px solid #0f2742', borderRadius: 8, background: '#fff', color: '#0f2742', padding: '8px 12px', fontWeight: 700, cursor: 'pointer' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(200px, 1fr))', gap: 10, marginBottom: 18, alignItems: 'stretch' },
  summaryCard: { background: '#fff', border: '1.5px solid #0f2742', borderRadius: 16, padding: '14px 18px 12px', boxShadow: '0 10px 24px rgba(15, 39, 66, 0.04)', minHeight: 146 },
  summaryCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 },
  summaryLabel: { color: '#0f2742', fontSize: 13, fontWeight: 700 },
  summaryIcon: { background: '#eff6ff', color: '#0f2742', borderRadius: 6, padding: '4px 7px', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', minWidth: 44, textAlign: 'center' },
  summaryValue: { display: 'block', fontSize: 22, lineHeight: 1.2, marginBottom: 4 },
  summaryHint: { display: 'block', marginTop: 0, color: '#64748b', fontSize: 11 },
  panel: { background: '#fff', border: '1px solid #dbeafe', borderRadius: 12, padding: 16, boxShadow: '0 8px 24px rgba(15, 39, 66, 0.05)', overflowX: 'auto' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, color: '#0f2742' },
  filterBar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end', marginTop: 16, marginBottom: 18 },
  filterGroup: { display: 'grid', gap: 6 },
  queueGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 },
  queueCard: { background: '#fff', border: '1px solid #dbeafe', borderRadius: 12, padding: 14, minHeight: 180 },
  queueCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, fontWeight: 700, color: '#0f2742' },
  queueBadge: { background: '#eef2ff', color: '#0f2742', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 },
  queueList: { display: 'grid', gap: 10 },
  queueItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f2742', textAlign: 'left', cursor: 'pointer', fontWeight: 700, transition: 'background-color 150ms ease, border-color 150ms ease' },
  queueItemActive: { background: '#e0e7ff', borderColor: '#c7d2fe' },
  entryGrid: { display: 'grid', gap: 14 },
  entryCard: { borderRadius: 14, border: '1px solid #dbeafe', background: '#ffffff', padding: 16, boxShadow: '0 8px 24px rgba(15, 39, 66, 0.08)', display: 'grid', gap: 12 },
  entryCardHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' },
  entryCardTitle: { fontSize: 16, fontWeight: 800, color: '#0f2742' },
  entryCardMeta: { fontSize: 12, color: '#475569', marginTop: 4 },
  entryAmount: { textAlign: 'right', display: 'grid', gap: 6, justifyItems: 'end' },
  entryTypeBadge: (overrides = {}) => ({ borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#0f2742', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...overrides }),
  entryAmountValue: { fontSize: 20, fontWeight: 800 },
  entryCardBody: { display: 'grid', gap: 10, paddingTop: 8, borderTop: '1px solid #dbeafe' },
  entryRow: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center' },
  entryRowLabel: { fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' },
  entryRowValue: { fontSize: 14, color: '#102a43', fontWeight: 600 },
  statusBadge: (status) => ({
    padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800,
    background: status === 'approved' ? '#eff6ff' : status === 'rejected' ? '#fee2e2' : '#f8fafc',
    color: status === 'approved' ? '#0f2742' : status === 'rejected' ? '#7f1d1d' : '#0f2742',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 86,
  }),
  entryActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  emptyState: { padding: 24, textAlign: 'center', color: '#475569', background: '#ffffff', borderRadius: 12, border: '1px dashed #dbeafe' },
  tableScroll: {
    overflowX: 'auto',
  },
  splitLedgerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '16px',
    padding: '16px',
    background: '#f8fbff',
  },
  splitLedgerHalf: {
    background: '#fff',
    border: '1px solid #dfe7ef',
    borderRadius: '16px',
    overflow: 'hidden',
  },
  splitLedgerTitle: {
    padding: '12px 14px',
    fontSize: '13px',
    fontWeight: 800,
    color: '#0f2742',
    borderBottom: '1px solid #e5ecf3',
    background: '#f8fbff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
    background: '#f8fbff',
    borderBottom: '1px solid #e5ecf3',
    padding: '14px 12px',
    whiteSpace: 'nowrap',
  },
  td: {
    borderBottom: '1px solid #edf2f7',
    padding: '8px',
    fontSize: '12px',
    color: '#0f172a',
    verticalAlign: 'top',
  },
  amountCell: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    paddingRight: 12,
    whiteSpace: 'nowrap',
  },
  receipt: { color: '#0f2742', fontWeight: 800 },
  payment: { color: '#7f1d1d', fontWeight: 800 },
  balance: { color: '#0f2742', fontWeight: 700 },
  footerRow: { background: '#f8fbff' },
}
