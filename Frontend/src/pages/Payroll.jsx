import { useEffect, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

export default function Payroll() {
  const [payroll, setPayroll] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('list')
  const [selectedPayroll, setSelectedPayroll] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [summary, setSummary] = useState({})
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [staff, setStaff] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [daybookPayrollBookings, setDaybookPayrollBookings] = useState({})

  const getApiErrorMessage = (error, fallback) => {
    const data = error?.response?.data
    const fieldErrors = data?.errors
    if (fieldErrors && typeof fieldErrors === 'object') {
      const messages = Object.values(fieldErrors).flat().filter(Boolean)
      if (messages.length > 0) {
        return messages.join('\n')
      }
    }
    return data?.message || fallback
  }

  const [formData, setFormData] = useState({
    staff_id: '',
    pay_period_start: '',
    pay_period_end: '',
    base_salary: '',
    allowances: '',
    overtime_hours: '',
    overtime_rate: '',
    tax_deduction: '',
    insurance_deduction: '',
    other_deductions: '',
    payment_method: 'bank_transfer',
    notes: '',
  })

  const toNumber = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const normalizePayrollRow = (row, bookingMap = {}) => {
    const baseSalary = toNumber(row.base_salary ?? row.salary_amount)
    const allowances = toNumber(row.allowances)
    const overtimeAmount = toNumber(
      row.overtime_amount ?? (toNumber(row.overtime_hours) * toNumber(row.overtime_rate))
    )
    const grossAmount = toNumber(row.gross_amount ?? (baseSalary + allowances + overtimeAmount) ?? row.salary_amount)
    const totalDeductions = toNumber(
      row.total_deductions ??
      (toNumber(row.tax_deduction) + toNumber(row.insurance_deduction) + toNumber(row.other_deductions))
    )
    const netAmount = toNumber(row.net_amount ?? (grossAmount - totalDeductions) ?? row.salary_amount)
    const amountPaid = toNumber(bookingMap[`PAYROLL:${row.id}`] ?? row.amount_paid ?? row.paid_amount ?? row.paid)
    const paymentStatus = row.payment_status || (amountPaid <= 0 ? 'pending' : amountPaid >= netAmount ? 'paid' : 'partial')
    const paidOn = typeof row.paid_on === 'string' ? row.paid_on.slice(0, 10) : ''

    return {
      ...row,
      base_salary: baseSalary,
      gross_amount: grossAmount,
      total_deductions: totalDeductions,
      net_amount: netAmount,
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      pay_period_start: row.pay_period_start || paidOn,
      pay_period_end: row.pay_period_end || paidOn,
      payment_method: row.payment_method || row.payment_option || 'bank_transfer',
      notes: row.notes ?? row.remarks ?? '',
      staff_name: row.staff?.full_name || row.staff?.name || row.staff_name || row.full_name || row.name || 'Unknown',
    }
  }

  const buildSummaryFromRows = (rows) => {
    const summary = rows.reduce((acc, row) => {
      const gross = toNumber(row.gross_amount)
      const deductions = toNumber(row.total_deductions)
      const net = toNumber(row.net_amount)
      const paid = toNumber(row.amount_paid)
      const due = Math.max(net - paid, 0)
      const status = row.payment_status

      acc.total_payroll += gross
      acc.total_deductions += deductions
      acc.total_net += net
      acc.total_paid += paid
      acc.total_pending += due

      if (status === 'paid') acc.paid_count += 1
      if (status === 'partial') acc.partial_payroll_count += 1
      if (status === 'pending') acc.pending_payroll_count += 1
      return acc
    }, {
      total_payroll: 0,
      total_deductions: 0,
      total_net: 0,
      total_paid: 0,
      total_pending: 0,
      pending_payroll_count: 0,
      partial_payroll_count: 0,
      paid_count: 0,
    })

    return summary
  }

  useEffect(() => {
    fetchPayroll()
    fetchStaff()
  }, [search, filterStatus, currentPage])

  const fetchDaybookPayrollBookings = async () => {
    try {
      const response = await api.get('/daybook', {
        params: {
          type: 'payment',
          page: 1,
          per_page: 500,
        },
      })

      const entries = Array.isArray(response?.data?.data?.entries)
        ? response.data.data.entries
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : []

      const bookingMap = {}
      entries.forEach((entry) => {
        const reference = String(entry?.reference_number || '')
        if (!reference.startsWith('PAYROLL:')) return

        const payrollId = reference.replace('PAYROLL:', '')
        const amount = Number(entry?.amount || 0)
        if (amount <= 0) return

        bookingMap[`PAYROLL:${payrollId}`] = amount
      })

      setDaybookPayrollBookings(bookingMap)
      return bookingMap
    } catch (error) {
      console.error('Error fetching daybook payroll bookings:', error)
      setDaybookPayrollBookings({})
      return {}
    }
  }

  const fetchPayroll = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        per_page: 15,
        page: currentPage,
      })
      if (search) params.append('search', search)
      if (filterStatus) params.append('payment_status', filterStatus)

      const response = await api.get(`/payroll?${params.toString()}`)
      const payload = response?.data?.data
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.entries)
          ? payload.entries
          : []

      const bookingMap = await fetchDaybookPayrollBookings()
      const normalizedRows = rows.map((row) => normalizePayrollRow(row, bookingMap))
      setPayroll(normalizedRows)

      const apiSummary = response?.data?.summary || payload?.summary
      const hasSummaryValues = apiSummary && typeof apiSummary === 'object' && Object.keys(apiSummary).length > 0
      setSummary(hasSummaryValues ? apiSummary : buildSummaryFromRows(normalizedRows))
    } catch (error) {
      console.error('Error fetching payroll:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await api.get('/staff')
      const payload = response?.data?.data
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.staff)
          ? payload.staff
          : []
      setStaff(rows)
    } catch (error) {
      console.error('Error fetching staff:', error)
      setStaff([])
    }
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const savePayroll = async () => {
    if (!formData.staff_id || !formData.base_salary || !formData.pay_period_start || !formData.pay_period_end) {
      alert('Please fill in required fields')
      return
    }

    if (new Date(formData.pay_period_end) <= new Date(formData.pay_period_start)) {
      alert('Pay Period End must be after Pay Period Start')
      return
    }

    try {
      const baseSalary = parseFloat(formData.base_salary)
      const allowances = parseFloat(formData.allowances || 0)
      const overtimeHours = parseFloat(formData.overtime_hours || 0)
      const overtimeRate = parseFloat(formData.overtime_rate || 0)
      const taxDeduction = parseFloat(formData.tax_deduction || 0)
      const insuranceDeduction = parseFloat(formData.insurance_deduction || 0)
      const otherDeductions = parseFloat(formData.other_deductions || 0)

      const response = await api.post('/payroll', {
        ...formData,
        staff_id: Number(formData.staff_id),
        base_salary: baseSalary,
        allowances,
        overtime_hours: overtimeHours,
        overtime_rate: overtimeRate,
        tax_deduction: taxDeduction,
        insurance_deduction: insuranceDeduction,
        other_deductions: otherDeductions,

        // Compatibility keys for older/alternate payroll APIs.
        staff_member_id: Number(formData.staff_id),
        salary_amount: baseSalary,
        payment_option: formData.payment_method,
        paid_on: formData.pay_period_end,
      })

      if (response.data.success) {
        alert('Payroll record created successfully')
        setFormData({
          staff_id: '',
          pay_period_start: '',
          pay_period_end: '',
          base_salary: '',
          allowances: '',
          overtime_hours: '',
          overtime_rate: '',
          tax_deduction: '',
          insurance_deduction: '',
          other_deductions: '',
          payment_method: 'bank_transfer',
          notes: '',
        })
        setShowForm(false)
        fetchPayroll()
      }
    } catch (error) {
      console.error('Error saving payroll:', error)
      alert(getApiErrorMessage(error, 'Error saving payroll'))
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return '#22c55e'
      case 'partial':
        return '#eab308'
      case 'pending':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const padTime = (value) => String(value).padStart(2, '0')
  const formatDateTime = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) {
      return String(value).replace('T', ' ').replace('Z', '').split('.')[0]
    }
    return `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())} ${padTime(date.getHours())}:${padTime(date.getMinutes())}:${padTime(date.getSeconds())}`
  }

  const asMoney = (value) => Number(value || 0).toFixed(2)
  const asCount = (value) => Number(value || 0)

  return (
    <SidebarLayout title="Payroll Management">
      <div style={styles.container}>
        <div style={styles.tabsContainer}>
          <button style={{ ...styles.tab, ...(activeTab === 'list' ? styles.activeTab : {}) }} onClick={() => setActiveTab('list')}>Payroll Records</button>
          <button style={{ ...styles.tab, ...(activeTab === 'summary' ? styles.activeTab : {}) }} onClick={() => setActiveTab('summary')}>Summary</button>
        </div>

        {activeTab === 'list' && (
          <div style={styles.content}>
            <div style={styles.filterBar}>
              <input type="text" placeholder="Search staff name..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }} style={styles.searchInput} />
              <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1) }} style={styles.selectInput}>
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
              <button style={styles.addBtn} onClick={() => setShowForm(!showForm)}>+ Create Payroll</button>
            </div>

            {showForm && (
              <div style={styles.formContainer}>
                <h3 style={styles.formTitle}>Create Payroll Record</h3>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label>Staff Member *</label>
                    <select name="staff_id" value={formData.staff_id} onChange={handleFormChange} style={styles.formInput}>
                      <option value="">Select Staff</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.name || `Staff #${s.id}`}</option>)}
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label>Pay Period Start *</label>
                    <input type="date" name="pay_period_start" value={formData.pay_period_start} onChange={handleFormChange} style={styles.formInput} />
                  </div>

                  <div style={styles.formGroup}>
                    <label>Pay Period End *</label>
                    <input type="date" name="pay_period_end" value={formData.pay_period_end} onChange={handleFormChange} style={styles.formInput} />
                  </div>

                  <div style={styles.formGroup}>
                    <label>Base Salary *</label>
                    <input type="number" name="base_salary" value={formData.base_salary} onChange={handleFormChange} placeholder="0.00" step="0.01" style={styles.formInput} />
                  </div>

                  <div style={styles.formGroup}>
                    <label>Allowances</label>
                    <input type="number" name="allowances" value={formData.allowances} onChange={handleFormChange} placeholder="0.00" step="0.01" style={styles.formInput} />
                  </div>

                  <div style={styles.formGroup}>
                    <label>Overtime Hours</label>
                    <input type="number" name="overtime_hours" value={formData.overtime_hours} onChange={handleFormChange} placeholder="0.00" step="0.01" style={styles.formInput} />
                  </div>

                  <div style={styles.formGroup}>
                    <label>Overtime Rate</label>
                    <input type="number" name="overtime_rate" value={formData.overtime_rate} onChange={handleFormChange} placeholder="0.00" step="0.01" style={styles.formInput} />
                  </div>

                  <div style={styles.formGroup}>
                    <label>Tax Deduction</label>
                    <input type="number" name="tax_deduction" value={formData.tax_deduction} onChange={handleFormChange} placeholder="0.00" step="0.01" style={styles.formInput} />
                  </div>

                  <div style={styles.formGroup}>
                    <label>Insurance Deduction</label>
                    <input type="number" name="insurance_deduction" value={formData.insurance_deduction} onChange={handleFormChange} placeholder="0.00" step="0.01" style={styles.formInput} />
                  </div>

                  <div style={styles.formGroup}>
                    <label>Other Deductions</label>
                    <input type="number" name="other_deductions" value={formData.other_deductions} onChange={handleFormChange} placeholder="0.00" step="0.01" style={styles.formInput} />
                  </div>

                  <div style={styles.formGroup}>
                    <label>Payment Method</label>
                    <select name="payment_method" value={formData.payment_method} onChange={handleFormChange} style={styles.formInput}>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="online">Online</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label>Notes</label>
                    <textarea name="notes" value={formData.notes} onChange={handleFormChange} placeholder="Additional notes..." style={{ ...styles.formInput, minHeight: 80 }} />
                  </div>
                </div>

                <div style={styles.formActions}>
                  <button style={styles.saveBtn} onClick={savePayroll}>Save Payroll</button>
                  <button style={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableCell}>Staff</th>
                    <th style={styles.tableCell}>Period</th>
                    <th style={styles.tableCell}>Gross</th>
                    <th style={styles.tableCell}>Deductions</th>
                    <th style={styles.tableCell}>Net</th>
                    <th style={styles.tableCell}>Booked in Daybook</th>
                    <th style={styles.tableCell}>Status</th>
                    <th style={styles.tableCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" style={{ ...styles.tableCell, textAlign: 'center' }}>Loading...</td></tr>
                  ) : payroll.length === 0 ? (
                    <tr><td colSpan="8" style={{ ...styles.tableCell, textAlign: 'center', color: '#999' }}>No payroll records found</td></tr>
                  ) : (
                    payroll.map((p) => {
                      const paymentStatus = p.payment_status || 'pending'
                      const grossAmount = Number(p.gross_amount || 0)
                      const totalDeductions = Number(p.total_deductions || 0)
                      const netAmount = Number(p.net_amount || 0)
                      const amountPaid = Number(p.amount_paid || 0)
                      return (
                      <tr key={p.id} style={selectedPayroll?.id === p.id ? { ...styles.tableRow, background: '#e0f2fe' } : styles.tableRow}>
                        <td style={styles.tableCell}>{p.staff_name || p.staff?.full_name || p.staff?.name || 'Unknown'}</td>
                        <td style={styles.tableCell}>{formatDateTime(p.pay_period_start)} to {formatDateTime(p.pay_period_end)}</td>
                        <td style={styles.tableCell}>{grossAmount.toFixed(2)}</td>
                        <td style={styles.tableCell}>{totalDeductions.toFixed(2)}</td>
                        <td style={styles.tableCell}>{netAmount.toFixed(2)}</td>
                        <td style={styles.tableCell}>{amountPaid.toFixed(2)}</td>
                        <td style={styles.tableCell}>
                          <span style={{ background: getStatusColor(paymentStatus), color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                            {paymentStatus.toUpperCase()}
                          </span>
                        </td>
                        <td style={styles.tableCell}><button style={styles.actionBtn} onClick={() => setSelectedPayroll(p)}>View</button></td>
                      </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {selectedPayroll && (
              <div style={styles.sidePanel}>
                <div style={styles.sidePanelHeader}>
                  <h3 style={styles.sidePanelTitle}>{selectedPayroll.staff_name || selectedPayroll.staff?.full_name || selectedPayroll.staff?.name || 'Staff details'}</h3>
                  <button style={styles.closeBtn} onClick={() => setSelectedPayroll(null)}>✕</button>
                </div>

                <div style={styles.sidePanelContent}>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Period:</span><span>{selectedPayroll.pay_period_start} to {selectedPayroll.pay_period_end}</span></div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Gross Amount:</span><span>{Number(selectedPayroll.gross_amount || 0).toFixed(2)}</span></div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Total Deductions:</span><span>{Number(selectedPayroll.total_deductions || 0).toFixed(2)}</span></div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Net Amount:</span><span style={{ fontWeight: 600, fontSize: 16 }}>{Number(selectedPayroll.net_amount || 0).toFixed(2)}</span></div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Booked in Daybook:</span><span>{Number(selectedPayroll.amount_paid || 0).toFixed(2)}</span></div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Due Amount:</span>
                    <span style={{ color: (Number(selectedPayroll.net_amount || 0) - Number(selectedPayroll.amount_paid || 0)) > 0 ? '#eab308' : '#22c55e', fontWeight: 600 }}>
                      {(Number(selectedPayroll.net_amount || 0) - Number(selectedPayroll.amount_paid || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>
                    Salary payment is recorded through Daybook and reflected here for the selected payroll period.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total Payroll</div>
              <div style={styles.summaryValue}>{asMoney(summary.total_payroll)}</div>
              <div style={styles.summarySubtext}>{asCount(summary.pending_payroll_count)} pending</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total Deductions</div>
              <div style={styles.summaryValue}>{asMoney(summary.total_deductions)}</div>
              <div style={styles.summarySubtext}>From all payroll</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total Net</div>
              <div style={styles.summaryValue}>{asMoney(summary.total_net)}</div>
              <div style={styles.summarySubtext}>After deductions</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Booked in Daybook</div>
              <div style={styles.summaryValue}>{asMoney(summary.total_paid)}</div>
              <div style={styles.summarySubtext}>{asCount(summary.paid_count)} fully paid</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Pending Amount</div>
              <div style={styles.summaryValue}>{asMoney(summary.total_pending)}</div>
              <div style={styles.summarySubtext}>Still to be paid</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Partial Payments</div>
              <div style={styles.summaryValue}>{asCount(summary.partial_payroll_count)}</div>
              <div style={styles.summarySubtext}>Records with partial payment</div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: { padding: 0 },
  tabsContainer: { display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: 20 },
  tab: { padding: '12px 20px', border: 'none', background: '#f3f4f6', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#6b7280', borderBottom: '2px solid transparent', transition: 'all 0.2s' },
  activeTab: { background: '#fff', color: '#1e3a5f', borderBottomColor: '#1e3a5f' },
  content: { padding: 0 },
  filterBar: { display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' },
  searchInput: { flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 },
  selectInput: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 },
  addBtn: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  formContainer: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 },
  formTitle: { margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#1e293b' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  formLabel: { fontSize: 13, fontWeight: 600, color: '#4b5563' },
  formInput: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' },
  formActions: { display: 'flex', gap: 12 },
  saveBtn: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
  cancelBtn: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
  tableWrapper: { overflowX: 'auto', marginBottom: 20 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' },
  tableRow: { borderBottom: '1px solid #e5e7eb' },
  tableCell: { padding: '12px', textAlign: 'left', fontSize: 14, color: '#374151' },
  actionBtn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 },
  sidePanel: { position: 'fixed', right: 0, top: 56, width: 350, height: 'calc(100vh - 56px)', background: '#fff', borderLeft: '1px solid #e5e7eb', overflowY: 'auto', zIndex: 100 },
  sidePanelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid #e5e7eb' },
  sidePanelTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' },
  sidePanelContent: { padding: 16 },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, borderBottom: '1px solid #f3f4f6' },
  detailLabel: { fontWeight: 600, color: '#6b7280' },
  paymentForm: { marginTop: 20, paddingTop: 20, borderTop: '1px solid #e5e7eb' },
  paymentInput: { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, marginTop: 8, boxSizing: 'border-box' },
  paymentBtn: { width: '100%', padding: '10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, marginTop: 12 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 },
  summaryCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 },
  summaryLabel: { fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 8 },
  summaryValue: { fontSize: 28, fontWeight: 700, color: '#1e293b', marginBottom: 4 },
  summarySubtext: { fontSize: 12, color: '#9ca3af' },
}
