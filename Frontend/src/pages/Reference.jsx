import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const LEGACY_STORAGE_KEY = 'mopl.reference-sources'
const LEGACY_BACKUP_KEY = 'mopl.reference-sources.backup.v1'
const LEGACY_IMPORTED_FLAG_KEY = 'mopl.reference-sources.imported.v1'

export default function Reference() {
  const [references, setReferences] = useState([])
  const [candidates, setCandidates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [referenceSearch, setReferenceSearch] = useState('')
  const [sortField, setSortField] = useState('reference_name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [form, setForm] = useState({
    reference_name: '',
    contact_number: '',
    email: '',
    source_company: '',
    notes: '',
  })

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const normalizePayload = (item) => ({
    reference_name: (item?.reference_name || '').trim(),
    contact_number: (item?.contact_number || '').trim(),
    email: (item?.email || '').trim(),
    source_company: (item?.source_company || '').trim(),
    notes: (item?.notes || '').trim(),
    is_active: true,
  })

  const signature = (item) => {
    const name = (item?.reference_name || '').trim().toLowerCase()
    const contact = (item?.contact_number || '').trim().toLowerCase()
    const email = (item?.email || '').trim().toLowerCase()
    return `${name}|${contact}|${email}`
  }

  const loadCandidates = async () => {
    setCandidatesLoading(true)
    try {
      const response = await api.get('/candidates', { params: { per_page: 500 } })
      const rows = Array.isArray(response?.data?.data?.candidates) ? response.data.data.candidates : []
      setCandidates(rows)
    } catch (err) {
      // If candidate load fails, keep the page usable for reference management.
    } finally {
      setCandidatesLoading(false)
    }
  }

  const referenceCandidates = useMemo(() => {
    if (references.length === 0 || candidates.length === 0) return []

    const referenceNames = new Set(references.map((ref) => (String(ref.reference_name || '').trim().toLowerCase())))

    return candidates
      .filter((candidate) => {
        const candidateReference = String(candidate.source || candidate.reference_name || '').trim().toLowerCase()
        return candidateReference && referenceNames.has(candidateReference)
      })
      .map((candidate) => ({
        id: candidate.id,
        referenceName: candidate.source || candidate.reference_name || candidate.reference?.reference_name || candidate.reference?.name || 'Unknown Reference',
        candidateName: candidate.full_name || candidate.name || 'Unknown Candidate',
        passportNumber: candidate.passport_number || candidate.passport || '-',
        projectName: candidate.project?.project_name || candidate.project_name || 'No Project',
        tradeName: candidate.project?.trade || candidate.project?.trade_name || candidate.project?.trade_name || '-',
        country: candidate.project?.country || candidate.project?.country || '-',
        candidateStatus: candidate.status || '-',
      }))
  }, [candidates, references])

  const importLegacyReferences = async (currentRows) => {
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

    const results = await Promise.allSettled(toImport.map((item) => api.post('/reference-sources', item)))
    const importedCount = results.filter((res) => res.status === 'fulfilled').length
    const failedCount = results.length - importedCount

    if (failedCount === 0) {
      localStorage.setItem(LEGACY_IMPORTED_FLAG_KEY, '1')
      return { shouldRefresh: importedCount > 0, message: `Imported ${importedCount} legacy references to backend.` }
    }

    return {
      shouldRefresh: importedCount > 0,
      error: `Imported ${importedCount} legacy references, but ${failedCount} failed. Reopen Reference to retry remaining items.`,
    }
  }

  const loadReferences = async () => {
    setLoading(true)
    try {
      const response = await api.get('/reference-sources')
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      setReferences(rows)

      const importResult = await importLegacyReferences(rows)
      if (importResult?.shouldRefresh) {
        const refreshResponse = await api.get('/reference-sources')
        const refreshedRows = Array.isArray(refreshResponse?.data?.data) ? refreshResponse.data.data : []
        setReferences(refreshedRows)
      }

      if (importResult?.message) setSuccess(importResult.message)
      if (importResult?.error) setError(importResult.error)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load references')
    } finally {
      setLoading(false)
    }
  }

  const handleReferenceSort = (field) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const referenceSortIndicator = (field) => {
    if (sortField !== field) return ''
    return sortDirection === 'asc' ? ' ▲' : ' ▼'
  }

  const filteredAndSortedReferences = useMemo(() => {
    const searchTerm = String(referenceSearch || '').trim().toLowerCase()

    const filtered = references.filter((reference) => {
      if (!searchTerm) return true

      const haystack = [
        reference?.reference_name,
        reference?.contact_number,
        reference?.email,
        reference?.source_company,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(' ')

      return haystack.includes(searchTerm)
    })

    filtered.sort((left, right) => {
      const leftValue = String(left?.[sortField] || '').trim().toLowerCase()
      const rightValue = String(right?.[sortField] || '').trim().toLowerCase()

      const result = leftValue.localeCompare(rightValue)
      return sortDirection === 'asc' ? result : -result
    })

    return filtered
  }, [references, referenceSearch, sortField, sortDirection])

  useEffect(() => {
    void loadReferences()
    void loadCandidates()
  }, [])

  const resetForm = () => {
    setForm({
      reference_name: '',
      contact_number: '',
      email: '',
      source_company: '',
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
      source_company: form.source_company.trim(),
      notes: form.notes.trim(),
      is_active: true,
    }

    try {
      if (editingId) {
        const response = await api.put(`/reference-sources/${editingId}`, payload)
        const updated = response?.data?.data
        setReferences((prev) => prev.map((reference) => (reference.id === editingId ? updated : reference)))
        setSuccess('Reference updated successfully')
      } else {
        const response = await api.post('/reference-sources', payload)
        const created = response?.data?.data
        setReferences((prev) => [created, ...prev])
        setSuccess('Reference created successfully')
      }
      resetForm()
      setShowForm(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save reference')
    }
  }

  const handleEdit = (reference) => {
    setForm({
      reference_name: reference.reference_name || '',
      contact_number: reference.contact_number || '',
      email: reference.email || '',
      source_company: reference.source_company || '',
      notes: reference.notes || '',
    })
    setEditingId(reference.id)
    setShowForm(true)
  }

  const handleDelete = async (referenceId) => {
    if (!window.confirm('Delete this reference entry?')) return

    try {
      await api.delete(`/reference-sources/${referenceId}`)
      setReferences((prev) => prev.filter((reference) => reference.id !== referenceId))
      setSuccess('Reference deleted successfully')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete reference')
    }
  }

  return (
    <SidebarLayout
      title="Reference Settings"
      headerExtra={<button style={styles.addBtn} onClick={() => { resetForm(); setShowForm(true) }}>+ Add Reference</button>}
    >
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div>
            <div style={styles.kicker}>Settings</div>
            <h2 style={styles.heroTitle}>Reference Settings</h2>
            <p style={styles.heroText}>Record who sourced a candidate, which company or person referred them, and the place they came from.</p>
          </div>
          <div style={styles.heroMeta}>
            <div style={styles.metaCard}>
              <div style={styles.metaValue}>{references.length}</div>
              <div style={styles.metaLabel}>References</div>
            </div>
          </div>
        </div>

        {error && <div style={styles.error}>{error}<button style={styles.closeBtn} onClick={() => setError('')}>✕</button></div>}
        {success && <div style={styles.success}>{success}<button style={styles.closeBtn} onClick={() => setSuccess('')}>✕</button></div>}

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>{editingId ? 'Edit Reference' : 'Add Reference'}</h3>
              <p style={styles.panelText}>This is for the person who sourced the candidate for foreign employment.</p>
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
                <div style={styles.field}>
                  <label style={styles.label}>Source Company / Client</label>
                  <input style={styles.input} value={form.source_company} onChange={(e) => setForm({ ...form, source_company: e.target.value })} placeholder="Company or client" />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Notes</label>
                <input style={styles.input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" />
              </div>

              <div style={styles.formActions}>
                <button type="submit" style={styles.primaryBtn}>{editingId ? 'Update Reference' : 'Create Reference'}</button>
                <button type="button" style={styles.secondaryBtn} onClick={() => { setShowForm(false); resetForm() }}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyTitle}>No form open</div>
              <p style={styles.emptyText}>Add a reference entry when a person sources a candidate.</p>
            </div>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Saved References</h3>
              <p style={styles.panelText}>Admin-only source records.</p>
            </div>
          </div>

          <div style={styles.searchRow}>
            <input
              style={styles.searchInput}
              value={referenceSearch}
              onChange={(e) => setReferenceSearch(e.target.value)}
              placeholder="Search references..."
            />
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading references...</div>
          ) : filteredAndSortedReferences.length === 0 ? (
            <div style={styles.emptyState}>No references saved yet.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}><button style={styles.sortButton} onClick={() => handleReferenceSort('reference_name')}>Reference Name{referenceSortIndicator('reference_name')}</button></th>
                    <th style={styles.th}><button style={styles.sortButton} onClick={() => handleReferenceSort('contact_number')}>Contact Number{referenceSortIndicator('contact_number')}</button></th>
                    <th style={styles.th}><button style={styles.sortButton} onClick={() => handleReferenceSort('email')}>Email{referenceSortIndicator('email')}</button></th>
                    <th style={styles.th}><button style={styles.sortButton} onClick={() => handleReferenceSort('source_company')}>Source Company{referenceSortIndicator('source_company')}</button></th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedReferences.map((reference) => (
                    <tr key={reference.id} style={styles.tr}>
                      <td style={styles.td}><strong>{reference.reference_name}</strong></td>
                      <td style={styles.td}>{reference.contact_number || '-'}</td>
                      <td style={styles.td}>{reference.email || '-'}</td>
                      <td style={styles.td}>{reference.source_company || '-'}</td>
                      <td style={styles.td}>
                        <button style={styles.actionBtn} onClick={() => handleEdit(reference)}>Edit</button>
                        <button style={styles.deleteBtn} onClick={() => handleDelete(reference.id)}>Delete</button>
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
  searchRow: { display: 'flex', justifyContent: 'flex-start', marginBottom: 14 },
  searchInput: { width: 'min(420px, 100%)', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
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
  sortButton: { background: 'transparent', border: 'none', padding: 0, color: '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'inherit' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 14px', fontSize: 13, color: '#334155' },
  actionBtn: { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 8 },
  deleteBtn: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
}
