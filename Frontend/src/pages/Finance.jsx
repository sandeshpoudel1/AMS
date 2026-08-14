import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'
import logo from '../assets/motherland-logo.svg'

const STATUSES = ['registered', 'shortlisted', 'certified', 'deployed', 'rejected']
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid']

export default function Finance() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('misc') // 'candidates' or 'misc'
  const [expenseHeads, setExpenseHeads] = useState([])
  const [subHeadCandidateCharges, setSubHeadCandidateCharges] = useState([])
  const [candidates, setCandidates] = useState([])
  const [trainings, setTrainings] = useState([])
  const [trainingEnrollments, setTrainingEnrollments] = useState([])
  const [miscExpenses, setMiscExpenses] = useState([])
  const [pagination, setPagination] = useState({})
  const [miscPagination, setMiscPagination] = useState({})
  const [summary, setSummary] = useState(null)
  const [paymentStats, setPaymentStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [miscLoading, setMiscLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [filterTraining, setFilterTraining] = useState('')
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('')
  const [page, setPage] = useState(1)
  const [miscPage, setMiscPage] = useState(1)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [miscSaving, setMiscSaving] = useState(false)
  const [miscSearch, setMiscSearch] = useState('')
  const [miscForm, setMiscForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    expense_head_id: '',
    sub_head_charge_id: '',
    vendor_name: '',
    goods_or_cost: '',
    amount: '',
    transaction_type: 'cash',
    reference_number: '',
    notes: '',
  })

  const selectedCandidate = useMemo(() => candidates.find(candidate => candidate.id === selectedCandidateId) || null, [candidates, selectedCandidateId])
  const selectedEnrollment = useMemo(() => trainingEnrollments.find(e => e.id === selectedEnrollmentId) || null, [trainingEnrollments, selectedEnrollmentId])
  const selectedExpenseHead = useMemo(
    () => expenseHeads.find((head) => String(head.id) === String(miscForm.expense_head_id)) || null,
    [expenseHeads, miscForm.expense_head_id]
  )
  const selectedSubHeadCharge = useMemo(
    () => subHeadCandidateCharges.find((link) => String(link.id) === String(miscForm.sub_head_charge_id)) || null,
    [subHeadCandidateCharges, miscForm.sub_head_charge_id]
  )
  const filteredSubHeadCandidateCharges = useMemo(
    () => subHeadCandidateCharges.filter((link) => String(link.expense_head_id) === String(miscForm.expense_head_id) && link.is_active),
    [subHeadCandidateCharges, miscForm.expense_head_id]
  )

  const loadExpenseHeads = async () => {
    try {
      const res = await api.get('/expense-heads', { params: { is_active: true } })
      const heads = Array.isArray(res.data.data) ? res.data.data : []
      setExpenseHeads(heads)
      if (!miscForm.expense_head_id && heads.length > 0) {
        setMiscForm((prev) => ({ ...prev, expense_head_id: String(heads[0].id) }))
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load expense heads')
    }
  }

  const loadSubHeadCandidateCharges = async () => {
    try {
      const res = await api.get('/sub-head-candidate-charges', { params: { is_active: true } })
      setSubHeadCandidateCharges(Array.isArray(res.data.data) ? res.data.data : [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load candidate/client charge links')
    }
  }

  const loadPaymentStats = async () => {
    try {
      const res = await api.get('/finance/payment-statistics')
      setPaymentStats(res.data.data || null)
    } catch (e) {
      console.error('Failed to load payment statistics')
    }
  }

  const load = async (targetPage = 1) => {
    setLoading(true)
    try {
      const res = await api.get('/finance/candidates', { params: { page: targetPage, search, status, per_page: 12 } })
      const rows = res.data.data.candidates || []
      setCandidates(rows)
      setSummary(res.data.data.summary || null)
      setPagination(res.data.pagination || {})
      if (rows.length && !selectedCandidateId) {
        setSelectedCandidateId(rows[0].id)
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load finance records')
    } finally {
      setLoading(false)
    }
  }

  const loadTrainingEnrollments = async (targetPage = 1) => {
    setLoading(true)
    try {
      const res = await api.get('/finance/training-enrollments', { params: { page: targetPage, search, training_id: filterTraining, payment_status: filterPaymentStatus, per_page: 12 } })
      const rows = res.data.data.enrollments || []
      setTrainingEnrollments(rows)
      setSummary(res.data.data.summary || null)
      setPagination(res.data.pagination || {})
      if (rows.length && !selectedEnrollmentId) {
        setSelectedEnrollmentId(rows[0].id)
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load training enrollments')
    } finally {
      setLoading(false)
    }
  }

  const loadMiscExpenses = async (targetPage = 1) => {
    setMiscLoading(true)
    try {
      const res = await api.get('/daybook', {
        params: {
          type: 'payment',
          reference_prefix: 'MISC:',
          page: targetPage,
          search: miscSearch,
          per_page: 12,
        },
      })
      setMiscExpenses(res.data.data.entries || [])
      setMiscPagination(res.data.pagination || {})
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load miscellaneous expenses')
    } finally {
      setMiscLoading(false)
    }
  }

  useEffect(() => {
    loadExpenseHeads()
    loadSubHeadCandidateCharges()
  }, [])

  useEffect(() => {
    if (tab === 'candidates') {
      load(page)
    } else {
      loadMiscExpenses(miscPage)
    }
    loadPaymentStats()
  }, [page, status, tab, filterTraining, filterPaymentStatus, miscPage, miscSearch])

  useEffect(() => {
    if (!selectedCandidate) {
      setPaymentAmount('')
      return
    }
    setPaymentAmount(selectedCandidate.paid_amount || 0)
  }, [selectedCandidate, selectedEnrollment, tab])

  const clearMessages = () => {
    setError('')
    setInfo('')
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    if (tab === 'candidates') {
      load(1)
    } else {
      setMiscPage(1)
      loadMiscExpenses(1)
    }
  }

  const createMiscExpense = async (e) => {
    e.preventDefault()
    if (!miscForm.expense_head_id || !miscForm.amount) {
      setError('Expense head and amount are required')
      return
    }

    clearMessages()
    setMiscSaving(true)
    try {
      const referenceBase = miscForm.reference_number ? miscForm.reference_number.trim() : String(Date.now())
      const chargeAmount = miscForm.amount === '' ? Number(selectedSubHeadCharge?.amount || 0) : Number(miscForm.amount)
      await api.post('/daybook', {
        entry_date: miscForm.entry_date,
        type: 'payment',
        expense_head_id: miscForm.expense_head_id,
        company_name: miscForm.vendor_name || selectedSubHeadCharge?.agency?.company_name || selectedSubHeadCharge?.candidate?.full_name || null,
        particulars: miscForm.goods_or_cost || selectedExpenseHead?.name || null,
        transaction_type: miscForm.transaction_type,
        sub_passport_number: null,
        amount: chargeAmount,
        description: miscForm.notes,
        reference_number: `MISC:${referenceBase}`,
      })
      setInfo('Miscellaneous expense added successfully')
      setMiscForm({
        entry_date: new Date().toISOString().split('T')[0],
        expense_head_id: expenseHeads[0]?.id ? String(expenseHeads[0].id) : '',
        sub_head_charge_id: '',
        vendor_name: '',
        goods_or_cost: '',
        amount: '',
        transaction_type: 'cash',
        reference_number: '',
        notes: '',
      })
      loadMiscExpenses(miscPage)
      loadPaymentStats()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save miscellaneous expense')
    } finally {
      setMiscSaving(false)
    }
  }

  const savePayment = async () => {
    if (!selectedCandidateId) {
      setError('Select a candidate first')
      return
    }

    clearMessages()
    setSaving(true)

    try {
      const res = await api.put(`/finance/candidates/${selectedCandidateId}/payment`, {
        paid_amount: paymentAmount === '' ? 0 : paymentAmount,
      })
      setInfo('Candidate payment updated successfully')
      setSummary(res.data.data.summary || null)
      load(page)
      loadPaymentStats()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidebarLayout title="Finance Officer Module">
      <div style={styles.container} className="reveal-up">

        {error && <div style={styles.error}>{error}<button style={styles.closeBtn} onClick={() => setError('')}>✕</button></div>}
        {info && <div style={styles.info}>{info}<button style={styles.closeInfoBtn} onClick={() => setInfo('')}>✕</button></div>}

        {summary && (
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}><div style={styles.summaryValue}>NPR Rs {Number(summary.total_collected || 0).toFixed(2)}</div><div style={styles.summaryLabel}>Total Collected</div></div>
            <div style={styles.summaryCard}><div style={styles.summaryValue}>{summary.total_candidates || 0}</div><div style={styles.summaryLabel}>Total Candidates</div></div>
            <div style={styles.summaryCard}><div style={styles.summaryValue}>{summary.paid_candidates || 0}</div><div style={styles.summaryLabel}>Paid Candidates</div></div>
            <div style={styles.summaryCard}><div style={styles.summaryValue}>{summary.unpaid_candidates || 0}</div><div style={styles.summaryLabel}>Unpaid Candidates</div></div>
          </div>
        )}

        {/* Payment Statistics Section */}
        {paymentStats && (
          <div style={styles.statsSection}>
            <h2 style={styles.sectionTitle}>Overall Payment Summary</h2>
            
            {/* Daily Summary */}
            <div style={styles.statGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Daily Receipts</div>
                <div style={styles.statValue}>NPR Rs {Number(paymentStats.daily_receipts.total || 0).toFixed(2)}</div>
                <div style={styles.statMeta}>{paymentStats.daily_receipts.count} transactions</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Daily Payments</div>
                <div style={{...styles.statValue, color: '#f44336'}}>NPR Rs {Number(paymentStats.daily_payments.total || 0).toFixed(2)}</div>
                <div style={styles.statMeta}>{paymentStats.daily_payments.count} transactions</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Daily Payroll Payments</div>
                <div style={{...styles.statValue, color: '#ef6c00'}}>NPR Rs {Number(paymentStats.daily_payroll_payments?.total || 0).toFixed(2)}</div>
                <div style={styles.statMeta}>{paymentStats.daily_payroll_payments?.count || 0} payroll transactions</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Daily Misc Expenses</div>
                <div style={{...styles.statValue, color: '#7c3aed'}}>NPR Rs {Number(paymentStats.daily_misc_expenses?.total || 0).toFixed(2)}</div>
                <div style={styles.statMeta}>{paymentStats.daily_misc_expenses?.count || 0} expense transactions</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Daily Balance</div>
                <div style={{...styles.statValue, color: paymentStats.daily_balance >= 0 ? '#4CAF50' : '#f44336'}}>NPR Rs {Number(paymentStats.daily_balance || 0).toFixed(2)}</div>
                <div style={styles.statMeta}>Receipts - Payments</div>
              </div>
            </div>

            {/* Payment Mode Breakdown */}
            <div style={styles.modeBreakdown}>
              <h3 style={styles.subTitle}>Payment Mode Breakdown (Today)</h3>
              <div style={styles.modeGrid}>
                <div style={styles.modeCard}>
                  <div style={styles.modeName}>Cash</div>
                  <div style={styles.modeAmount}>NPR Rs {Number(paymentStats.daily_receipts.cash || 0).toFixed(2)}</div>
                </div>
                <div style={styles.modeCard}>
                  <div style={styles.modeName}>Online</div>
                  <div style={styles.modeAmount}>NPR Rs {Number(paymentStats.daily_receipts.online || 0).toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Monthly Summary */}
            <div style={styles.monthlyBox}>
              <h3 style={styles.subTitle}>Monthly Summary</h3>
              <div style={styles.monthlyGrid}>
                <div style={styles.monthlyItem}>
                  <span>Total Receipts:</span>
                  <span style={styles.monthlyValue}>NPR Rs {Number(paymentStats.monthly_summary.receipts || 0).toFixed(2)}</span>
                </div>
                <div style={styles.monthlyItem}>
                  <span>Total Payments:</span>
                  <span style={styles.monthlyValue}>NPR Rs {Number(paymentStats.monthly_summary.payments || 0).toFixed(2)}</span>
                </div>
                <div style={styles.monthlyItem}>
                  <span>Payroll Payments:</span>
                  <span style={{...styles.monthlyValue, color: '#ef6c00'}}>NPR Rs {Number(paymentStats.monthly_summary.payroll_payments || 0).toFixed(2)}</span>
                </div>
                <div style={styles.monthlyItem}>
                  <span>Misc Expenses:</span>
                  <span style={{...styles.monthlyValue, color: '#7c3aed'}}>NPR Rs {Number(paymentStats.monthly_summary.misc_expenses || 0).toFixed(2)}</span>
                </div>
                <div style={styles.monthlyItem}>
                  <span>Monthly Balance:</span>
                  <span style={{...styles.monthlyValue, color: paymentStats.monthly_summary.balance >= 0 ? '#4CAF50' : '#f44336'}}>NPR Rs {Number(paymentStats.monthly_summary.balance || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Document Payment Summary */}
            <div style={{...styles.trainingBox, marginTop: 15}}>
              <h3 style={styles.subTitle}>Document Payment Summary</h3>
              <div style={styles.trainingGrid}>
                <div style={styles.trainingItem}>
                  <span>Total Document Payments:</span>
                  <span style={styles.trainingValue}>{summary?.doc_payment_count || 0} entries</span>
                </div>
                <div style={styles.trainingItem}>
                  <span>Total Amount Collected:</span>
                  <span style={{...styles.trainingValue, color: '#4CAF50'}}>NPR Rs {Number(summary?.doc_payment_total || 0).toFixed(2)}</span>
                </div>
              </div>
              {summary?.doc_payment_by_country?.length > 0 && (
                <div style={{marginTop: 10}}>
                  <div style={{fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6}}>By Country</div>
                  {summary.doc_payment_by_country.map(c => (
                    <div key={c.country} style={styles.trainingItem}>
                      <span>{c.country}</span>
                      <span style={styles.trainingValue}>NPR Rs {Number(c.total).toFixed(2)} <span style={{color:'#94a3b8',fontWeight:400}}>({c.count})</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Staff Salary Summary */}
            <div style={{...styles.trainingBox, marginTop: 15}}>
              <h3 style={styles.subTitle}>Staff Salary Summary</h3>
              <div style={styles.trainingGrid}>
                <div style={styles.trainingItem}>
                  <span>Total Staff:</span>
                  <span style={styles.trainingValue}>{summary?.staff_count || 0}</span>
                </div>
                <div style={styles.trainingItem}>
                  <span>Payroll Records:</span>
                  <span style={styles.trainingValue}>{summary?.payroll_record_count || 0}</span>
                </div>
                <div style={styles.trainingItem}>
                  <span>Total Net Salary:</span>
                  <span style={styles.trainingValue}>NPR Rs {Number(summary?.payroll_total_net || 0).toFixed(2)}</span>
                </div>
                <div style={styles.trainingItem}>
                  <span>Total Paid Salary:</span>
                  <span style={{...styles.trainingValue, color: '#4CAF50'}}>NPR Rs {Number(summary?.payroll_total_paid || 0).toFixed(2)}</span>
                </div>
                <div style={styles.trainingItem}>
                  <span>Total Pending Salary:</span>
                  <span style={{...styles.trainingValue, color: '#f44336'}}>NPR Rs {Number(summary?.payroll_total_pending || 0).toFixed(2)}</span>
                </div>
                <div style={styles.trainingItem}>
                  <span>Paid / Partial / Pending:</span>
                  <span style={styles.trainingValue}>
                    {summary?.payroll_paid_count || 0} / {summary?.payroll_partial_count || 0} / {summary?.payroll_pending_count || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={styles.tabsContainer}>
          <Link to="/expense-heads" style={{ textDecoration: 'none' }}>
            <button
              style={{...styles.tab, ...(tab === 'candidates' ? styles.tabActive : {})}}
            >
              Sub Heads
            </button>
          </Link>
          <button
            style={{...styles.tab, ...(tab === 'misc' ? styles.tabActive : {})}}
            onClick={() => { setTab('misc'); setPage(1); setMiscPage(1); setSearch(''); setMiscSearch(''); }}
          >
            Misc Expenses
          </button>
        </div>

        {tab !== 'misc' ? (
        <div style={styles.layout}>
          <div>
            <div style={styles.toolbar}>
              <form onSubmit={handleSearch} style={styles.searchRow}>
                <input
                  style={styles.searchInput}
                  placeholder={tab === 'candidates' ? 'Search name, email, passport...' : 'Search participant or candidate...'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <button type="submit" style={styles.searchBtn}>Search</button>
              </form>
              <select style={styles.filterSelect} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
                <option value="">All Status</option>
                {STATUSES.map(item => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
              </select>
            </div>

            {loading ? (
              <div style={styles.loading}>Loading finance records...</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thead}>
                      {['ID', 'Candidate', 'Status', 'Paid Amount', 'Active'].map(header => (
                        <th key={header} style={styles.th}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.length === 0 && <tr><td colSpan={5} style={styles.empty}>No finance records found</td></tr>}
                    {candidates.map(candidate => (
                      <tr key={candidate.id} style={{ ...styles.tr, background: selectedCandidateId === candidate.id ? '#eef6ff' : 'transparent' }} onClick={() => setSelectedCandidateId(candidate.id)}>
                        <td style={styles.td}>{candidate.id}</td>
                        <td style={styles.td}><strong>{candidate.full_name}</strong><div style={styles.meta}>{candidate.email || 'No email'}</div></td>
                        <td style={styles.td}>{candidate.status_label || candidate.status}</td>
                        <td style={styles.td}>NPR {Number(candidate.paid_amount || 0).toFixed(2)}</td>
                        <td style={styles.td}><span style={candidate.is_active ? styles.active : styles.inactive}>{candidate.is_active ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pagination.last_page > 1 && (
              <div style={styles.pagination}>
                <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage(current => current - 1)}>← Prev</button>
                <span style={styles.pageInfo}>Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)</span>
                <button style={styles.pageBtn} disabled={page === pagination.last_page} onClick={() => setPage(current => current + 1)}>Next →</button>
              </div>
            )}
          </div>

          <aside style={styles.sidePanel}>
            <h3 style={styles.sideTitle}>Payment Update</h3>
            <p style={styles.sideSubtitle}>{selectedCandidate ? selectedCandidate.full_name : 'Select a candidate'}</p>
            {selectedCandidate && (
              <>
                <div style={styles.sideMeta}>Passport: {selectedCandidate.passport_number || '-'}</div>
                <div style={styles.sideMeta}>Current Paid: NPR {Number(selectedCandidate.paid_amount || 0).toFixed(2)}</div>
                <div style={styles.sideMeta}>Status: {selectedCandidate.status_label || selectedCandidate.status}</div>
              </>
            )}
            <div style={styles.paymentCard}>
              <label style={styles.label}>New Paid Amount</label>
              <input style={styles.input} type="number" min="0" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" />
              <button style={saving ? styles.btnDisabled : styles.btn} onClick={savePayment} disabled={saving}>{saving ? 'Saving...' : 'Update Payment'}</button>
            </div>
          </aside>
        </div>
        ) : (
          <div style={styles.miscLayout}>
            <section style={styles.miscPanel}>
              <h3 style={styles.sectionTitle}>Miscellaneous Expense Entry</h3>
              <p style={styles.subtle}>Record deductions like construction goods, vendor payments, transport, and other office expenses.</p>

              <form style={styles.miscForm} onSubmit={createMiscExpense}>
                <div style={styles.formRowTwo}>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Expense Date</label>
                    <input style={styles.input} type="date" value={miscForm.entry_date} onChange={(e) => setMiscForm((f) => ({ ...f, entry_date: e.target.value }))} />
                  </div>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Payment Method</label>
                    <select style={styles.input} value={miscForm.transaction_type} onChange={(e) => setMiscForm((f) => ({ ...f, transaction_type: e.target.value }))}>
                      <option value="cash">Cash</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                </div>

                <div style={styles.formRowTwo}>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Expense Head *</label>
                    <select style={styles.input} value={miscForm.expense_head_id} onChange={(e) => setMiscForm((f) => ({ ...f, expense_head_id: e.target.value }))}>
                      {expenseHeads.length === 0 && <option value="">No expense head configured</option>}
                      {expenseHeads.map((head) => (
                        <option key={head.id} value={head.id}>{head.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Candidate / Client Charge Link</label>
                    <select
                      style={styles.input}
                      value={miscForm.sub_head_charge_id}
                      onChange={(e) => {
                        const nextId = e.target.value
                        const selected = filteredSubHeadCandidateCharges.find((link) => String(link.id) === String(nextId))
                        setMiscForm((f) => ({
                          ...f,
                          sub_head_charge_id: nextId,
                          vendor_name: selected?.agency?.company_name || selected?.candidate?.full_name || f.vendor_name,
                          amount: selected?.amount !== undefined ? String(selected.amount) : f.amount,
                        }))
                      }}
                    >
                      <option value="">No link</option>
                      {filteredSubHeadCandidateCharges.map((link) => (
                        <option key={link.id} value={link.id}>
                          {(link.candidate?.full_name || 'Candidate')} {link.candidate?.passport_number ? `(${link.candidate.passport_number})` : ''}
                          {link.agency?.company_name ? ` | ${link.agency.company_name}` : ''}
                          {` - NPR Rs ${Number(link.amount || 0).toFixed(2)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Vendor / Payee *</label>
                    <input style={styles.input} value={miscForm.vendor_name} onChange={(e) => setMiscForm((f) => ({ ...f, vendor_name: e.target.value }))} placeholder="Who the amount is going to" />
                  </div>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Reference Number</label>
                    <input style={styles.input} value={miscForm.reference_number} onChange={(e) => setMiscForm((f) => ({ ...f, reference_number: e.target.value }))} placeholder="Bill / voucher / receipt number" />
                  </div>
                </div>

                <div style={styles.fieldBlock}>
                  <label style={styles.label}>Goods / Cost Details</label>
                  <input style={styles.input} value={miscForm.goods_or_cost} onChange={(e) => setMiscForm((f) => ({ ...f, goods_or_cost: e.target.value }))} placeholder="Construction goods, transport, materials, etc." />
                </div>

                <div style={styles.formRowTwo}>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Amount (NPR Rs) *</label>
                    <input style={styles.input} type="number" min="0" step="0.01" value={miscForm.amount} onChange={(e) => setMiscForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Search Misc Expenses</label>
                    <input style={styles.input} value={miscSearch} onChange={(e) => setMiscSearch(e.target.value)} placeholder="Search vendor, goods, reference..." />
                  </div>
                </div>

                <div style={styles.fieldBlock}>
                  <label style={styles.label}>Notes</label>
                  <textarea style={styles.textarea} value={miscForm.notes} onChange={(e) => setMiscForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Additional details about the expense" />
                </div>

                <div style={styles.actionGroup}>
                  <button type="submit" style={miscSaving ? styles.btnDisabled : styles.btn} disabled={miscSaving}>{miscSaving ? 'Saving...' : 'Add Misc Expense'}</button>
                  <button type="button" style={styles.btnGray} onClick={() => setMiscForm({ entry_date: new Date().toISOString().split('T')[0], expense_head_id: expenseHeads[0]?.id ? String(expenseHeads[0].id) : '', sub_head_charge_id: '', vendor_name: '', goods_or_cost: '', amount: '', transaction_type: 'cash', reference_number: '', notes: '' })}>Reset</button>
                </div>
              </form>
            </section>

            <section style={styles.miscPanel}>
              <h3 style={styles.sectionTitle}>Misc Expense Ledger</h3>
              <div style={styles.miscSummaryGrid}>
                <div style={styles.summaryCard}><div style={styles.summaryValue}>NPR Rs {Number(paymentStats?.daily_misc_expenses?.total || 0).toFixed(2)}</div><div style={styles.summaryLabel}>Today</div></div>
                <div style={styles.summaryCard}><div style={styles.summaryValue}>{paymentStats?.daily_misc_expenses?.count || 0}</div><div style={styles.summaryLabel}>Today Entries</div></div>
                <div style={styles.summaryCard}><div style={styles.summaryValue}>NPR Rs {Number(paymentStats?.monthly_summary?.misc_expenses || 0).toFixed(2)}</div><div style={styles.summaryLabel}>This Month</div></div>
              </div>

              {miscLoading ? (
                <div style={styles.loading}>Loading miscellaneous expenses...</div>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.thead}>
                        {['Date', 'Head', 'Vendor', 'Goods / Cost', 'Amount', 'Ref', 'Method'].map((h) => <th key={h} style={styles.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {miscExpenses.length === 0 && <tr><td colSpan={7} style={styles.empty}>No miscellaneous expenses found</td></tr>}
                      {miscExpenses.map((entry) => (
                        <tr key={entry.id} style={styles.tr}>
                          <td style={styles.td}>{entry.entry_date?.slice(0, 10)}</td>
                          <td style={styles.td}><strong>{entry.expense_head?.name || '-'}</strong></td>
                          <td style={styles.td}><strong>{entry.company_name || '-'}</strong></td>
                          <td style={styles.td}>{entry.particulars || '-'}</td>
                          <td style={styles.td}>NPR Rs {Number(entry.amount || 0).toFixed(2)}</td>
                          <td style={styles.td}>{entry.reference_number || '-'}</td>
                          <td style={styles.td}>{entry.transaction_type || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {miscPagination.last_page > 1 && (
                <div style={styles.pagination}>
                  <button style={styles.pageBtn} disabled={miscPage === 1} onClick={() => setMiscPage((p) => p - 1)}>← Prev</button>
                  <span style={styles.pageInfo}>Page {miscPagination.current_page} of {miscPagination.last_page} ({miscPagination.total} total)</span>
                  <button style={styles.pageBtn} disabled={miscPage === miscPagination.last_page} onClick={() => setMiscPage((p) => p + 1)}>Next →</button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: { display: 'grid', gap: 14 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: 800, color: '#0f2a4f', margin: 0 },
  info: { background: '#e8f1ff', border: '1px solid #cfe1fb', borderRadius: 12, padding: '10px 14px', color: '#114388', fontSize: 13, marginBottom: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 600 },
  error: { background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: '10px 14px', color: '#be123c', fontSize: 13, marginBottom: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 600 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#c33' },
  closeInfoBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 16 },
  summaryCard: { background: 'rgba(255,255,255,0.9)', border: '1px solid #dbe5f3', borderRadius: 16, padding: 18, boxShadow: '0 12px 24px rgba(17, 34, 64, 0.07)' },
  summaryValue: { fontSize: 24, fontWeight: 800, color: '#0f2a4f' },
  summaryLabel: { fontSize: 12, color: '#5f779b', marginTop: 4, fontWeight: 600 },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 16, alignItems: 'start' },
  miscLayout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(350px, 1.1fr)', gap: 16, alignItems: 'start' },
  toolbar: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', background: 'rgba(255,255,255,0.7)', border: '1px solid #dbe5f3', borderRadius: 14, padding: 10 },
  searchRow: { display: 'flex', gap: 8, flex: 1, minWidth: 230 },
  searchInput: { flex: 1, padding: '9px 12px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13 },
  searchBtn: { padding: '9px 16px', background: '#1c6bd0', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 },
  filterSelect: { padding: '9px 12px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13 },
  loading: { textAlign: 'center', color: '#526686', padding: 40, background: 'rgba(255,255,255,0.7)', border: '1px solid #dbe5f3', borderRadius: 14 },
  tableWrap: { background: 'rgba(255,255,255,0.9)', borderRadius: 16, border: '1px solid #dbe5f3', boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#eef4fc' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#35557d', borderBottom: '1px solid #d7e3f2', letterSpacing: '0.02em' },
  tr: { borderBottom: '1px solid #edf3fb', cursor: 'pointer' },
  td: { padding: '12px 16px', fontSize: 13, color: '#27466f', verticalAlign: 'top' },
  meta: { color: '#7390b5', fontSize: 11, marginTop: 2 },
  empty: { color: '#6c84a6', fontSize: 12, padding: 30, textAlign: 'center' },
  active: { background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  inactive: { background: '#fee2e2', color: '#991b1b', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 },
  pageBtn: { padding: '7px 16px', background: '#fff', border: '1px solid #cfdaea', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#27466f', fontWeight: 600 },
  pageInfo: { fontSize: 13, color: '#5f779b', fontWeight: 600 },
  sidePanel: { background: 'rgba(255,255,255,0.9)', border: '1px solid #dbe5f3', borderRadius: 16, boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)', padding: 14, position: 'sticky', top: 72 },
  miscPanel: { background: 'rgba(255,255,255,0.9)', border: '1px solid #dbe5f3', borderRadius: 16, boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)', padding: 14 },
  sideTitle: { margin: 0, fontSize: 16, color: '#0f2a4f', fontWeight: 800 },
  sideSubtitle: { marginTop: 4, marginBottom: 10, fontSize: 12, color: '#5f779b', fontWeight: 600 },
  subtle: { marginTop: 4, marginBottom: 12, fontSize: 12, color: '#5f779b' },
  sideMeta: { fontSize: 12, color: '#35557d', marginBottom: 6 },
  miscSummaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 },
  miscForm: { display: 'grid', gap: 12, marginTop: 10 },
  formRowTwo: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 },
  fieldBlock: { display: 'grid', gap: 6 },
  paymentCard: { display: 'grid', gap: 8, marginTop: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#27466f', marginBottom: 4 },
  input: { width: '100%', padding: '9px 11px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', color: '#173864', background: 'linear-gradient(180deg, #ffffff, #f8fbff)' },
  textarea: { width: '100%', minHeight: 82, padding: '9px 11px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', background: 'linear-gradient(180deg, #ffffff, #f8fbff)' },
  btn: { padding: '9px 20px', background: 'linear-gradient(135deg, #0a3772, #0f4d9d)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 },
  btnDisabled: { padding: '9px 20px', background: '#9aacbf', color: '#fff', border: 'none', borderRadius: 10, cursor: 'not-allowed', fontWeight: 700 },
  btnGray: { padding: '9px 20px', background: '#e8edf6', color: '#27466f', border: '1px solid #d4dfef', borderRadius: 10, cursor: 'pointer', fontWeight: 600 },
  actionGroup: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  statsSection: { background: 'rgba(255,255,255,0.9)', border: '1px solid #dbe5f3', borderRadius: 18, padding: 20, marginBottom: 20, boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)' },
  sectionTitle: { margin: '0 0 16px 0', fontSize: 19, fontWeight: 800, color: '#0f2a4f' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12, marginBottom: 20 },
  statCard: { background: '#f8fbff', borderRadius: 12, padding: 14, border: '1px solid #dbe5f3' },
  statLabel: { fontSize: 11, color: '#5f779b', fontWeight: 700, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: 800, color: '#059669', marginBottom: 6 },
  statMeta: { fontSize: 11, color: '#7b94b5' },
  modeBreakdown: { marginBottom: 20 },
  subTitle: { margin: '0 0 12px 0', fontSize: 14, fontWeight: 800, color: '#173864' },
  modeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  modeCard: { background: '#f8fbff', borderRadius: 12, padding: 12, border: '1px solid #dbe5f3', textAlign: 'center' },
  modeName: { fontSize: 12, color: '#5f779b', marginBottom: 6, fontWeight: 700 },
  modeAmount: { fontSize: 16, fontWeight: 800, color: '#0f2a4f' },
  monthlyBox: { background: '#f8fbff', borderRadius: 12, padding: 14, border: '1px solid #dbe5f3' },
  monthlyGrid: { display: 'grid', gap: 10 },
  monthlyItem: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#35557d' },
  monthlyValue: { fontWeight: 700, color: '#059669' },
  trainingBox: { background: '#f8fbff', borderRadius: 12, padding: 14, border: '1px solid #dbe5f3', marginTop: 15 },
  trainingGrid: { display: 'grid', gap: 10 },
  trainingItem: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#35557d' },
  trainingValue: { fontWeight: 700, color: '#114388' },
  tabsContainer: { display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #d7e3f2', overflowX: 'auto' },
  tab: { padding: '10px 15px', background: '#f4f8ff', border: '1px solid #d9e5f6', borderBottom: 'none', borderTopLeftRadius: 12, borderTopRightRadius: 12, fontSize: 13, fontWeight: 700, color: '#7390b5', cursor: 'pointer', marginBottom: '-1px', whiteSpace: 'nowrap' },
  tabActive: { color: '#114388', background: '#ffffff', borderColor: '#cfe1fb' },
  statusPaid: { background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  statusPartial: { background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  statusUnpaid: { background: '#fee2e2', color: '#e30d0d', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
}
