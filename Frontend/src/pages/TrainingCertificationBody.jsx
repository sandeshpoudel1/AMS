import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const emptyForm = {
  company_name: '',
  phone: '',
  email: '',
  country: '',
}

const emptyCandidateEntryForm = {
  enrollment_id: '',
  invoice_number: '',
  invoice_amount: '',
  dispatch_status: 'not_dispatched',
  certificate_card_status: 'pending',
  notes: '',
}

export default function TrainingCertificationBody() {
  const [companies, setCompanies] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [assessments, setAssessments] = useState([])
  const [candidateEntryForm, setCandidateEntryForm] = useState(emptyCandidateEntryForm)
  const [candidateEntrySaving, setCandidateEntrySaving] = useState(false)
  const [editingAssessmentId, setEditingAssessmentId] = useState(null)
  const [showForm, setShowForm] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const loadCompanies = async () => {
    setLoading(true)
    try {
      const res = await api.get('/training-companies')
      setCompanies(Array.isArray(res.data.data) ? res.data.data : [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load training companies')
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  const loadEnrollments = async () => {
    try {
      const res = await api.get('/training-enrollments', { params: { per_page: 500 } })
      setEnrollments(Array.isArray(res.data?.data?.enrollments) ? res.data.data.enrollments : [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load training enrollments')
      setEnrollments([])
    }
  }

  const loadAssessments = async () => {
    try {
      const res = await api.get('/training-assessments', { params: { per_page: 500 } })
      setAssessments(Array.isArray(res.data?.data?.assessments) ? res.data.data.assessments : [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load invoice and dispatch records')
      setAssessments([])
    }
  }

  useEffect(() => {
    loadCompanies()
    loadEnrollments()
    loadAssessments()
  }, [])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const saveCompany = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!form.company_name.trim()) {
      setError('Training company name is required')
      return
    }

    try {
      const payload = {
        company_name: form.company_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        country: form.country.trim(),
      }

      if (editingId) {
        await api.put(`/training-companies/${editingId}`, payload)
        setSuccess('Training company updated successfully')
      } else {
        await api.post('/training-companies', payload)
        setSuccess('Training company added successfully')
      }

      resetForm()
      setShowForm(true)
      loadCompanies()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save training company')
    }
  }

  const editCompany = (company) => {
    setForm({
      company_name: company.company_name || '',
      phone: company.phone || '',
      email: company.email || '',
      country: company.country || '',
    })
    setEditingId(company.id)
    setShowForm(true)
  }

  const deleteCompany = async (companyId) => {
    if (!confirm('Delete this training company?')) return

    clearMessages()
    try {
      await api.delete(`/training-companies/${companyId}`)
      setSuccess('Training company deleted successfully')
      loadCompanies()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete training company')
    }
  }

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return companies

    return companies.filter((company) => {
      const name = (company.company_name || '').toLowerCase()
      const phone = (company.phone || '').toLowerCase()
      const email = (company.email || '').toLowerCase()
      const country = (company.country || '').toLowerCase()
      return name.includes(query) || phone.includes(query) || email.includes(query) || country.includes(query)
    })
  }, [companies, search])

  const resetCandidateEntryForm = () => {
    setCandidateEntryForm(emptyCandidateEntryForm)
    setEditingAssessmentId(null)
  }

  const handleCandidateEntryEnrollmentChange = (enrollmentId) => {
    const existing = assessments.find((row) => String(row.enrollment_id) === String(enrollmentId)) || null
    if (!existing) {
      setCandidateEntryForm((prev) => ({ ...prev, enrollment_id: enrollmentId }))
      setEditingAssessmentId(null)
      return
    }

    setCandidateEntryForm({
      enrollment_id: enrollmentId,
      invoice_number: existing.invoice_number || '',
      invoice_amount: existing.invoice_amount ?? '',
      dispatch_status: existing.dispatch_status || 'not_dispatched',
      certificate_card_status: existing.certificate_card_status || 'pending',
      notes: existing.notes || '',
    })
    setEditingAssessmentId(existing.id)
  }

  const saveCandidateEntry = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!candidateEntryForm.enrollment_id) {
      setError('Please select candidate enrollment first')
      return
    }

    setCandidateEntrySaving(true)
    try {
      const payload = {
        enrollment_id: Number(candidateEntryForm.enrollment_id),
        result: 'pending',
        re_assessment_required: 0,
        certificate_card_status: candidateEntryForm.certificate_card_status,
        dispatch_status: candidateEntryForm.dispatch_status,
        invoice_number: candidateEntryForm.invoice_number?.trim() || null,
        invoice_amount: candidateEntryForm.invoice_amount === '' ? 0 : Number(candidateEntryForm.invoice_amount),
        notes: candidateEntryForm.notes?.trim() || null,
      }

      if (editingAssessmentId) {
        await api.put(`/training-assessments/${editingAssessmentId}`, payload)
        setSuccess('Candidate invoice/dispatch entry updated successfully')
      } else {
        const existing = assessments.find((row) => String(row.enrollment_id) === String(candidateEntryForm.enrollment_id))
        if (existing?.id) {
          await api.put(`/training-assessments/${existing.id}`, payload)
          setSuccess('Candidate invoice/dispatch entry updated successfully')
        } else {
          await api.post('/training-assessments', payload)
          setSuccess('Candidate invoice/dispatch entry saved successfully')
        }
      }

      resetCandidateEntryForm()
      loadAssessments()
    } catch (eSave) {
      setError(eSave.response?.data?.message || 'Failed to save candidate invoice/dispatch entry')
    } finally {
      setCandidateEntrySaving(false)
    }
  }

  const candidateInvoiceRows = useMemo(() => {
    return assessments
      .filter((row) => row?.enrollment)
      .sort((a, b) => Number(b.id) - Number(a.id))
  }, [assessments])

  return (
    <SidebarLayout
      title="Training Certification Body"
      headerExtra={<button style={styles.addBtn} onClick={() => { resetForm(); setShowForm(true) }}>+ Add Training Company</button>}
    >
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div>
            <div style={styles.kicker}>Settings</div>
            <h2 style={styles.heroTitle}>Training company setup</h2>
            <p style={styles.heroText}>Use this page to manage training companies saved in the database.</p>
          </div>
          <div style={styles.heroMeta}>
            <div style={styles.metaCard}>
              <div style={styles.metaValue}>{companies.length}</div>
              <div style={styles.metaLabel}>Training companies</div>
            </div>
          </div>
        </div>

        {error && <div style={styles.error}>{error}<button style={styles.closeBtn} onClick={() => setError('')}>✕</button></div>}
        {success && <div style={styles.success}>{success}<button style={styles.closeBtn} onClick={() => setSuccess('')}>✕</button></div>}

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Add Company</h3>
              <p style={styles.panelText}>Create and maintain training company records here.</p>
            </div>
          </div>

          {showForm ? (
            <form onSubmit={saveCompany}>
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Training Company Name *</label>
                  <input
                    style={styles.input}
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    placeholder="Company name"
                  />
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Phone</label>
                  <input
                    style={styles.input}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    style={styles.input}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Email address"
                  />
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Country</label>
                  <input
                    style={styles.input}
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="Country"
                  />
                </div>
              </div>

              <div style={styles.formActions}>
                <button type="submit" style={styles.primaryBtn}>{editingId ? 'Update Company' : 'Save Company'}</button>
                <button type="button" style={styles.secondaryBtn} onClick={resetForm}>Reset</button>
              </div>
            </form>
          ) : (
            <div style={styles.emptyState}>Open the form to add a training company.</div>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Training Company List</h3>
              <p style={styles.panelText}>All saved companies for training certification operations.</p>
            </div>
          </div>

          <div style={styles.searchWrap}>
            <input
              style={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, phone, email, country"
            />
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading training companies...</div>
          ) : filteredCompanies.length === 0 ? (
            <div style={styles.emptyState}>No training companies found.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Company</th>
                    <th style={styles.th}>Phone</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Country</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((company) => (
                    <tr key={company.id} style={styles.tr}>
                      <td style={styles.td}><strong>{company.company_name}</strong></td>
                      <td style={styles.td}>{company.phone || '-'}</td>
                      <td style={styles.td}>{company.email || '-'}</td>
                      <td style={styles.td}>{company.country || '-'}</td>
                      <td style={styles.td}>
                        <button style={styles.actionBtn} onClick={() => editCompany(company)}>Edit</button>
                        <button style={styles.deleteBtn} onClick={() => deleteCompany(company.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Candidate Invoice & Certificate Dispatch Entry</h3>
              <p style={styles.panelText}>Record candidate enrollment company (CISRS, IRATA etc.), invoice, and certificate dispatch yes/no.</p>
            </div>
          </div>

          <form onSubmit={saveCandidateEntry}>
            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Candidate Enrollment *</label>
                <select
                  style={styles.input}
                  value={candidateEntryForm.enrollment_id}
                  onChange={(e) => handleCandidateEntryEnrollmentChange(e.target.value)}
                >
                  <option value="">Select candidate enrollment</option>
                  {enrollments.map((enrollment) => (
                    <option key={enrollment.id} value={enrollment.id}>
                      {(enrollment.candidate?.full_name || enrollment.participant_name || 'Candidate')} - {enrollment.training?.name || 'Training'} - {enrollment.training_company?.company_name || 'Company'}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Invoice Number</label>
                <input
                  style={styles.input}
                  value={candidateEntryForm.invoice_number}
                  onChange={(e) => setCandidateEntryForm((prev) => ({ ...prev, invoice_number: e.target.value }))}
                  placeholder="Invoice number"
                />
              </div>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Invoice Amount (NPR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  style={styles.input}
                  value={candidateEntryForm.invoice_amount}
                  onChange={(e) => setCandidateEntryForm((prev) => ({ ...prev, invoice_amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Certificate Dispatch to Candidate</label>
                <select
                  style={styles.input}
                  value={candidateEntryForm.dispatch_status}
                  onChange={(e) => setCandidateEntryForm((prev) => ({ ...prev, dispatch_status: e.target.value }))}
                >
                  <option value="not_dispatched">No</option>
                  <option value="dispatched">Yes</option>
                </select>
              </div>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Certificate/Card Status</label>
                <select
                  style={styles.input}
                  value={candidateEntryForm.certificate_card_status}
                  onChange={(e) => setCandidateEntryForm((prev) => ({ ...prev, certificate_card_status: e.target.value }))}
                >
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                  <option value="not_received">Not Received</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Notes</label>
                <input
                  style={styles.input}
                  value={candidateEntryForm.notes}
                  onChange={(e) => setCandidateEntryForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div style={styles.formActions}>
              <button type="submit" style={candidateEntrySaving ? styles.secondaryBtn : styles.primaryBtn} disabled={candidateEntrySaving}>
                {candidateEntrySaving ? 'Saving...' : editingAssessmentId ? 'Update Entry' : 'Save Entry'}
              </button>
              <button type="button" style={styles.secondaryBtn} onClick={resetCandidateEntryForm}>Reset</button>
            </div>
          </form>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Candidate</th>
                  <th style={styles.th}>Training</th>
                  <th style={styles.th}>Company</th>
                  <th style={styles.th}>Invoice No</th>
                  <th style={styles.th}>Invoice Amount</th>
                  <th style={styles.th}>Dispatch</th>
                </tr>
              </thead>
              <tbody>
                {candidateInvoiceRows.length === 0 && (
                  <tr>
                    <td colSpan={6} style={styles.emptyState}>No candidate invoice/dispatch entries found.</td>
                  </tr>
                )}
                {candidateInvoiceRows.map((row) => (
                  <tr key={row.id} style={styles.tr}>
                    <td style={styles.td}>{row.enrollment?.candidate?.full_name || row.enrollment?.participant_name || '-'}</td>
                    <td style={styles.td}>{row.enrollment?.training?.name || '-'}</td>
                    <td style={styles.td}>{row.enrollment?.training_company?.company_name || '-'}</td>
                    <td style={styles.td}>{row.invoice_number || '-'}</td>
                    <td style={styles.td}>NPR {Number(row.invoice_amount || 0).toFixed(2)}</td>
                    <td style={styles.td}>{row.dispatch_status === 'dispatched' ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  heroMeta: { display: 'grid', gridTemplateColumns: 'repeat(1, minmax(0, 1fr))', gap: 12, minWidth: 160 },
  metaCard: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 16, padding: 16, backdropFilter: 'blur(12px)' },
  metaValue: { fontSize: 24, fontWeight: 800, lineHeight: 1 },
  metaLabel: { marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  addBtn: { background: '#0f766e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 700 },
  error: { background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  success: { background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1 },
  panel: { background: '#fff', borderRadius: 18, padding: 20, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)', border: '1px solid #e2e8f0' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  panelTitle: { margin: 0, fontSize: 18, color: '#0f172a' },
  panelText: { margin: '6px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.5 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  formActions: { display: 'flex', gap: 10, marginTop: 8 },
  primaryBtn: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' },
  searchWrap: { marginBottom: 12 },
  searchInput: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, boxSizing: 'border-box' },
  emptyState: { padding: '28px 12px', textAlign: 'center', color: '#64748b' },
  tableWrap: { overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 14px', fontSize: 13, color: '#334155' },
  actionBtn: { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 8 },
  deleteBtn: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
}
