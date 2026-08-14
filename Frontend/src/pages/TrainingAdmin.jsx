import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import logo from '../assets/motherland-logo.svg'

const styles = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' },
  nav: { background: '#1e3a5f', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 24, position: 'sticky', top: 0, zIndex: 100 },
  navBrandWrap: { display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 },
  navLogo: { width: 24, height: 24, objectFit: 'contain' },
  navBrand: { color: '#fff', fontWeight: 700, fontSize: 11, maxWidth: 210, lineHeight: 1.2 },
  navLinks: { display: 'flex', gap: 4, flex: 1 },
  navLink: { color: '#94b8d4', textDecoration: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 14 },
  navUser: { display: 'flex', alignItems: 'center', gap: 10 },
  userName: { color: '#e0f0ff', fontSize: 13 },
  logoutBtn: { background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 },
  content: { padding: 24, maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: '#1e293b', margin: 0 },
  addBtn: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  error: { background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, padding: '12px 14px', color: '#b91c1c', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  success: { background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: '12px 14px', color: '#166534', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit' },
  card: { background: '#fff', borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16, margin: 0 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  formField: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' },
  select: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' },
  textarea: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: '100px' },
  formActions: { display: 'flex', gap: 10, marginTop: 16 },
  btn: { padding: '8px 16px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnPrimary: { background: '#1e3a5f', color: '#fff' },
  btnSecondary: { background: '#e5e7eb', color: '#1f2937' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHead: { background: '#f3f4f6', borderBottom: '2px solid #d1d5db' },
  tableCell: { padding: '12px', textAlign: 'left', fontSize: 13, color: '#374151' },
  tableCellHead: { padding: '12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#1f2937' },
  tableRow: { borderBottom: '1px solid #e5e7eb' },
  tableRowHover: { background: '#f9fafb' },
  actionBtn: { padding: '4px 8px', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', marginRight: 6 },
  editBtn: { background: '#dbeafe', color: '#1e40af' },
  deleteBtn: { background: '#fee2e2', color: '#b91c1c' },
  empty: { textAlign: 'center', padding: '40px 20px', color: '#6b7280', fontSize: 14 },
}

export default function TrainingAdmin() {
  const { user, logout } = useAuth()
  const [trainings, setTrainings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    name: '',
    category: '',
    subcategory: '',
    description: '',
    daily_rate: '',
    duration_days: 5,
  })

  const CATEGORIES = [
    { value: 'welding', label: 'Welding', subcategories: ['MIG', 'TIG'] },
    { value: 'scaffolding', label: 'Scaffolding', subcategories: [] },
    { value: 'rope_access', label: 'Rope Access', subcategories: [] },
    { value: 'steelfixer', label: 'Steel Fixer', subcategories: [] },
    { value: 'shuttering_carpenter', label: 'Shuttering Carpenter', subcategories: [] },
  ]

  const selectedCategory = CATEGORIES.find(c => c.value === form.category)
  const subcategories = selectedCategory?.subcategories || []

  const loadTrainings = async () => {
    setLoading(true)
    try {
      const res = await api.get('/trainings')
      setTrainings(res.data.data || [])
    } catch (e) {
      setError('Failed to load trainings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrainings()
  }, [])

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const resetForm = () => {
    setForm({
      name: '',
      category: '',
      subcategory: '',
      description: '',
      daily_rate: '',
      duration_days: 5,
    })
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!form.name || !form.category || !form.daily_rate) {
      setError('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/trainings/${editingId}`, form)
        setSuccess('Training updated successfully')
      } else {
        await api.post('/trainings', form)
        setSuccess('Training created successfully')
      }
      resetForm()
      setShowForm(false)
      loadTrainings()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save training')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (training) => {
    setForm({
      name: training.name,
      category: training.category,
      subcategory: training.subcategory || '',
      description: training.description,
      daily_rate: training.daily_rate,
      duration_days: training.duration_days,
    })
    setEditingId(training.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this training?')) return
    clearMessages()
    try {
      await api.delete(`/trainings/${id}`)
      setSuccess('Training deleted successfully')
      loadTrainings()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete training')
    }
  }

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.navBrandWrap}>
          <img src={logo} alt="Motherland logo" style={styles.navLogo} />
          <span style={styles.navBrand}>Motherland Overseas Record Management System</span>
        </div>
        <div style={styles.navLinks}>
          <Link to="/dashboard" style={styles.navLink}>Dashboard</Link>
          {['admin', 'candidate_officer'].includes(user?.role || user?.role_label) && <Link to="/candidates" style={styles.navLink}>Candidates</Link>}
          {['admin', 'finance_officer'].includes(user?.role || user?.role_label) && <Link to="/finance" style={styles.navLink}>Finance</Link>}
          {((user?.role || user?.role_label) === 'admin' || (user?.role || user?.role_label) === 'superadmin' || (user?.role || user?.role_label) === 'super_admin') && <Link to="/training-admin" style={{...styles.navLink, color: '#fff', background: '#2d6a9f'}}>Training Admin</Link>}
        </div>
        <div style={styles.navUser}>
          <span style={styles.userName}>{user?.full_name || user?.name}</span>
          <button style={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </nav>

      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>Training Management</h1>
          <button style={styles.addBtn} onClick={() => { resetForm(); setShowForm(true) }}>+ Add Training</button>
        </div>

        {error && <div style={styles.error}>{error}<button style={styles.closeBtn} onClick={() => setError('')}>✕</button></div>}
        {success && <div style={styles.success}>{success}<button style={styles.closeBtn} onClick={() => setSuccess('')}>✕</button></div>}

        {/* Form Card */}
        {showForm && (
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>{editingId ? 'Edit Training' : 'Add New Training'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={styles.formGrid}>
                <div style={styles.formField}>
                  <label style={styles.label}>Training Name *</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    placeholder="e.g., Welding - MIG"
                    required
                  />
                </div>
                <div style={styles.formField}>
                  <label style={styles.label}>Category *</label>
                  <select
                    style={styles.select}
                    value={form.category}
                    onChange={(e) => setForm({...form, category: e.target.value, subcategory: ''})}
                    required
                  >
                    <option value="">Select category...</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {subcategories.length > 0 && (
                <div style={styles.formGrid}>
                  <div style={styles.formField}>
                    <label style={styles.label}>Subcategory</label>
                    <select
                      style={styles.select}
                      value={form.subcategory}
                      onChange={(e) => setForm({...form, subcategory: e.target.value})}
                    >
                      <option value="">Select subcategory...</option>
                      {subcategories.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formField} />
                </div>
              )}

              <div style={styles.formGrid}>
                <div style={styles.formField}>
                  <label style={styles.label}>Daily Rate (NPR Rs) *</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={form.daily_rate}
                    onChange={(e) => setForm({...form, daily_rate: e.target.value})}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                <div style={styles.formField}>
                  <label style={styles.label}>Default Duration (Days)</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={form.duration_days}
                    onChange={(e) => setForm({...form, duration_days: e.target.value})}
                    min="1"
                  />
                </div>
              </div>

              <div style={{...styles.formGrid, gridTemplateColumns: '1fr'}}>
                <div style={styles.formField}>
                  <label style={styles.label}>Description</label>
                  <textarea
                    style={styles.textarea}
                    value={form.description}
                    onChange={(e) => setForm({...form, description: e.target.value})}
                    placeholder="Training description..."
                  />
                </div>
              </div>

              <div style={styles.formActions}>
                <button type="submit" style={{...styles.btn, ...styles.btnPrimary}} disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update Training' : 'Create Training'}
                </button>
                <button type="button" style={{...styles.btn, ...styles.btnSecondary}} onClick={() => { setShowForm(false); resetForm() }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Trainings List */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>All Trainings</h3>
          {loading ? (
            <div style={styles.empty}>Loading trainings...</div>
          ) : trainings.length === 0 ? (
            <div style={styles.empty}>No trainings found. Click "Add Training" to create one.</div>
          ) : (
            <table style={styles.table}>
              <thead style={styles.tableHead}>
                <tr>
                  <td style={styles.tableCellHead}>Name</td>
                  <td style={styles.tableCellHead}>Category</td>
                  <td style={styles.tableCellHead}>Subcategory</td>
                  <td style={styles.tableCellHead}>Daily Rate</td>
                  <td style={styles.tableCellHead}>Duration</td>
                  <td style={styles.tableCellHead}>Status</td>
                  <td style={styles.tableCellHead}>Actions</td>
                </tr>
              </thead>
              <tbody>
                {trainings.map(training => (
                  <tr key={training.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>{training.name}</td>
                    <td style={styles.tableCell}>{training.category}</td>
                    <td style={styles.tableCell}>{training.subcategory || '-'}</td>
                    <td style={styles.tableCell}>NPR Rs {Number(training.daily_rate).toFixed(2)}</td>
                    <td style={styles.tableCell}>{training.duration_days} days</td>
                    <td style={styles.tableCell}>
                      <span style={{...styles.actionBtn, background: training.is_active ? '#dcfce7' : '#fee2e2', color: training.is_active ? '#166534' : '#b91c1c'}}>
                        {training.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      <button style={{...styles.actionBtn, ...styles.editBtn}} onClick={() => handleEdit(training)}>Edit</button>
                      <button style={{...styles.actionBtn, ...styles.deleteBtn}} onClick={() => handleDelete(training.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
