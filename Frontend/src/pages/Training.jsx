import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid']

export default function Training() {
  const [enrollments, setEnrollments] = useState([])
  const [allEnrollments, setAllEnrollments] = useState([])
  const [trainings, setTrainings] = useState([])
  const [trainingCompanies, setTrainingCompanies] = useState([])
  const [pagination, setPagination] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTraining, setFilterTraining] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [summary, setSummary] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [candidateSearch, setCandidateSearch] = useState('')

  // Assessment & Certification state
  const [assessments, setAssessments] = useState([])
  const [assessmentTotals, setAssessmentTotals] = useState(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [showAssessmentForm, setShowAssessmentForm] = useState(false)
  const [assessmentFormLoading, setAssessmentFormLoading] = useState(false)
  const [editingAssessmentId, setEditingAssessmentId] = useState(null)
  const [showCertificationForm, setShowCertificationForm] = useState(false)
  const [certificationFormLoading, setCertificationFormLoading] = useState(false)
  const [editingCertificationId, setEditingCertificationId] = useState(null)

  const defaultAssessmentForm = {
    enrollment_id: '',
    result: 'pending',
    re_assessment_required: false,
    reassessment_1_date: '',
    reassessment_1_result: '',
    reassessment_2_date: '',
    reassessment_2_result: '',
  }
  const [assessmentForm, setAssessmentForm] = useState(defaultAssessmentForm)

  const defaultCertificationForm = {
    enrollment_id: '',
    certificate_card_status: 'pending',
    dispatch_status: 'not_dispatched',
    certification_expiry_date: '',
    notes: '',
  }
  const [certificationForm, setCertificationForm] = useState(defaultCertificationForm)

  const defaultForm = {
    candidate_id: '',
    participant_name: '',
    training_id: '',
    training_company_id: '',
    enrollment_date: new Date().toISOString().split('T')[0],
    start_date: '',
    end_date: '',
    duration_days: 5,
    passport_number: '',
    previous_experience: '',
    instructor_assigned: '',
    paid_amount: '',
    advance_payment_1: '',
    advance_payment_2: '',
    advance_payment_3: '',
    discount_amount: '',
    total_amount_paid: '',
    payment_reference: '',
    notes: '',
  }
  const [form, setForm] = useState(defaultForm)

  const loadCandidates = async () => {
    try {
      const res = await api.get('/candidates', { params: { per_page: 500 } })
      setCandidates(res.data.data.candidates || [])
    } catch (e) {
      console.error('Failed to load candidates', e)
    }
  }

  const loadAssessments = async () => {
    setAssessmentLoading(true)
    try {
      const res = await api.get('/training-assessments', { params: { per_page: 200 } })
      setAssessments(res.data.data.assessments || [])
      setAssessmentTotals(res.data.data.totals || null)
    } catch (e) {
      console.error('Failed to load assessments', e)
    } finally {
      setAssessmentLoading(false)
    }
  }

  const loadAllEnrollments = async () => {
    try {
      const res = await api.get('/training-enrollments', { params: { per_page: 500 } })
      setAllEnrollments(Array.isArray(res.data?.data?.enrollments) ? res.data.data.enrollments : [])
    } catch (e) {
      console.error('Failed to load all enrollments', e)
      setAllEnrollments([])
    }
  }

  const load = async (p = 1) => {
    setLoading(true)
    try {
      const params = { page: p, per_page: 15 }
      if (search) params.search = search
      if (filterTraining) params.training_id = filterTraining
      if (filterStatus) params.payment_status = filterStatus

      const [enrollRes, trainRes, statsRes, companyRes] = await Promise.all([
        api.get('/training-enrollments', { params }),
        api.get('/trainings'),
        api.get('/training-statistics'),
        api.get('/training-companies'),
      ])

      setEnrollments(enrollRes.data.data.enrollments || [])
      setPagination(enrollRes.data.pagination)
      setTrainings(trainRes.data.data || [])
      setSummary(statsRes.data.data)
      setTrainingCompanies(companyRes.data.data || [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load training data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(page)
    loadCandidates()
    loadAssessments()
    loadAllEnrollments()
  }, [page, filterTraining, filterStatus])

  useEffect(() => {
    // Default to the first company so enrollment is always company-bound.
    if (!editingId && !form.training_company_id && trainingCompanies.length > 0) {
      setForm((prev) => ({
        ...prev,
        training_company_id: String(trainingCompanies[0].id),
      }))
    }
  }, [trainingCompanies, editingId, form.training_company_id])

  useEffect(() => {
    // Paid amount auto-fills from advances + discount for both new and edit modes.

    const autoPaid = Number(form.advance_payment_1 || 0)
      + Number(form.advance_payment_2 || 0)
      + Number(form.advance_payment_3 || 0)
      + Number(form.discount_amount || 0)
    const nextValue = String(autoPaid)

    setForm((prev) => {
      if (prev.paid_amount === nextValue) return prev
      return {
        ...prev,
        paid_amount: nextValue,
      }
    })
  }, [form.advance_payment_1, form.advance_payment_2, form.advance_payment_3, form.discount_amount])

  const clearMessages = () => {
    setError('')
    setInfo('')
  }

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => String(candidate.id) === String(form.candidate_id)) || null,
    [candidates, form.candidate_id]
  )

  const selectedTraining = useMemo(
    () => trainings.find((training) => String(training.id) === String(form.training_id)) || null,
    [trainings, form.training_id]
  )

  const selectedAssessmentEnrollment = useMemo(
    () => allEnrollments.find((enrollment) => String(enrollment.id) === String(assessmentForm.enrollment_id)) || null,
    [allEnrollments, assessmentForm.enrollment_id]
  )

  const trainingFee = useMemo(() => {
    const dailyRate = Number(selectedTraining?.daily_rate || 0)
    const days = Number(form.duration_days || 0)
    return dailyRate * days
  }, [selectedTraining, form.duration_days])

  const filteredCandidates = useMemo(() => {
    const query = candidateSearch.trim().toLowerCase()
    if (!query) return candidates

    return candidates.filter((candidate) => {
      const name = (candidate.full_name || '').toLowerCase()
      const passport = (candidate.passport_number || '').toLowerCase()
      return name.includes(query) || passport.includes(query)
    })
  }, [candidateSearch, candidates])

  const handleCandidateSelect = (candidateId) => {
    const candidate = candidates.find((item) => String(item.id) === String(candidateId))
    setForm((prev) => ({
      ...prev,
      candidate_id: candidateId,
      participant_name: candidate ? candidate.full_name : '',
      passport_number: candidate ? candidate.passport_number || '' : '',
    }))
  }

  const resetForm = () => {
    setForm(defaultForm)
    setEditingId(null)
    setCandidateSearch('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!editingId && !form.candidate_id) {
      setError('Candidate is required')
      return
    }
    if (!form.training_id || !form.duration_days || !form.training_company_id) {
      setError('Training, training company, and duration are required')
      return
    }

    setFormLoading(true)
    clearMessages()

    try {
      const payload = {
        candidate_id: form.candidate_id || null,
        participant_name: form.participant_name,
        training_id: form.training_id,
        training_company_id: Number(form.training_company_id),
        enrollment_date: form.enrollment_date,
        duration_days: form.duration_days,
        passport_number: form.passport_number,
        previous_experience: form.previous_experience,
        instructor_assigned: form.instructor_assigned,
        paid_amount: form.paid_amount === '' ? 0 : Number(form.paid_amount),
        advance_payment_1: form.advance_payment_1 === '' ? 0 : Number(form.advance_payment_1),
        advance_payment_2: form.advance_payment_2 === '' ? 0 : Number(form.advance_payment_2),
        advance_payment_3: form.advance_payment_3 === '' ? 0 : Number(form.advance_payment_3),
        discount_amount: form.discount_amount === '' ? 0 : Number(form.discount_amount),
        notes: form.notes,
      }

      let response
      if (editingId) {
        response = await api.put(`/training-enrollments/${editingId}`, payload)
      } else {
        response = await api.post('/training-enrollments', payload)
      }

      setInfo('Training enrollment saved successfully')
      resetForm()
      load(page)
      loadAllEnrollments()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save enrollment')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = (enrollment) => {
    setForm({
      candidate_id: enrollment.candidate_id || '',
      participant_name: enrollment.candidate?.full_name || enrollment.participant_name || '',
      training_id: enrollment.training_id,
      training_company_id: enrollment.training_company_id || '',
      enrollment_date: enrollment.enrollment_date?.slice(0, 10) || '',
      start_date: enrollment.start_date?.slice(0, 10) || '',
      end_date: enrollment.end_date?.slice(0, 10) || '',
      duration_days: enrollment.duration_days,
      passport_number: enrollment.passport_number || '',
      previous_experience: enrollment.previous_experience || '',
      instructor_assigned: enrollment.instructor_assigned || '',
      paid_amount: enrollment.paid_amount || '',
      advance_payment_1: enrollment.advance_payment_1 || '',
      advance_payment_2: enrollment.advance_payment_2 || '',
      advance_payment_3: enrollment.advance_payment_3 || '',
      discount_amount: enrollment.discount_amount || '',
      total_amount_paid: enrollment.total_amount_paid || '',
      payment_reference: enrollment.payment_reference || '',
      notes: enrollment.notes || '',
    })
    setCandidateSearch('')
    setEditingId(enrollment.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this enrollment?')) return
    clearMessages()
    try {
      await api.delete(`/training-enrollments/${id}`)
      setInfo('Enrollment deleted successfully')
      load(page)
      loadAllEnrollments()
    } catch (e) {
      setError('Delete failed')
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    load(1)
  }

  const resetAssessmentForm = () => {
    setAssessmentForm(defaultAssessmentForm)
    setEditingAssessmentId(null)
  }

  const resetCertificationForm = () => {
    setCertificationForm(defaultCertificationForm)
    setEditingCertificationId(null)
  }

  const handleAssessmentSave = async (e) => {
    e.preventDefault()
    if (!assessmentForm.enrollment_id) {
      setError('Please select an enrollment')
      return
    }
    setAssessmentFormLoading(true)
    clearMessages()
    try {
      const payload = {
        ...assessmentForm,
        re_assessment_required: assessmentForm.re_assessment_required ? 1 : 0,
      }
      if (editingAssessmentId) {
        await api.put(`/training-assessments/${editingAssessmentId}`, payload)
      } else {
        await api.post('/training-assessments', payload)
      }
      setInfo('Assessment record saved')
      resetAssessmentForm()
      setShowAssessmentForm(false)
      loadAssessments()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save assessment')
    } finally {
      setAssessmentFormLoading(false)
    }
  }

  const handleAssessmentEnrollmentChange = (enrollmentId) => {
    setAssessmentForm((prev) => ({
      ...prev,
      enrollment_id: enrollmentId,
    }))
  }

  const handleCertificationEnrollmentChange = (enrollmentId) => {
    const existingAssessment = assessments.find((assessment) => String(assessment.enrollment_id) === String(enrollmentId)) || null

    setCertificationForm((prev) => ({
      ...prev,
      enrollment_id: enrollmentId,
      certificate_card_status: existingAssessment?.certificate_card_status || prev.certificate_card_status,
      dispatch_status: existingAssessment?.dispatch_status || prev.dispatch_status,
      certification_expiry_date: existingAssessment?.certification_expiry_date?.slice(0, 10) || prev.certification_expiry_date,
      notes: existingAssessment?.notes || prev.notes,
    }))
  }

  const handleAssessmentEdit = (a) => {
    setAssessmentForm({
      enrollment_id: a.enrollment_id || '',
      result: a.result || 'pending',
      re_assessment_required: !!a.re_assessment_required,
      reassessment_1_date: a.reassessment_1_date?.slice(0, 10) || '',
      reassessment_1_result: a.reassessment_1_result || '',
      reassessment_2_date: a.reassessment_2_date?.slice(0, 10) || '',
      reassessment_2_result: a.reassessment_2_result || '',
    })
    setEditingAssessmentId(a.id)
    setShowAssessmentForm(true)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const handleCertificationSave = async (e) => {
    e.preventDefault()
    if (!certificationForm.enrollment_id) {
      setError('Please select an enrollment for certification')
      return
    }

    setCertificationFormLoading(true)
    clearMessages()
    try {
      const existingAssessment = assessments.find((a) => String(a.enrollment_id) === String(certificationForm.enrollment_id))
      const payload = {
        enrollment_id: certificationForm.enrollment_id,
        certificate_card_status: certificationForm.certificate_card_status,
        dispatch_status: certificationForm.dispatch_status,
        certification_expiry_date: certificationForm.certification_expiry_date || null,
        notes: certificationForm.notes,
      }

      if (editingCertificationId) {
        await api.put(`/training-assessments/${editingCertificationId}`, payload)
      } else if (existingAssessment?.id) {
        await api.put(`/training-assessments/${existingAssessment.id}`, payload)
      } else {
        await api.post('/training-assessments', {
          ...payload,
          result: 'pending',
          re_assessment_required: 0,
        })
      }

      setInfo('Certification details saved')
      resetCertificationForm()
      setShowCertificationForm(false)
      loadAssessments()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save certification details')
    } finally {
      setCertificationFormLoading(false)
    }
  }

  const handleCertificationEdit = (a) => {
    setCertificationForm({
      enrollment_id: a.enrollment_id || '',
      certificate_card_status: a.certificate_card_status || 'pending',
      dispatch_status: a.dispatch_status || 'not_dispatched',
      certification_expiry_date: a.certification_expiry_date?.slice(0, 10) || '',
      notes: a.notes || '',
    })
    setEditingCertificationId(a.id)
    setShowCertificationForm(true)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const handleAssessmentDelete = async (id) => {
    if (!window.confirm('Delete this assessment record?')) return
    clearMessages()
    try {
      await api.delete(`/training-assessments/${id}`)
      setInfo('Assessment deleted')
      loadAssessments()
    } catch {
      setError('Delete failed')
    }
  }

  return (
    <SidebarLayout title="Training Management">
      <div style={styles.container} className="reveal-up">

        {error && <div style={{ ...styles.message, ...styles.error }}>{error}</div>}
        {info && <div style={{ ...styles.message, ...styles.success }}>{info}</div>}

        {/* Summary Section */}
        {summary && (
          <div style={styles.summarySection}>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Total Enrollments</div>
                <div style={styles.summaryValue}>{summary.summary?.total_enrollments || 0}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Total Paid</div>
                <div style={{...styles.summaryValue, color: '#16a34a'}}>NPR {Number(summary.summary?.total_paid_amount || 0).toLocaleString()}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Total Advance</div>
                <div style={{...styles.summaryValue, color: '#0066cc'}}>NPR {Number(summary.summary?.total_advance || 0).toLocaleString()}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Total Discount</div>
                <div style={{...styles.summaryValue, color: '#d97706'}}>NPR {Number(summary.summary?.total_discount || 0).toLocaleString()}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Total Amount Paid</div>
                <div style={{...styles.summaryValue, color: '#2563eb'}}>NPR {Number(summary.summary?.total_amount_paid || 0).toLocaleString()}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Total Unpaid</div>
                <div style={{...styles.summaryValue, color: '#dc2626'}}>NPR {Number(summary.summary?.total_unpaid_amount || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>{editingId ? 'Edit Enrollment' : 'Enroll in Training'}</h3>
            <form onSubmit={handleSave} style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Candidate Name *</label>
                <input
                  style={styles.input}
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Search by candidate name or passport"
                />
                <select style={{ ...styles.input, marginTop: 8 }} value={form.candidate_id} onChange={(e) => handleCandidateSelect(e.target.value)} required>
                  <option value="">Select candidate</option>
                  {filteredCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.passport_number ? `(${c.passport_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Passport Number</label>
                <input
                  style={styles.input}
                  type="text"
                  value={selectedCandidate?.passport_number || form.passport_number || ''}
                  readOnly
                  placeholder="Auto-filled from candidate"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Trade / Training Type *</label>
                <select style={styles.input} value={form.training_id} onChange={e => setForm({...form, training_id: e.target.value})} required disabled={editingId}>
                  <option value="">Select trade...</option>
                  {trainings.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.category ? ` - ${t.category}` : ''}
                      {t.subcategory ? ` / ${t.subcategory}` : ''}
                      {t.daily_rate ? ` (NPR Rs ${t.daily_rate}/day)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Training Company *</label>
                <select style={styles.input} value={form.training_company_id} onChange={e => setForm({...form, training_company_id: e.target.value})} required>
                  <option value="">Select training company...</option>
                  {trainingCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.company_name}
                    </option>
                  ))}
                </select>
                {trainingCompanies.length === 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#b45309' }}>
                    No training company found. Add company first in <Link to="/training-certification-body">Training Certification Body</Link>.
                  </div>
                )}
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Enrollment Date</label>
                <input style={styles.input} type="date" value={form.enrollment_date} onChange={e => setForm({...form, enrollment_date: e.target.value})} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Duration (Days) *</label>
                <input style={styles.input} type="number" min="1" value={form.duration_days} onChange={e => setForm({...form, duration_days: parseInt(e.target.value) || 1})} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Training Fee (NPR)</label>
                <input style={styles.input} type="text" value={Number(trainingFee || 0).toLocaleString()} readOnly />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Discount Amount (NPR)</label>
                <input style={styles.input} type="number" min="0" step="0.01" value={form.discount_amount} onChange={e => setForm({...form, discount_amount: e.target.value})} placeholder="0.00" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Advance Amount 1 (NPR)</label>
                <input style={styles.input} type="number" min="0" step="0.01" value={form.advance_payment_1} onChange={e => setForm({...form, advance_payment_1: e.target.value})} placeholder="0.00" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Advance Amount 2 (NPR)</label>
                <input style={styles.input} type="number" min="0" step="0.01" value={form.advance_payment_2} onChange={e => setForm({...form, advance_payment_2: e.target.value})} placeholder="0.00" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Advance Amount 3 (NPR)</label>
                <input style={styles.input} type="number" min="0" step="0.01" value={form.advance_payment_3} onChange={e => setForm({...form, advance_payment_3: e.target.value})} placeholder="0.00" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Paid Amount (NPR)</label>
                <input style={styles.input} type="number" min="0" step="0.01" value={form.paid_amount} readOnly placeholder="Auto-filled from advance + discount" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Start Date</label>
                <input style={styles.input} type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>End Date</label>
                <input style={styles.input} type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Instructor Name</label>
                <input style={styles.input} value={form.instructor_assigned} onChange={e => setForm({...form, instructor_assigned: e.target.value})} placeholder="Instructor full name" />
              </div>
              <div style={{...styles.field, gridColumn: '1/-1'}}>
                <label style={styles.label}>Previous Experience</label>
                <textarea style={styles.input} rows={2} value={form.previous_experience} onChange={e => setForm({...form, previous_experience: e.target.value})} placeholder="Describe any previous experience..." />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Payment Reference</label>
                <input style={styles.input} value={form.payment_reference} onChange={e => setForm({...form, payment_reference: e.target.value})} placeholder="Receipt or reference number" />
              </div>
              <div style={{...styles.field, gridColumn: '1/-1'}}>
                <label style={styles.label}>Notes</label>
                <textarea style={styles.input} rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <div style={styles.formActions}>
                <button type="submit" style={formLoading ? styles.btnDisabled : styles.btn} disabled={formLoading}>
                  {formLoading ? 'Saving...' : editingId ? 'Update Enrollment' : 'Enroll Candidate'}
                </button>
                <button type="button" style={styles.btnGray} onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div style={styles.toolbar}>
          <button style={styles.btn} onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm() }}>
            {showForm ? '✕ Cancel' : '+ Enroll Candidate'}
          </button>
          <form onSubmit={handleSearch} style={styles.searchRow}>
            <input style={styles.searchInput} placeholder="Search participant or candidate..." value={search} onChange={e => setSearch(e.target.value)} />
            <button type="submit" style={styles.searchBtn}>Search</button>
          </form>
          <select style={styles.filterSelect} value={filterTraining} onChange={e => { setFilterTraining(e.target.value); setPage(1) }}>
            <option value="">All Trades</option>
            {trainings.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.category ? ` - ${t.category}` : ''}{t.subcategory ? ` / ${t.subcategory}` : ''}
              </option>
            ))}
          </select>
          <select style={styles.filterSelect} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">All Payment Status</option>
            {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={styles.paymentLayout}>
          <div>
            {loading ? (
              <div style={styles.loading}>Loading training enrollments...</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thead}>
                      {['ID', 'Candidate', 'Passport', 'Trade', 'Training Company', 'Instructor', 'Duration', 'Paid', 'Advance 1', 'Advance 2', 'Advance 3', 'Discount', 'Training Fee', 'Due', 'Actions'].map(h => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.length === 0 && <tr><td colSpan={15} style={styles.empty}>No enrollments found</td></tr>}
                    {enrollments.map((e) => (
                      <tr key={e.id} style={styles.tr}>
                        <td style={styles.td}>{e.id}</td>
                        <td style={styles.td}><strong>{e.candidate?.full_name || e.participant_name || 'N/A'}</strong></td>
                        <td style={styles.td}>{e.candidate?.passport_number || e.passport_number || '-'}</td>
                        <td style={styles.td}>{e.training?.name || 'N/A'}</td>
                        <td style={styles.td}>{e.training_company?.company_name || '-'}</td>
                        <td style={styles.td}>{e.instructor_assigned || '-'}</td>
                        <td style={styles.td}>{e.duration_days} days</td>
                        <td style={styles.td}>NPR {Number(e.paid_amount || 0).toLocaleString()}</td>
                        <td style={styles.td}>NPR {Number(e.advance_payment_1 || 0).toLocaleString()}</td>
                        <td style={styles.td}>NPR {Number(e.advance_payment_2 || 0).toLocaleString()}</td>
                        <td style={styles.td}>NPR {Number(e.advance_payment_3 || 0).toLocaleString()}</td>
                        <td style={styles.td}>NPR {Number(e.discount_amount || 0).toLocaleString()}</td>
                        <td style={styles.td}>NPR {Number(e.training_amount || e.total_amount_paid || 0).toLocaleString()}</td>
                        <td style={{...styles.td, fontWeight: 600, color: (Number(e.training_amount || 0) - Number(e.paid_amount || 0)) > 0 ? '#f59e0b' : '#22c55e'}}>NPR {Number((e.training_amount || 0) - (e.paid_amount || 0)).toLocaleString()}</td>
                        <td style={styles.td}>
                          <div style={styles.actionRow}>
                            <button style={styles.btnMini} onClick={() => handleEdit(e)}>Edit</button>
                            <button style={styles.btnMiniDanger} onClick={() => handleDelete(e.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pagination.last_page > 1 && (
              <div style={styles.pagination}>
                <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={styles.pageInfo}>Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)</span>
                <button style={styles.pageBtn} disabled={page === pagination.last_page} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            ASSESSMENT SECTION
        ═══════════════════════════════════════════════════════════════ */}
        <div style={styles.sectionDivider} />
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Assessment</h2>
            <p style={styles.sectionSubtitle}>Track assessment results and reassessments only.</p>
          </div>
          <button
            style={showAssessmentForm ? styles.btnCancel : styles.btnTeal}
            onClick={() => { setShowAssessmentForm(!showAssessmentForm); resetAssessmentForm() }}
          >
            {showAssessmentForm ? '✕ Cancel' : '+ Add Assessment'}
          </button>
        </div>

        {/* Assessment Summary Cards */}
        {/* Assessment Form */}
        {showAssessmentForm && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>{editingAssessmentId ? 'Edit Assessment Record' : 'New Assessment Record'}</h3>
            <form onSubmit={handleAssessmentSave} style={styles.assessFormGrid}>
              {/* Enrollment selection */}
              <div style={{...styles.field, gridColumn: '1/-1'}}>
                <label style={styles.label}>Candidate Name *</label>
                <select style={styles.input} value={assessmentForm.enrollment_id} onChange={e => handleAssessmentEnrollmentChange(e.target.value)} required>
                  <option value="">Select candidate…</option>
                  {allEnrollments.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.candidate?.full_name || 'N/A'} {e.candidate?.passport_number ? `(${e.candidate.passport_number})` : ''} — {e.training?.name || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Passport Number</label>
                <input
                  style={styles.input}
                  value={selectedAssessmentEnrollment?.candidate?.passport_number || ''}
                  readOnly
                  placeholder="Auto-filled from candidate"
                />
              </div>

              {/* Result */}
              <div style={styles.field}>
                <label style={styles.label}>Result</label>
                <select style={styles.input} value={assessmentForm.result} onChange={e => setAssessmentForm({...assessmentForm, result: e.target.value})}>
                  <option value="pending">Pending</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </div>

              {/* Re-assessment required */}
              <div style={{...styles.field, justifyContent: 'center'}}>
                <label style={styles.label}>Re-Assessment Required</label>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 8}}>
                  <input type="checkbox" id="reAssess" checked={assessmentForm.re_assessment_required} onChange={e => setAssessmentForm({...assessmentForm, re_assessment_required: e.target.checked})} style={{width: 16, height: 16}} />
                  <label htmlFor="reAssess" style={{fontSize: 13, color: '#374151', cursor: 'pointer'}}>Yes, re-assessment needed</label>
                </div>
              </div>

              {/* Reassessment 1 */}
              <div style={styles.field}>
                <label style={styles.label}>Reassessment 1 Date</label>
                <input style={styles.input} type="date" value={assessmentForm.reassessment_1_date} onChange={e => setAssessmentForm({...assessmentForm, reassessment_1_date: e.target.value})} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Reassessment 1 Result</label>
                <select style={styles.input} value={assessmentForm.reassessment_1_result} onChange={e => setAssessmentForm({...assessmentForm, reassessment_1_result: e.target.value})}>
                  <option value="">— Not done —</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </div>

              {/* Reassessment 2 */}
              <div style={styles.field}>
                <label style={styles.label}>Reassessment 2 Date</label>
                <input style={styles.input} type="date" value={assessmentForm.reassessment_2_date} onChange={e => setAssessmentForm({...assessmentForm, reassessment_2_date: e.target.value})} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Reassessment 2 Result</label>
                <select style={styles.input} value={assessmentForm.reassessment_2_result} onChange={e => setAssessmentForm({...assessmentForm, reassessment_2_result: e.target.value})}>
                  <option value="">— Not done —</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </div>

              <div style={styles.formActions}>
                <button type="submit" style={assessmentFormLoading ? styles.btnDisabled : styles.btn} disabled={assessmentFormLoading}>
                  {assessmentFormLoading ? 'Saving…' : editingAssessmentId ? 'Update Record' : 'Save Assessment'}
                </button>
                <button type="button" style={styles.btnGray} onClick={() => { resetAssessmentForm(); setShowAssessmentForm(false) }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Assessment Table */}
        <div style={styles.tableWrap}>
          {assessmentLoading ? (
            <div style={styles.loading}>Loading assessment records…</div>
          ) : (
            <div style={{overflowX: 'auto'}}>
              <table style={{...styles.table, minWidth: 1400}}>
                <thead>
                  <tr style={{...styles.thead, background: '#0f4c75'}}>
                    {[
                      'Candidate Name (Topic)',
                      'Passport',
                      'Result',
                      'Re-Assessment Required',
                      'Reassessment 1 Date',
                      'Reassessment 1 Result',
                      'Reassessment 2 Date',
                      'Reassessment 2 Result',
                      'Actions',
                    ].map(h => (
                      <th key={h} style={{...styles.th, color: '#fff', background: h.startsWith('Total') ? '#0891b2' : undefined, whiteSpace: 'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assessments.length === 0 && (
                    <tr><td colSpan={9} style={styles.empty}>No assessment records found. Click "+ Add Assessment" to add one.</td></tr>
                  )}
                  {assessments.map(a => {
                    return (
                      <tr key={a.id} style={styles.tr}>
                        <td style={styles.td}><strong>{a.enrollment?.candidate?.full_name || 'N/A'}</strong><br/><span style={{fontSize:11,color:'#64748b'}}>{a.enrollment?.training?.name || ''}</span></td>
                        <td style={styles.td}>{a.enrollment?.candidate?.passport_number || '—'}</td>
                        <td style={styles.td}>
                          <span style={a.result === 'pass' ? styles.badgePass : a.result === 'fail' ? styles.badgeFail : styles.badgePending}>
                            {a.result?.toUpperCase() || 'PENDING'}
                          </span>
                        </td>
                        <td style={{...styles.td, textAlign: 'center'}}>
                          <span style={a.re_assessment_required ? styles.badgeFail : styles.badgePass}>
                            {a.re_assessment_required ? 'YES' : 'NO'}
                          </span>
                        </td>
                        <td style={styles.td}>{a.reassessment_1_date ? new Date(a.reassessment_1_date).toLocaleDateString('en-GB') : '—'}</td>
                        <td style={styles.td}>
                          {a.reassessment_1_result
                            ? <span style={a.reassessment_1_result === 'pass' ? styles.badgePass : styles.badgeFail}>{a.reassessment_1_result.toUpperCase()}</span>
                            : '—'}
                        </td>
                        <td style={styles.td}>{a.reassessment_2_date ? new Date(a.reassessment_2_date).toLocaleDateString('en-GB') : '—'}</td>
                        <td style={styles.td}>
                          {a.reassessment_2_result
                            ? <span style={a.reassessment_2_result === 'pass' ? styles.badgePass : styles.badgeFail}>{a.reassessment_2_result.toUpperCase()}</span>
                            : '—'}
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actionRow}>
                            <button style={styles.btnMini} onClick={() => handleAssessmentEdit(a)}>Edit</button>
                            <button style={styles.btnMiniDanger} onClick={() => handleAssessmentDelete(a.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            CERTIFICATION SECTION
        ═══════════════════════════════════════════════════════════════ */}
        <div style={styles.sectionDivider} />
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Certification</h2>
            <p style={styles.sectionSubtitle}>Next step: update certificate card status, dispatch and expiry details.</p>
          </div>
          <button
            style={showCertificationForm ? styles.btnCancel : styles.btnTeal}
            onClick={() => { setShowCertificationForm(!showCertificationForm); resetCertificationForm() }}
          >
            {showCertificationForm ? '✕ Cancel' : '+ Add Certification'}
          </button>
        </div>

        {showCertificationForm && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>{editingCertificationId ? 'Edit Certification Record' : 'New Certification Record'}</h3>
            <form onSubmit={handleCertificationSave} style={styles.assessFormGrid}>
              <div style={{...styles.field, gridColumn: '1/-1'}}>
                <label style={styles.label}>Candidate Name *</label>
                <select style={styles.input} value={certificationForm.enrollment_id} onChange={e => handleCertificationEnrollmentChange(e.target.value)} required>
                  <option value="">Select candidate…</option>
                  {allEnrollments.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.candidate?.full_name || 'N/A'} {e.candidate?.passport_number ? `(${e.candidate.passport_number})` : ''} — {e.training?.name || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Certificate / Card Received Status</label>
                <select style={styles.input} value={certificationForm.certificate_card_status} onChange={e => setCertificationForm({...certificationForm, certificate_card_status: e.target.value})}>
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                  <option value="not_received">Not Received</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Certification Dispatch to Candidate</label>
                <select style={styles.input} value={certificationForm.dispatch_status} onChange={e => setCertificationForm({...certificationForm, dispatch_status: e.target.value})}>
                  <option value="not_dispatched">Not Dispatched</option>
                  <option value="dispatched">Dispatched</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Certification Expiry Date</label>
                <input style={styles.input} type="date" value={certificationForm.certification_expiry_date} onChange={e => setCertificationForm({...certificationForm, certification_expiry_date: e.target.value})} />
              </div>

              <div style={{...styles.field, gridColumn: '1/-1'}}>
                <label style={styles.label}>Notes</label>
                <textarea style={styles.input} rows={2} value={certificationForm.notes} onChange={e => setCertificationForm({...certificationForm, notes: e.target.value})} />
              </div>

              <div style={styles.formActions}>
                <button type="submit" style={certificationFormLoading ? styles.btnDisabled : styles.btn} disabled={certificationFormLoading}>
                  {certificationFormLoading ? 'Saving…' : editingCertificationId ? 'Update Certification' : 'Save Certification'}
                </button>
                <button type="button" style={styles.btnGray} onClick={() => { resetCertificationForm(); setShowCertificationForm(false) }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div style={styles.tableWrap}>
          {assessmentLoading ? (
            <div style={styles.loading}>Loading certification records…</div>
          ) : (
            <div style={{overflowX: 'auto'}}>
              <table style={{...styles.table, minWidth: 1100}}>
                <thead>
                  <tr style={{...styles.thead, background: '#0f4c75'}}>
                    {[
                      'Candidate Name (Topic)',
                      'Certificate / Card Received',
                      'Dispatch to Candidate',
                      'Cert. Expiry Date',
                      'Notes',
                      'Actions',
                    ].map(h => (
                      <th key={h} style={{...styles.th, color: '#fff', whiteSpace: 'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assessments.length === 0 && (
                    <tr><td colSpan={6} style={styles.empty}>No certification records found. Click "+ Add Certification" to add one.</td></tr>
                  )}
                  {assessments.map(a => (
                    <tr key={`cert-${a.id}`} style={styles.tr}>
                      <td style={styles.td}><strong>{a.enrollment?.candidate?.full_name || 'N/A'}</strong><br/><span style={{fontSize:11,color:'#64748b'}}>{a.enrollment?.training?.name || ''}</span></td>
                      <td style={styles.td}>
                        <span style={a.certificate_card_status === 'received' ? styles.badgePass : a.certificate_card_status === 'not_received' ? styles.badgeFail : styles.badgePending}>
                          {a.certificate_card_status === 'received' ? 'Received' : a.certificate_card_status === 'not_received' ? 'Not Received' : 'Pending'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={a.dispatch_status === 'dispatched' ? styles.badgePass : styles.badgeGray}>
                          {a.dispatch_status === 'dispatched' ? 'Dispatch' : 'Not Dispatch'}
                        </span>
                      </td>
                      <td style={styles.td}>{a.certification_expiry_date ? new Date(a.certification_expiry_date).toLocaleDateString('en-GB') : '—'}</td>
                      <td style={styles.td}>{a.notes || '—'}</td>
                      <td style={styles.td}>
                        <div style={styles.actionRow}>
                          <button style={styles.btnMini} onClick={() => handleCertificationEdit(a)}>Edit</button>
                          <button style={styles.btnMiniDanger} onClick={() => handleAssessmentDelete(a.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: { display: 'grid', gap: 14 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 800, color: '#0f2a4f', margin: 0 },
  addBtn: { background: 'linear-gradient(135deg, #0a3772, #0f4d9d 58%, #1c6bd0)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: '0 12px 22px rgba(15, 77, 157, 0.24)' },
  error: { background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: '12px 14px', color: '#be123c', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 },
  info: { background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', color: '#166534', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 },
  closeErr: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit' },
  summarySection: { background: 'rgba(255,255,255,0.9)', border: '1px solid #dbe5f3', borderRadius: 18, padding: 20, marginBottom: 20, boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 },
  summaryCard: { padding: 16, background: '#f8fbff', borderRadius: 12, border: '1px solid #dbe5f3' },
  summaryLabel: { fontSize: 12, color: '#5f779b', fontWeight: 700, marginBottom: 6 },
  summaryValue: { fontSize: 20, fontWeight: 800, color: '#0f2a4f' },
  formCard: { background: 'rgba(255,255,255,0.9)', borderRadius: 18, border: '1px solid #dbe5f3', padding: 24, marginBottom: 20, boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)' },
  formTitle: { margin: '0 0 16px', fontSize: 17, fontWeight: 800, color: '#0f2a4f' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 },
  field: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: 13, fontWeight: 700, color: '#27466f', marginBottom: 6 },
  input: { padding: '9px 12px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13, color: '#173864', background: 'linear-gradient(180deg, #ffffff, #f8fbff)', fontFamily: 'inherit' },
  formActions: { gridColumn: '1/-1', display: 'flex', gap: 10 },
  btn: { padding: '9px 16px', background: 'linear-gradient(135deg, #0a3772, #0f4d9d)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  btnGray: { padding: '9px 16px', background: '#e8edf6', color: '#27466f', border: '1px solid #d4dfef', borderRadius: 10, fontSize: 13, cursor: 'pointer' },
  btnDisabled: { padding: '9px 16px', background: '#9aacbf', color: '#f4f8ff', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'not-allowed' },
  toolbar: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', background: 'rgba(255,255,255,0.7)', border: '1px solid #dbe5f3', borderRadius: 14, padding: 10 },
  searchRow: { display: 'flex', gap: 8, flex: 1, minWidth: 250 },
  searchInput: { flex: 1, padding: '9px 12px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13 },
  searchBtn: { padding: '9px 20px', background: '#1c6bd0', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 },
  filterSelect: { padding: '9px 12px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13 },
  loading: { textAlign: 'center', padding: '40px 20px', color: '#526686', fontSize: 14, background: 'rgba(255,255,255,0.7)', border: '1px solid #dbe5f3', borderRadius: 14 },
  tableWrap: { background: 'rgba(255,255,255,0.9)', borderRadius: 16, border: '1px solid #dbe5f3', overflow: 'hidden', boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#eef4fc', borderBottom: '1px solid #d7e3f2' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#35557d', letterSpacing: '0.02em' },
  tr: { borderBottom: '1px solid #edf3fb' },
  td: { padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#27466f', verticalAlign: 'middle' },
  empty: { textAlign: 'center', padding: '40px 20px', color: '#6c84a6' },
  actionRow: { display: 'flex', gap: 6 },
  btnMini: { padding: '4px 8px', background: '#e8f1ff', border: '1px solid #cfe1fb', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#114388' },
  btnMiniDanger: { padding: '4px 8px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#be123c' },
  statusPaid: { background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  statusPartial: { background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  statusUnpaid: { background: '#fee2e2', color: '#991b1b', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 },
  pageBtn: { padding: '7px 16px', background: '#fff', border: '1px solid #cfdaea', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#27466f', fontWeight: 600 },
  pageInfo: { fontSize: 13, color: '#5f779b', fontWeight: 600 },
  paymentLayout: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' },
  paymentUpdateCard: { background: 'rgba(255,255,255,0.9)', border: '1px solid #dbe5f3', borderRadius: 16, padding: 20, marginTop: 16, marginBottom: 20, boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)' },
  paymentSelectList: { marginTop: 8, border: '1px solid #dbe5f3', borderRadius: 12, maxHeight: 220, overflowY: 'auto', background: '#fff' },
  paymentSelectItem: { width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #edf3fb', background: '#fff', padding: '10px 12px', cursor: 'pointer' },
  paymentSelectItemActive: { background: '#e8f1ff' },
  paymentSelectName: { fontSize: 13, fontWeight: 800, color: '#0f2a4f' },
  paymentSelectMeta: { marginTop: 2, fontSize: 12, color: '#5f779b' },
  paymentSelectEmpty: { padding: '12px', fontSize: 12, color: '#6b7280' },
  paymentSelectedInfo: { marginTop: 8, fontSize: 12, color: '#114388', fontWeight: 600 },
  sidePanel: { background: 'rgba(255,255,255,0.9)', border: '1px solid #dbe5f3', borderRadius: 16, boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)', padding: 14, position: 'sticky', top: 72 },
  sideTitle: { margin: 0, fontSize: 16, color: '#0f2a4f', fontWeight: 800 },
  sideSubtitle: { marginTop: 4, marginBottom: 10, fontSize: 12, color: '#5f779b', fontWeight: 600 },
  sideMeta: { fontSize: 12, color: '#35557d', marginBottom: 6 },
  paymentCard: { display: 'grid', gap: 8, marginTop: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#27466f', marginBottom: 4 },
  input: { width: '100%', padding: '9px 11px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', color: '#173864', background: 'linear-gradient(180deg, #ffffff, #f8fbff)' },
  btn: { padding: '9px 20px', background: 'linear-gradient(135deg, #0a3772, #0f4d9d)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 },
  btnDisabled: { padding: '9px 20px', background: '#9aacbf', color: '#fff', border: 'none', borderRadius: 10, cursor: 'not-allowed', fontWeight: 700 },
  statusPaid: { background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  statusPartial: { background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  statusUnpaid: { background: '#fee2e2', color: '#991b1b', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  // Assessment & Certification section styles
  sectionDivider: { height: 2, background: 'linear-gradient(90deg, #0f4d9d, #1c6bd0)', borderRadius: 1, margin: '32px 0 24px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 20, fontWeight: 800, color: '#114388', margin: 0 },
  sectionSubtitle: { fontSize: 13, color: '#5f779b', marginTop: 4, marginBottom: 0 },
  btnTeal: { padding: '9px 18px', background: '#1c6bd0', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  btnCancel: { padding: '9px 18px', background: '#5f779b', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  assessSummaryRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 },
  assessSummaryCard: { background: 'rgba(255,255,255,0.9)', border: '1px solid #dbe5f3', padding: '14px 18px', borderRadius: 14, boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)' },
  assessFormGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  badgePass: { background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, display: 'inline-block' },
  badgeFail: { background: '#fee2e2', color: '#991b1b', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, display: 'inline-block' },
  badgePending: { background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, display: 'inline-block' },
  badgeGray: { background: '#e5e7eb', color: '#374151', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, display: 'inline-block' },
  message: { borderRadius: 6, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  success: { background: '#dcfce7', border: '1px solid #86efac', color: '#166534' },
}
