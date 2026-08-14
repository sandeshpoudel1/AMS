import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const ROLES = ['super_admin', 'documentation', 'documentation_head', 'account', 'bd']

const formatRoleLabel = (role) => String(role || '').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())

export default function Users() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', password_confirmation: '', phone: '', role: 'account' })
  const roleLower = (user?.role || user?.role_label || '').toLowerCase()
  const isSuperAdmin = ['super_admin', 'superadmin'].includes(roleLower)
  const canManageUsers = isSuperAdmin || roleLower === 'admin'
  const visibleRoles = isSuperAdmin ? ROLES : ROLES.filter((role) => !['super_admin', 'superadmin'].includes(role.toLowerCase()))

  const getApiErrorMessage = (e, fallback = 'Request failed') => {
    const errors = e?.response?.data?.errors
    if (errors && typeof errors === 'object') {
      const firstField = Object.keys(errors)[0]
      const firstMessage = firstField && Array.isArray(errors[firstField]) ? errors[firstField][0] : null
      if (firstMessage) return firstMessage
    }
    return e?.response?.data?.message || fallback
  }

  const load = async (p = 1) => {
    setLoading(true)
    try {
      const res = await api.get('/users', { params: { page: p, search, role, per_page: 15 } })
      setUsers(res.data.data.users)
      setPagination(res.data.pagination)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(page) }, [page, role])

  const handleSearch = (e) => { e.preventDefault(); setPage(1); load(1) }

  const resetForm = () => {
    setForm({ full_name: '', email: '', password: '', password_confirmation: '', phone: '', role: 'candidate' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleToggle = async (u, action) => {
    try {
      await api.post(`/users/${u.id}/${action}`)
      load(page)
    } catch (e) { setError(e.response?.data?.message || 'Action failed') }
  }

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault()

    if (!form.full_name.trim()) {
      setError('Full name is required')
      return
    }
    if (!form.email.trim()) {
      setError('Email is required')
      return
    }
    if (!editingId && (!form.password || form.password.length < 8)) {
      setError('Password must be at least 8 characters')
      return
    }
    if ((form.password || form.password_confirmation) && form.password !== form.password_confirmation) {
      setError('Password confirmation does not match')
      return
    }

    setFormLoading(true)
    setError('')
    setInfo('')
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        role: form.role,
      }

      if (form.password) {
        payload.password = form.password
        payload.password_confirmation = form.password_confirmation
      }

      if (editingId) {
        await api.put(`/users/${editingId}`, payload)
        setInfo('User updated successfully')
      } else {
        const confirmed = window.confirm('Are you sure you want to create this record?')
        if (!confirmed) {
          setFormLoading(false)
          return
        }
        await api.post('/users', payload)
        setInfo('User created successfully')
      }

      resetForm()
      load(editingId ? page : 1)
    } catch (e) {
      setError(getApiErrorMessage(e, editingId ? 'Failed to update user' : 'Failed to create user'))
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = (u) => {
    if (!canManageUsers) {
      setError('Only Admin or Super Admin can manage users')
      return
    }

    setError('')
    setInfo('')
    setEditingId(u.id)
    setForm({
      full_name: u.full_name || u.name || '',
      email: u.email || '',
      password: '',
      password_confirmation: '',
      phone: u.phone || '',
      role: u.role || 'candidate',
    })
    setShowForm(true)
  }

  const handleDelete = async (u) => {
    if (!canManageUsers) {
      setError('Only Admin or Super Admin can manage users')
      return
    }

    if (!window.confirm(`Delete user ${u.email}?`)) {
      return
    }

    setError('')
    setInfo('')
    try {
      await api.delete(`/users/${u.id}`)
      setInfo('User deleted successfully')
      load(page)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to delete user'))
    }
  }

  return (
    <SidebarLayout title="User Management" headerExtra={canManageUsers ? <button style={styles.addBtn} onClick={() => { setShowForm(true); setEditingId(null) }}>+ Add User</button> : null}>
      <div style={styles.container}>

        {error && <div style={styles.error}>{error}<button style={styles.closeErr} onClick={() => setError('')}>✕</button></div>}
        {info && <div style={styles.info}>{info}<button style={styles.closeInfo} onClick={() => setInfo('')}>✕</button></div>}

        {showForm && canManageUsers && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>{editingId ? 'Edit User' : 'Create New User'}</h3>
            <form onSubmit={handleCreateOrUpdate} style={styles.formGrid}>
              {[['full_name','Full Name','text'],['email','Email','email'],['phone','Phone','text'],['password','Password','password'],['password_confirmation','Confirm Password','password']].map(([key, label, type]) => (
                <div key={key} style={styles.field}>
                  <label style={styles.label}>{label}</label>
                  <input style={styles.input} type={type} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} required={!editingId && key !== 'phone'} />
                </div>
              ))}
              <div style={styles.field}>
                <label style={styles.label}>Role</label>
                <select style={styles.input} value={visibleRoles.includes(form.role) ? form.role : visibleRoles[0]} onChange={e => setForm({...form, role: e.target.value})}>
                  {visibleRoles.map(r => <option key={r} value={r}>{formatRoleLabel(r)}</option>)}
                </select>
              </div>
              <div style={styles.formActions}>
                <button type="submit" style={formLoading ? styles.btnDisabled : styles.btn} disabled={formLoading}>{formLoading ? 'Saving...' : editingId ? 'Update User' : 'Create User'}</button>
                <button type="button" style={styles.btnGray} onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div style={styles.toolbar}>
          <form onSubmit={handleSearch} style={styles.searchRow}>
            <input style={styles.searchInput} placeholder="Search name, email..." value={search} onChange={e => setSearch(e.target.value)} />
            <button type="submit" style={styles.searchBtn}>Search</button>
          </form>
          <select style={styles.filterSelect} value={role} onChange={e => { setRole(e.target.value); setPage(1) }}>
            <option value="">All Roles</option>
            {visibleRoles.map(r => <option key={r} value={r}>{formatRoleLabel(r)}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading users...</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  {['ID','Name','Email','Role','Status','Joined','Actions'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={7} style={styles.empty}>No users found</td></tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} style={styles.tr}>
                    <td style={styles.td}>{u.id}</td>
                    <td style={styles.td}><strong>{u.full_name || u.name}</strong></td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}><span style={styles.roleBadge}>{u.role_label || u.role}</span></td>
                    <td style={styles.td}>
                      <span style={u.is_active ? styles.active : styles.inactive}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={styles.td}>{u.created_at?.slice(0,10)}</td>
                    <td style={styles.td}>
                      <div style={styles.actionRow}>
                        <button style={u.is_active ? styles.btnWarn : styles.btnSuccess} onClick={() => handleToggle(u, u.is_active ? 'deactivate' : 'activate')}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        {canManageUsers && (
                          <>
                            <button style={styles.btnMini} onClick={() => handleEdit(u)}>Edit</button>
                            <button style={styles.btnMiniDanger} onClick={() => handleDelete(u)}>Delete</button>
                          </>
                        )}
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
            <button style={styles.pageBtn} disabled={page===1} onClick={() => setPage(p => p-1)}>← Prev</button>
            <span style={styles.pageInfo}>Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)</span>
            <button style={styles.pageBtn} disabled={page===pagination.last_page} onClick={() => setPage(p => p+1)}>Next →</button>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: {},
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 700, color: '#1e293b', margin: 0 },
  addBtn: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontWeight: 600 },
  error: { background: '#fee', border: '1px solid #fcc', borderRadius: 6, padding: '10px 14px', color: '#c33', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between' },
  closeErr: { background: 'none', border: 'none', cursor: 'pointer', color: '#c33' },
  info: { background: '#eef6ff', border: '1px solid #b8ddff', borderRadius: 6, padding: '10px 14px', color: '#1d4ed8', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between' },
  closeInfo: { background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8' },
  formCard: { background: '#fff', borderRadius: 8, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  formTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1e293b' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  field: {},
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 4 },
  input: { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' },
  formActions: { gridColumn: '1/-1', display: 'flex', gap: 10 },
  btn: { padding: '8px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
  btnDisabled: { padding: '8px 20px', background: '#999', color: '#fff', border: 'none', borderRadius: 6, cursor: 'not-allowed', fontWeight: 600 },
  btnGray: { padding: '8px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer' },
  toolbar: { display: 'flex', gap: 12, marginBottom: 16 },
  searchRow: { display: 'flex', gap: 8, flex: 1 },
  searchInput: { flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 },
  searchBtn: { padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
  filterSelect: { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 },
  loading: { textAlign: 'center', color: '#64748b', padding: 40 },
  tableWrap: { background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f8fafc' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 16px', fontSize: 13, color: '#374151' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40 },
  roleBadge: { background: '#eff6ff', color: '#2563eb', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  active: { background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  inactive: { background: '#fee2e2', color: '#991b1b', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  btnWarn: { padding: '4px 10px', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 },
  btnSuccess: { padding: '4px 10px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 },
  actionRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  btnMini: { padding: '4px 10px', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 },
  btnMiniDanger: { padding: '4px 10px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 },
  pageBtn: { padding: '6px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  pageInfo: { fontSize: 13, color: '#64748b' },
}
