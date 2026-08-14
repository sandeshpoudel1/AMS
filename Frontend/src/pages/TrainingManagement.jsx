import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

const TRAINING_TYPES = {
  welding: { name: 'Welding', subcategories: ['MIG', 'TIG'] },
  scaffolding: { name: 'Scaffolding', subcategories: [] },
  rope_access: { name: 'Rope Access', subcategories: [] },
  steelfixer: { name: 'Steel Fixer', subcategories: [] },
  shuttering_carpenter: { name: 'Shuttering Carpenter', subcategories: [] },
}

const styles = {
  container: { padding: '20px', backgroundColor: '#f5f7f0', minHeight: '100vh' },
  header: { marginBottom: '20px' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#333' },
  card: { background: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  sectionTitle: { fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#333' },
  formGroup: { marginBottom: '15px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' },
  label: { display: 'block', marginBottom: '5px', fontWeight: '500', color: '#333' },
  input: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' },
  select: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', fontFamily: 'Arial', resize: 'vertical', minHeight: '80px', boxSizing: 'border-box' },
  button: { padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
  buttonPrimary: { background: '#2d6a9f', color: '#fff' },
  buttonSecondary: { background: '#ddd', color: '#333' },
  buttonGroup: { display: 'flex', gap: '10px', marginTop: '20px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
  tableHeader: { background: '#f0f0f0', fontWeight: 'bold', borderBottom: '2px solid #ddd' },
  tableCell: { padding: '12px', textAlign: 'left', borderBottom: '1px solid #eee' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '20px' },
  summaryCard: { background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  summaryLabel: { fontSize: '14px', color: '#666', marginBottom: '5px' },
  summaryValue: { fontSize: '24px', fontWeight: 'bold', color: '#2d6a9f' },
  error: { background: '#ffebee', color: '#c62828', border: '1px solid #ef5350', borderRadius: '4px', padding: '12px 15px', marginBottom: '15px' },
  success: { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #66bb6a', borderRadius: '4px', padding: '12px 15px', marginBottom: '15px' },
  statusBadge: { display: 'inline-block', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '500' },
  statusEnrolled: { background: '#e3f2fd', color: '#1565c0' },
  statusOngoing: { background: '#fff3e0', color: '#e65100' },
  statusCompleted: { background: '#e8f5e9', color: '#2e7d32' },
  statusPaid: { background: '#e8f5e9', color: '#2e7d32' },
  statusPartial: { background: '#fff3e0', color: '#e65100' },
  statusUnpaid: { background: '#ffebee', color: '#c62828' },
}

export default function TrainingManagement({ candidateId }) {
  const { user } = useAuth()
  const [trainings, setTrainings] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // Form state
  const [trainingId, setTrainingId] = useState('')
  const [durationDays, setDurationDays] = useState('')
  const [enrollmentDate, setEnrollmentDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const resetForm = () => {
    setTrainingId('')
    setDurationDays('')
    setEnrollmentDate(new Date().toISOString().split('T')[0])
    setNotes('')
    setPaidAmount('')
    setPaymentReference('')
    setEditingId(null)
  }

  const loadTrainings = async () => {
    try {
      const res = await api.get('/trainings')
      setTrainings(res.data.data || [])
    } catch (e) {
      console.error('Failed to load trainings')
    }
  }

  const loadEnrollments = async () => {
    setLoading(true)
    clearMessages()
    try {
      const res = await api.get(`/candidates/${candidateId}/trainings`)
      setEnrollments(res.data.data.enrollments || [])
      setSummary(res.data.data.summary || null)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load trainings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrainings()
    if (candidateId) {
      loadEnrollments()
    }
  }, [candidateId])

  const handleEnroll = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!trainingId || !durationDays) {
      setError('Training and duration are required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        candidate_id: candidateId,
        training_id: trainingId,
        duration_days: parseInt(durationDays),
        enrollment_date: enrollmentDate,
        notes,
      }

      const res = await api.post('/trainings/enroll', payload)
      setSuccess('Candidate enrolled in training successfully')
      resetForm()
      loadEnrollments()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to enroll in training')
    } finally {
      setSaving(false)
    }
  }

  const handlePaymentUpdate = async (enrollmentId) => {
    clearMessages()
    if (paidAmount === '') {
      setError('Enter payment amount')
      return
    }

    setSaving(true)
    try {
      const amount = parseFloat(paidAmount)

      await api.put(`/training-enrollments/${enrollmentId}/payment`, {
        paid_amount: amount,
        payment_reference: paymentReference || null,
      })

      setSuccess('Payment updated successfully')
      setPaidAmount('')
      setPaymentReference('')
      loadEnrollments()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update payment')
    } finally {
      setSaving(false)
    }
  }

  const getSelectedTraining = () => trainings.find(t => t.id === parseInt(trainingId))
  const selectedTraining = getSelectedTraining()
  const estimatedCost = selectedTraining && durationDays ? (parseFloat(durationDays) * parseFloat(selectedTraining.daily_rate)).toFixed(2) : 0

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Training Management for Candidate</div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* Summary */}
      {summary && (
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Total Trainings</div>
            <div style={styles.summaryValue}>{summary.total_trainings}</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Total Training Amount</div>
            <div style={styles.summaryValue}>NPR Rs {Number(summary.total_training_amount || 0).toFixed(2)}</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Total Paid</div>
            <div style={styles.summaryValue}>NPR Rs {Number(summary.total_paid_amount || 0).toFixed(2)}</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Remaining</div>
            <div style={styles.summaryValue}>NPR Rs {Number(summary.total_remaining || 0).toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Enroll Form */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Enroll in New Training</div>
        <form onSubmit={handleEnroll}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Select Training *</label>
              <select
                style={styles.select}
                value={trainingId}
                onChange={(e) => setTrainingId(e.target.value)}
                required
              >
                <option value="">Choose a training...</option>
                {trainings.map(training => (
                  <option key={training.id} value={training.id}>
                    {training.name} ({training.category}) - NPR Rs {training.daily_rate}/day
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Duration (Days) *</label>
              <input
                type="number"
                style={styles.input}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="Number of days"
                min="1"
                required
              />
            </div>
          </div>

          {estimatedCost > 0 && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Estimated Training Cost</label>
              <input
                type="text"
                style={styles.input}
                value={`NPR Rs ${Number(estimatedCost).toFixed(2)}`}
                disabled
              />
            </div>
          )}

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Enrollment Date</label>
              <input
                type="date"
                style={styles.input}
                value={enrollmentDate}
                onChange={(e) => setEnrollmentDate(e.target.value)}
              />
            </div>
            <div style={styles.formGroup} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Notes</label>
            <textarea
              style={styles.textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          <div style={styles.buttonGroup}>
            <button
              type="submit"
              style={{ ...styles.button, ...styles.buttonPrimary }}
              disabled={saving}
            >
              {saving ? 'Enrolling...' : 'Enroll in Training'}
            </button>
          </div>
        </form>
      </div>

      {/* Enrollments List */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Training Enrollments</div>
        {loading ? (
          <div>Loading enrollments...</div>
        ) : enrollments.length === 0 ? (
          <div>No training enrollments yet</div>
        ) : (
          <table style={styles.table}>
            <thead style={styles.tableHeader}>
              <tr>
                <td style={styles.tableCell}>Training</td>
                <td style={styles.tableCell}>Duration</td>
                <td style={styles.tableCell}>Amount</td>
                <td style={styles.tableCell}>Paid</td>
                <td style={styles.tableCell}>Status</td>
                <td style={styles.tableCell}>Payment</td>
                <td style={styles.tableCell}>Action</td>
              </tr>
            </thead>
            <tbody>
              {enrollments.map(enrollment => (
                <tr key={enrollment.id}>
                  <td style={styles.tableCell}>{enrollment.training.name}</td>
                  <td style={styles.tableCell}>{enrollment.duration_days} days</td>
                  <td style={styles.tableCell}>NPR Rs {Number(enrollment.training_amount).toFixed(2)}</td>
                  <td style={styles.tableCell}>NPR Rs {Number(enrollment.paid_amount || 0).toFixed(2)}</td>
                  <td style={styles.tableCell}>
                    <span style={{...styles.statusBadge, ...styles[`status${enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}`]}}>{enrollment.status}</span>
                  </td>
                  <td style={styles.tableCell}>
                    <span style={{...styles.statusBadge, ...styles[`status${enrollment.payment_status.charAt(0).toUpperCase() + enrollment.payment_status.slice(1)}`]}}>{enrollment.payment_status}</span>
                  </td>
                  <td style={styles.tableCell}>
                    <button
                      style={{ ...styles.button, ...styles.buttonSecondary, fontSize: '12px' }}
                      onClick={() => setEditingId(editingId === enrollment.id ? null : enrollment.id)}
                    >
                      {editingId === enrollment.id ? 'Cancel' : 'Pay'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment Form */}
      {enrollments.map(enrollment => (
        editingId === enrollment.id && (
          <div key={`payment-${enrollment.id}`} style={styles.card}>
            <div style={styles.sectionTitle}>Update Payment - {enrollment.training.name}</div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Amount Paid (NPR Rs)</label>
                <input
                  type="number"
                  style={styles.input}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Payment Reference/Receipt</label>
                <input
                  type="text"
                  style={styles.input}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Enter reference or receipt number"
                />
              </div>
            </div>
            <div style={styles.buttonGroup}>
              <button
                style={{ ...styles.button, ...styles.buttonPrimary }}
                onClick={() => handlePaymentUpdate(enrollment.id)}
                disabled={saving}
              >
                {saving ? 'Updating...' : 'Update Payment'}
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonSecondary }}
                onClick={() => {
                  setEditingId(null)
                  setPaidAmount('')
                  setPaymentReference('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )
      ))}
    </div>
  )
}
