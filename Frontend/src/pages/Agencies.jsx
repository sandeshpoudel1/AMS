import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const LEGACY_STORAGE_KEY = 'mopl.agencies'
const LEGACY_BACKUP_KEY = 'mopl.agencies.backup.v1'
const LEGACY_IMPORTED_FLAG_KEY = 'mopl.agencies.imported.v1'

const countryOptions = [
  'Nepal', 'UAE', 'Qatar', 'KSA', 'Oman', 'Bahrain', 'Romania', 'Cyprus',
  'Bulgaria', 'Moldova', 'India', 'Kuwait', 'Malaysia', 'Korea', 'Japan', 'Singapore',
]

const mapBatchesToAgencies = (batches) => {
  const byName = new Map()

  batches.forEach((batch) => {
    const company = batch?.training_company
    const companyName = company?.company_name || ''
    if (!companyName || byName.has(companyName)) return

    byName.set(companyName, {
      id: `batch-${companyName}`,
      company_name: companyName,
      contact_person_1: '',
      designation_1: '',
      phone_number_1: '',
      email_1: '',
      contact_person_2: '',
      designation_2: '',
      phone_number_2: '',
      email_2: '',
      country: company?.address || '',
      note: 'Loaded from batch records',
      is_active: true,
    })
  })

  return Array.from(byName.values())
}

export default function Agencies() {
  const [agencies, setAgencies] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [clientApiAvailable, setClientApiAvailable] = useState(true)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    company_name: '',
    contact_person_1: '',
    designation_1: '',
    phone_number_1: '',
    email_1: '',
    contact_person_2: '',
    designation_2: '',
    phone_number_2: '',
    email_2: '',
    country: '',
    note: '',
  })
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [sortBy, setSortBy] = useState('company_name')
  const [sortOrder, setSortOrder] = useState('asc')

  const clearMessages = () => {
    setInfo('')
    setError('')
    setSuccess('')
  }

  const getSortDirectionLabel = (field) => {
    if (sortBy !== field) return ''
    return sortOrder === 'asc' ? ' ▲' : ' ▼'
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const filteredAgencies = agencies
    .filter((agency) => {
      const query = search.trim().toLowerCase()
      if (!query) return true
      const haystack = [
        agency.company_name,
        agency.contact_person_1,
        agency.designation_1,
        agency.phone_number_1,
        agency.email_1,
        agency.contact_person_2,
        agency.designation_2,
        agency.phone_number_2,
        agency.email_2,
        agency.country,
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
    .filter((agency) => {
      if (!countryFilter) return true
      return String(agency.country || '').toLowerCase().includes(countryFilter.toLowerCase())
    })
    .sort((a, b) => {
      const aValue = String(a[sortBy] || '').toLowerCase()
      const bValue = String(b[sortBy] || '').toLowerCase()
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

  const normalizeAgencyPayload = (agency) => ({
    company_name: (agency?.company_name || '').trim(),
    contact_person_1: (agency?.contact_person_1 || agency?.contact_person || '').trim(),
    designation_1: (agency?.designation_1 || '').trim(),
    phone_number_1: (agency?.phone_number_1 || agency?.phone || '').trim(),
    email_1: (agency?.email_1 || agency?.email || '').trim(),
    contact_person_2: (agency?.contact_person_2 || '').trim(),
    designation_2: (agency?.designation_2 || '').trim(),
    phone_number_2: (agency?.phone_number_2 || '').trim(),
    email_2: (agency?.email_2 || '').trim(),
    country: (agency?.country || '').trim(),
    note: (agency?.note || '').trim(),
    is_active: true,
  })

  const agencySignature = (agency) => {
    const name = (agency?.company_name || '').trim().toLowerCase()
    const email1 = (agency?.email_1 || agency?.email || '').trim().toLowerCase()
    const email2 = (agency?.email_2 || '').trim().toLowerCase()
    return `${name}|${email1}|${email2}`
  }

  const importLegacyAgencies = async (currentRows) => {
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

    const normalizedLegacy = legacyRows
      .map(normalizeAgencyPayload)
      .filter((agency) => agency.company_name)

    const existingSignatures = new Set(currentRows.map(agencySignature))
    const toImport = normalizedLegacy.filter((agency) => !existingSignatures.has(agencySignature(agency)))

    if (toImport.length === 0) {
      localStorage.setItem(LEGACY_IMPORTED_FLAG_KEY, '1')
      return { shouldRefresh: false, message: 'Legacy clients were already synced.' }
    }

    const results = await Promise.allSettled(
      toImport.map((agency) => api.post('/agencies', agency))
    )

    const importedCount = results.filter((res) => res.status === 'fulfilled').length
    const failedCount = results.length - importedCount

    if (failedCount === 0) {
      localStorage.setItem(LEGACY_IMPORTED_FLAG_KEY, '1')
      return {
        shouldRefresh: importedCount > 0,
        message: `Imported ${importedCount} legacy clients to backend.`,
      }
    }

    return {
      shouldRefresh: importedCount > 0,
      error: `Imported ${importedCount} legacy clients, but ${failedCount} failed. Please open Client again to retry remaining items.`,
    }
  }

  const loadAgencies = async () => {
    setLoading(true)
    try {
      const response = await api.get('/agencies')
      setClientApiAvailable(true)
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      setAgencies(rows)

      const legacyImportResult = await importLegacyAgencies(rows)

      if (legacyImportResult?.shouldRefresh) {
        const refreshResponse = await api.get('/agencies')
        const refreshedRows = Array.isArray(refreshResponse?.data?.data) ? refreshResponse.data.data : []
        setAgencies(refreshedRows)
      }

      if (legacyImportResult?.message) {
        setSuccess(legacyImportResult.message)
      }

      if (legacyImportResult?.error) {
        setError(legacyImportResult.error)
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        setClientApiAvailable(false)
        try {
          const batchResponse = await api.get('/batches')
          const batchRows = Array.isArray(batchResponse?.data?.data?.batches) ? batchResponse.data.data.batches : []
          const fallbackRows = mapBatchesToAgencies(batchRows)
          if (fallbackRows.length > 0) {
            setAgencies(fallbackRows)
            setInfo('Client is in preview mode. Showing mapped client data from existing batch records.')
            setError('')
            return
          }
        } catch {
          // Continue to local-storage fallback.
        }
      }

      try {
        const localRows = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]')
        if (Array.isArray(localRows) && localRows.length > 0) {
          setAgencies(localRows)
          setInfo('Client is in preview mode. Showing previously saved local client data.')
          setError('')
        } else {
          setError(err.response?.data?.message || 'Failed to load clients')
        }
      } catch {
        setError(err.response?.data?.message || 'Failed to load clients')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAgencies()
  }, [])

  const resetForm = () => {
    setForm({
      company_name: '',
      contact_person_1: '',
      designation_1: '',
      phone_number_1: '',
      email_1: '',
      contact_person_2: '',
      designation_2: '',
      phone_number_2: '',
      email_2: '',
      country: '',
      note: '',
    })
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!form.company_name.trim()) {
      setError('Company name is required')
      return
    }

    const payload = {
      company_name: form.company_name.trim(),
      contact_person_1: form.contact_person_1.trim(),
      designation_1: form.designation_1.trim(),
      phone_number_1: form.phone_number_1.trim(),
      email_1: form.email_1.trim(),
      contact_person_2: form.contact_person_2.trim(),
      designation_2: form.designation_2.trim(),
      phone_number_2: form.phone_number_2.trim(),
      email_2: form.email_2.trim(),
      country: form.country.trim(),
      note: form.note.trim(),
      is_active: true,
    }

    if (!clientApiAvailable) {
      const nextRows = editingId
        ? agencies.map((agency) => (agency.id === editingId ? { ...agency, ...payload } : agency))
        : [{ id: `local-${Date.now()}`, ...payload }, ...agencies]

      setAgencies(nextRows)
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(nextRows))
      setSuccess(editingId ? 'Client updated locally in preview mode' : 'Client created locally in preview mode')
      resetForm()
      setShowForm(false)
      return
    }

    try {
      if (editingId) {
        const response = await api.put(`/agencies/${editingId}`, payload)
        const updated = response?.data?.data
        setAgencies((prev) => prev.map((agency) => {
          if (String(agency.id) !== String(editingId)) return agency
          return {
            ...agency,
            ...payload,
            ...(updated && typeof updated === 'object' ? updated : {}),
            id: updated?.id ?? agency.id,
          }
        }))
        setSuccess('Client updated successfully')
      } else {
        const confirmed = window.confirm('Are you sure you want to create this record?')
        if (!confirmed) {
          return
        }

        const response = await api.post('/agencies', payload)
        const created = response?.data?.data
        const createdRow = {
          ...payload,
          ...(created && typeof created === 'object' ? created : {}),
          id: created?.id ?? `tmp-${Date.now()}`,
        }
        setAgencies((prev) => [createdRow, ...prev])
        setSuccess('Client created successfully')
      }

      resetForm()
      setShowForm(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save client')
    }
  }

  const handleEdit = (agency) => {
    setForm({
      company_name: agency.company_name || '',
      contact_person_1: agency.contact_person_1 || agency.contact_person || '',
      designation_1: agency.designation_1 || '',
      phone_number_1: agency.phone_number_1 || agency.phone || '',
      email_1: agency.email_1 || agency.email || '',
      contact_person_2: agency.contact_person_2 || '',
      designation_2: agency.designation_2 || '',
      phone_number_2: agency.phone_number_2 || '',
      email_2: agency.email_2 || '',
      country: agency.country || '',
      note: agency.note || '',
    })
    setEditingId(agency.id)
    setShowForm(true)
  }

  const handleDelete = async (agencyId) => {
    if (!window.confirm('Delete this client?')) return

    if (!clientApiAvailable) {
      const nextRows = agencies.filter((agency) => agency.id !== agencyId)
      setAgencies(nextRows)
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(nextRows))
      setSuccess('Client deleted locally in preview mode')
      return
    }

    try {
      await api.delete(`/agencies/${agencyId}`)
      setAgencies((prev) => prev.filter((agency) => agency.id !== agencyId))
      setSuccess('Client deleted successfully')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete client')
    }
  }

  return (
    <SidebarLayout
      title="Client"
      headerExtra={<button style={styles.addBtn} onClick={() => { resetForm(); setShowForm(true) }}>+ Add Client</button>}
    >
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div>
            <div style={styles.kicker}>Settings</div>
            <h2 style={styles.heroTitle}>Client master list</h2>
            <p style={styles.heroText}>Maintain company records for recruitment and manpower operations from one admin-controlled place.</p>
          </div>
          <div style={styles.heroMeta}>
            <div style={styles.metaCard}>
              <div style={styles.metaValue}>{agencies.length}</div>
              <div style={styles.metaLabel}>Clients</div>
            </div>
            <Link to="/project-settings" style={styles.metaCardLink}>
              <div style={styles.metaCard}>
                <div style={styles.metaCardIcon}>⚙️</div>
                <div style={styles.metaLabel}>Project Settings</div>
              </div>
            </Link>
            <Link to="/bd" style={styles.metaCardLink}>
              <div style={styles.metaCard}>
                <div style={styles.metaCardIcon}>💼</div>
                <div style={styles.metaLabel}>Business Development</div>
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
              <h3 style={styles.panelTitle}>{editingId ? 'Edit Client' : 'Add Client'}</h3>
              <p style={styles.panelText}>Use this form to store client company details.</p>
            </div>
          </div>

          {showForm ? (
            <form onSubmit={handleSubmit}>
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Company Name *</label>
                  <input style={styles.input} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Client company name" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Contact Person 1</label>
                  <input style={styles.input} value={form.contact_person_1} onChange={(e) => setForm({ ...form, contact_person_1: e.target.value })} placeholder="Contact person 1" />
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Designation 1</label>
                  <input style={styles.input} value={form.designation_1} onChange={(e) => setForm({ ...form, designation_1: e.target.value })} placeholder="Designation 1" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Email 1</label>
                  <input style={styles.input} type="email" value={form.email_1} onChange={(e) => setForm({ ...form, email_1: e.target.value })} placeholder="Email 1" />
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Phone Number 1</label>
                  <input style={styles.input} value={form.phone_number_1} onChange={(e) => setForm({ ...form, phone_number_1: e.target.value })} placeholder="Phone number 1" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Contact Person 2</label>
                  <input style={styles.input} value={form.contact_person_2} onChange={(e) => setForm({ ...form, contact_person_2: e.target.value })} placeholder="Contact person 2" />
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Phone Number 2</label>
                  <input style={styles.input} value={form.phone_number_2} onChange={(e) => setForm({ ...form, phone_number_2: e.target.value })} placeholder="Phone number 2" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Email 2</label>
                  <input style={styles.input} type="email" value={form.email_2} onChange={(e) => setForm({ ...form, email_2: e.target.value })} placeholder="Email 2" />
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Designation 2</label>
                  <input style={styles.input} value={form.designation_2} onChange={(e) => setForm({ ...form, designation_2: e.target.value })} placeholder="Designation 2" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Country</label>
                  <select
                    style={styles.input}
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  >
                    <option value="">Select country</option>
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Note</label>
                  <input style={styles.input} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional note" />
                </div>
              </div>

              <div style={styles.formActions}>
                <button type="submit" style={styles.primaryBtn}>{editingId ? 'Update Client' : 'Create Client'}</button>
                <button type="button" style={styles.secondaryBtn} onClick={() => { setShowForm(false); resetForm() }}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyTitle}>No form open</div>
              <p style={styles.emptyText}>Add company clients here.</p>
            </div>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Saved Clients</h3>
              <p style={styles.panelText}>Admin-only company records.</p>
            </div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading clients...</div>
          ) : agencies.length === 0 ? (
            <div style={styles.emptyState}>No clients saved yet.</div>
          ) : (
            <>
              <div style={styles.tableControls}>
                <input
                  style={styles.searchInput}
                  placeholder="Search clients, contact, email or country..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Country</label>
                  <select
                    style={styles.filterSelect}
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                  >
                    <option value="">All countries</option>
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
                {(search || countryFilter) && (
                  <button style={styles.clearBtn} type="button" onClick={() => { setSearch(''); setCountryFilter('') }}>
                    Clear
                  </button>
                )}
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.sortableTh} onClick={() => handleSort('company_name')}>
                      Company{getSortDirectionLabel('company_name')}
                    </th>
                    <th style={styles.sortableTh} onClick={() => handleSort('contact_person_1')}>
                      Contact Person 1{getSortDirectionLabel('contact_person_1')}
                    </th>
                    <th style={styles.sortableTh} onClick={() => handleSort('designation_1')}>
                      Designation 1{getSortDirectionLabel('designation_1')}
                    </th>
                    <th style={styles.sortableTh} onClick={() => handleSort('phone_number_1')}>
                      Phone Number 1{getSortDirectionLabel('phone_number_1')}
                    </th>
                    <th style={styles.sortableTh} onClick={() => handleSort('email_1')}>
                      Email 1{getSortDirectionLabel('email_1')}
                    </th>
                    <th style={styles.sortableTh} onClick={() => handleSort('contact_person_2')}>
                      Contact Person 2{getSortDirectionLabel('contact_person_2')}
                    </th>
                    <th style={styles.sortableTh} onClick={() => handleSort('designation_2')}>
                      Designation 2{getSortDirectionLabel('designation_2')}
                    </th>
                    <th style={styles.sortableTh} onClick={() => handleSort('phone_number_2')}>
                      Phone Number 2{getSortDirectionLabel('phone_number_2')}
                    </th>
                    <th style={styles.sortableTh} onClick={() => handleSort('email_2')}>
                      Email 2{getSortDirectionLabel('email_2')}
                    </th>
                    <th style={styles.sortableTh} onClick={() => handleSort('country')}>
                      Country{getSortDirectionLabel('country')}
                    </th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgencies.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={styles.empty}>No clients match your search or filters.</td>
                    </tr>
                  ) : filteredAgencies.map((agency) => (
                    <tr key={agency.id} style={styles.tr}>
                      <td style={styles.td}><strong>{agency.company_name}</strong></td>
                      <td style={styles.td}>{agency.contact_person_1 || agency.contact_person || '-'}</td>
                      <td style={styles.td}>{agency.designation_1 || '-'}</td>
                      <td style={styles.td}>{agency.phone_number_1 || agency.phone || '-'}</td>
                      <td style={styles.td}>{agency.email_1 || agency.email || '-'}</td>
                      <td style={styles.td}>{agency.contact_person_2 || '-'}</td>
                      <td style={styles.td}>{agency.designation_2 || '-'}</td>
                      <td style={styles.td}>{agency.phone_number_2 || '-'}</td>
                      <td style={styles.td}>{agency.email_2 || '-'}</td>
                      <td style={styles.td}>{agency.country || '-'}</td>
                      <td style={styles.td}>
                        <button style={styles.actionBtn} onClick={() => handleEdit(agency)}>Edit</button>
                        <button style={styles.deleteBtn} onClick={() => handleDelete(agency.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>            </>          )}
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
  tableControls: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  searchInput: { flex: '1 1 320px', minWidth: 200, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13 },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  filterLabel: { fontSize: 12, color: '#475569', fontWeight: 700 },
  filterSelect: { minWidth: 180, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13 },
  clearBtn: { background: '#e2e8f0', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 700 },
  tableWrap: { overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  sortableTh: { padding: '12px 14px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 14px', fontSize: 13, color: '#334155' },
  actionBtn: { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 8 },
  deleteBtn: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
}