import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const LEGACY_STORAGE_KEY = 'mopl.bd-sources'
const LEGACY_BACKUP_KEY = 'mopl.bd-sources.backup.v1'
const LEGACY_IMPORTED_FLAG_KEY = 'mopl.bd-sources.imported.v1'

const normalizeBdRows = (rows) => rows.map((item) => ({
  id: item.id,
  reference_name: item.reference_name || item.name || '',
  contact_number: item.contact_number || item.phone || '',
  email: item.email || '',
  notes: item.notes || '',
  is_active: item.is_active ?? true,
}))

export default function BD() {
  const [entries, setEntries] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [bdApiAvailable, setBdApiAvailable] = useState(true)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('reference_name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [form, setForm] = useState({
    reference_name: '',
    contact_number: '',
    email: '',
    notes: '',
  })

  const handleSort = (field) => {
    setSortField((current) => {
      if (current === field) {
        setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
        return current
      }
      setSortDirection('asc')
      return field
    })
  }

  const sortIndicator = (field) => {
    if (field !== sortField) return ''
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const clearMessages = () => {
    setInfo('')
    setError('')
    setSuccess('')
  }

  const normalizePayload = (item) => ({
    reference_name: (item?.reference_name || '').trim(),
    contact_number: (item?.contact_number || '').trim(),
    email: (item?.email || '').trim(),
    notes: (item?.notes || '').trim(),
    is_active: true,
  })

  const signature = (item) => {
    const name = (item?.reference_name || '').trim().toLowerCase()
    const contact = (item?.contact_number || '').trim().toLowerCase()
    const email = (item?.email || '').trim().toLowerCase()
    return `${name}|${contact}|${email}`
  }

  const importLegacyEntries = async (currentRows) => {
    if (localStorage.getItem(LEGACY_IMPORTED_FLAG_KEY) === '1') {
      return { shouldRefresh: false }
    }

    let legacyRows = []
    try {
      legacyRows = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]')
      if (!Array.isArray(legacyRows)) legacyRows = []
    } catch {
      legacyRows = []
    }

    if (legacyRows.length === 0) {
      localStorage.setItem(LEGACY_IMPORTED_FLAG_KEY, '1')
      return { shouldRefresh: false }
    }

    if (!localStorage.getItem(LEGACY_BACKUP_KEY)) {
      localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify(legacyRows))
    }

    const normalized = legacyRows.map(normalizePayload).filter((item) => item.reference_name && item.contact_number && item.email)
    const existing = new Set(currentRows.map(signature))
    const toImport = normalized.filter((item) => !existing.has(signature(item)))

    if (toImport.length === 0) {
      localStorage.setItem(LEGACY_IMPORTED_FLAG_KEY, '1')
      return { shouldRefresh: false }
    }

    const results = await Promise.allSettled(toImport.map((item) => api.post('/bd-sources', item)))
    const importedCount = results.filter((res) => res.status === 'fulfilled').length
    const failedCount = results.length - importedCount

    if (failedCount === 0) {
      localStorage.setItem(LEGACY_IMPORTED_FLAG_KEY, '1')
      return { shouldRefresh: importedCount > 0, message: `Imported ${importedCount} legacy BD entries to backend.` }
    }

    return {
      shouldRefresh: importedCount > 0,
      error: `Imported ${importedCount} legacy BD entries, but ${failedCount} failed. Reopen BD to retry remaining items.`,
    }
  }

  const loadEntries = async () => {
    setLoading(true)
    try {
      let rows = []
      let apiAvailable = true
      try {
        const response = await api.get('/bd-sources')
        setBdApiAvailable(true)
        rows = Array.isArray(response?.data?.data) ? response.data.data : []
      } catch (firstError) {
        if (firstError?.response?.status !== 404) throw firstError
        apiAvailable = false
        setBdApiAvailable(false)
        const fallback = await api.get('/references')
        rows = Array.isArray(fallback?.data?.data?.references) ? fallback.data.data.references : []
      }

      rows = normalizeBdRows(rows)

      if (!apiAvailable) {
        const localRows = normalizeBdRows(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]'))
        const mergedRows = [...localRows, ...rows]
        setEntries(mergedRows)
        setInfo('BD is in preview mode. You can still add and edit locally.')
        return
      }

      setEntries(rows)

      const importResult = await importLegacyEntries(rows)
      if (importResult?.shouldRefresh) {
        const refreshResponse = await api.get('/bd-sources')
        const refreshedRows = Array.isArray(refreshResponse?.data?.data) ? refreshResponse.data.data : []
        setEntries(refreshedRows)
      }

      if (importResult?.message) setSuccess(importResult.message)
      if (importResult?.error) setError(importResult.error)
    } catch (err) {
      try {
        const localRows = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]')
        if (Array.isArray(localRows) && localRows.length > 0) {
          setEntries(normalizeBdRows(localRows))
          setError('Backend BD endpoint is unavailable. Showing previously saved local BD data.')
        } else {
          setError(err.response?.data?.message || 'Failed to load BD entries')
        }
      } catch {
        setError(err.response?.data?.message || 'Failed to load BD entries')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEntries()
  }, [])

  const filteredEntries = useMemo(() => {
    const query = String(searchQuery).trim().toLowerCase()
    const normalized = entries.map((entry) => ({
      ...entry,
      reference_name: String(entry.reference_name || '').trim(),
      contact_number: String(entry.contact_number || '').trim(),
      email: String(entry.email || '').trim(),
      notes: String(entry.notes || '').trim(),
      is_active: entry.is_active ?? true,
    }))

    const filtered = normalized.filter((entry) => {
      if (!query) return true
      return [entry.reference_name, entry.contact_number, entry.email, entry.notes]
        .some((value) => String(value || '').toLowerCase().includes(query))
    })

    const compare = (a, b) => {
      const fieldA = a[sortField]
      const fieldB = b[sortField]

      if (sortField === 'is_active') {
        const valueA = fieldA ? 1 : 0
        const valueB = fieldB ? 1 : 0
        return valueA - valueB
      }

      return String(fieldA || '').localeCompare(String(fieldB || ''), undefined, { numeric: true })
    }

    return filtered.sort((a, b) => (sortDirection === 'asc' ? compare(a, b) : compare(b, a)))
  }, [entries, searchQuery, sortField, sortDirection])

  const resetForm = () => {
    setForm({
      reference_name: '',
      contact_number: '',
      email: '',
      notes: '',
    })
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!form.reference_name.trim()) {
      setError('Reference name is required')
      return
    }
    if (!form.contact_number.trim()) {
      setError('Contact number is required')
      return
    }
    if (!form.email.trim()) {
      setError('Email is required')
      return
    }

    const payload = {
      reference_name: form.reference_name.trim(),
      contact_number: form.contact_number.trim(),
      email: form.email.trim(),
      notes: form.notes.trim(),
      is_active: true,
    }

    if (!bdApiAvailable) {
      const localRows = normalizeBdRows(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]'))
      const nextRows = editingId
        ? localRows.map((entry) => (entry.id === editingId ? { ...entry, ...payload } : entry))
        : [{ id: `local-${Date.now()}`, ...payload }, ...localRows]

      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(nextRows))
      await loadEntries()
      setSuccess(editingId ? 'BD updated locally in preview mode' : 'BD created locally in preview mode')
      resetForm()
      setShowForm(false)
      return
    }

    try {
      if (editingId) {
        const response = await api.put(`/bd-sources/${editingId}`, payload)
        const updated = response?.data?.data
        setEntries((prev) => prev.map((entry) => (entry.id === editingId ? updated : entry)))
        setSuccess('BD updated successfully')
      } else {
        const confirmed = window.confirm('Are you sure you want to create this record?')
        if (!confirmed) {
          return
        }

        const response = await api.post('/bd-sources', payload)
        const created = response?.data?.data
        setEntries((prev) => [created, ...prev])
        setSuccess('BD created successfully')
      }
      resetForm()
      setShowForm(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save BD entry')
    }
  }

  const handleEdit = (entry) => {
    setForm({
      reference_name: entry.reference_name || '',
      contact_number: entry.contact_number || '',
      email: entry.email || '',
      notes: entry.notes || '',
    })
    setEditingId(entry.id)
    setShowForm(true)
  }

  const handleDelete = async (entryId) => {
    if (!window.confirm('Delete this BD entry?')) return

    if (!bdApiAvailable) {
      const localRows = normalizeBdRows(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]'))
      const nextRows = localRows.filter((entry) => entry.id !== entryId)
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(nextRows))
      await loadEntries()
      setSuccess('BD deleted locally in preview mode')
      return
    }

    try {
      await api.delete(`/bd-sources/${entryId}`)
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId))
      setSuccess('BD deleted successfully')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete BD entry')
    }
  }

  return (
    <SidebarLayout
      title="BD"
      headerExtra={<button style={styles.addBtn} onClick={() => { resetForm(); setShowForm(true) }}>+ Add BD</button>}
    >
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div>
            <div style={styles.kicker}>Settings</div>
            <h2 style={styles.heroTitle}>BD source entry</h2>
            <p style={styles.heroText}>Record the Business Development person who sourced the candidate for foreign employment.</p>
          </div>
          <div style={styles.heroMeta}>
            <div style={styles.metaCard}>
              <div style={styles.metaValue}>{entries.length}</div>
              <div style={styles.metaLabel}>BD entries</div>
            </div>
            <Link to="/project-settings" style={styles.metaCardLink}>
              <div style={styles.metaCard}>
                <div style={styles.metaCardIcon}>⚙️</div>
                <div style={styles.metaLabel}>Project Settings</div>
              </div>
            </Link>
            <Link to="/clients" style={styles.metaCardLink}>
              <div style={styles.metaCard}>
                <div style={styles.metaCardIcon}>🏢</div>
                <div style={styles.metaLabel}>Clients</div>
              </div>
            </Link>
          </div>
        </div>

        {info && <div style={styles.info}>{info}<button style={styles.closeBtn} onClick={() => setInfo('')}>✕</button></div>}
        {error && <div style={styles.error}>{error}<button style={styles.closeBtn} onClick={() => setError('')}>✕</button></div>}
        {success && <div style={styles.success}>{success}<button style={styles.closeBtn} onClick={() => setSuccess('')}>✕</button></div>}

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>{editingId ? 'Edit BD' : 'Add BD'}</h3>
              <p style={styles.panelText}>Use the same entry structure as reference to capture the source company details.</p>
            </div>
          </div>

          {showForm ? (
            <form onSubmit={handleSubmit}>
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Reference Name *</label>
                  <input style={styles.input} value={form.reference_name} onChange={(e) => setForm({ ...form, reference_name: e.target.value })} placeholder="Reference name" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Contact Number *</label>
                  <input style={styles.input} value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} placeholder="Contact number" />
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Email *</label>
                  <input style={styles.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address" />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Notes</label>
                <input style={styles.input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" />
              </div>

              <div style={styles.formActions}>
                <button type="submit" style={styles.primaryBtn}>{editingId ? 'Update BD' : 'Create BD'}</button>
                <button type="button" style={styles.secondaryBtn} onClick={() => { setShowForm(false); resetForm() }}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyTitle}>No form open</div>
              <p style={styles.emptyText}>Add a BD entry when a business development person sources a candidate.</p>
            </div>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Saved BD</h3>
              <p style={styles.panelText}>Admin-only source records.</p>
            </div>
          </div>

          <div style={styles.filterRow}>
            <div style={styles.filterField}>
              <label style={styles.filterLabel}>Search BD</label>
              <input
                style={styles.filterInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, email or notes"
              />
            </div>
            <div style={styles.sortHint}>Click a table header to sort</div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading BD entries...</div>
          ) : entries.length === 0 ? (
            <div style={styles.emptyState}>No BD entries saved yet.</div>
          ) : filteredEntries.length === 0 ? (
            <div style={styles.emptyState}>No BD entries match your search.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.sortHeader }} onClick={() => handleSort('reference_name')}>
                  Reference Name {sortIndicator('reference_name')}
                </th>
                    <th style={{ ...styles.th, ...styles.sortHeader }} onClick={() => handleSort('contact_number')}>
                      Contact Number {sortIndicator('contact_number')}
                    </th>
                    <th style={{ ...styles.th, ...styles.sortHeader }} onClick={() => handleSort('email')}>
                      Email {sortIndicator('email')}
                    </th>
                    <th style={{ ...styles.th, ...styles.sortHeader }} onClick={() => handleSort('is_active')}>
                      Status {sortIndicator('is_active')}
                    </th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} style={styles.tr}>
                      <td style={styles.td}><strong>{entry.reference_name}</strong></td>
                      <td style={styles.td}>{entry.contact_number || '-'}</td>
                      <td style={styles.td}>{entry.email || '-'}</td>
                      <td style={styles.td}>{entry.is_active ? 'Active' : 'Inactive'}</td>
                      <td style={styles.td}>
                        <button style={styles.actionBtn} onClick={() => handleEdit(entry)}>Edit</button>
                        <button style={styles.deleteBtn} onClick={() => handleDelete(entry.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
  heroMeta: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, minWidth: 160 },
  metaCard: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 16, padding: 16, backdropFilter: 'blur(12px)', transition: 'all 0.3s ease' },
  metaCardLink: { textDecoration: 'none', display: 'block', cursor: 'pointer', transition: 'transform 0.2s ease' },
  metaCardIcon: { fontSize: 28, marginBottom: 8 },
  metaValue: { fontSize: 24, fontWeight: 800, lineHeight: 1 },
  metaLabel: { marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  filterRow: { display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 16, marginBottom: 20, alignItems: 'flex-end' },
  filterField: { display: 'flex', flexDirection: 'column', gap: 6 },
  filterLabel: { fontSize: 12, fontWeight: 700, color: '#334155' },
  filterInput: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', fontSize: 13, color: '#0f172a' },
  sortControls: { display: 'flex', gap: 10, alignItems: 'center' },
  sortBtn: { padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', cursor: 'pointer', fontWeight: 700 },
  addBtn: { background: '#0f766e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 700 },
  info: { background: '#e8f1ff', border: '1px solid #cfe1fb', borderRadius: 12, padding: '12px 14px', color: '#114388', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
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
  emptyState: { padding: '28px 12px', textAlign: 'center', color: '#64748b' },
  emptyTitle: { fontSize: 16, fontWeight: 800, color: '#0f172a' },
  emptyText: { margin: '8px 0 0', fontSize: 13, lineHeight: 1.6 },
  tableWrap: { overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 14px', fontSize: 13, color: '#334155' },
  actionBtn: { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 8 },
  deleteBtn: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
}