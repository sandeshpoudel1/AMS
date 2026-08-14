import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const TRADE_CATALOG = [
  { value: 'scaffolding', label: 'Scaffolding', description: 'Fixed trade for scaffold erection and dismantling', subcategories: [] },
  { value: 'welding', label: 'Welding', description: 'Welding trade with MIG and TIG variants', subcategories: ['MIG', 'TIG'] },
  { value: 'shuttering', label: 'Shuttering', description: 'Formwork and shuttering work', subcategories: [] },
  { value: 'carpentry', label: 'Carpentry', description: 'Woodwork, fittings, and finishing', subcategories: [] },
  { value: 'mason', label: 'Mason', description: 'Brick, block, and plaster work', subcategories: [] },
  { value: 'plumbing', label: 'Plumbing', description: 'Pipe installation and repair work', subcategories: [] },
  { value: 'sandblasting', label: 'Sandblasting', description: 'Surface preparation and cleaning', subcategories: [] },
  { value: 'steelfixer', label: 'Steel Fixer', description: 'Rebar and reinforcement work', subcategories: [] },
  { value: 'rope_access', label: 'Rope Access', description: 'Height work and rope access operations', subcategories: [] },
]

const TRADE_OPTIONS = [
  ...TRADE_CATALOG.map((trade) => ({ value: trade.value, label: trade.label })),
  { value: 'other', label: 'Others' },
]

const formatMoney = (value) => {
  const numberValue = Number(value)
  if (Number.isNaN(numberValue)) return 'NPR 0.00'
  return `NPR ${numberValue.toFixed(2)}`
}

export default function TradeSettings() {
  const { user } = useAuth()
  const [trades, setTrades] = useState([])
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

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const loadTrades = async () => {
    setLoading(true)
    try {
      const res = await api.get('/trainings')
      setTrades(Array.isArray(res.data.data) ? res.data.data : [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load trades')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrades()
  }, [])

  const selectedCatalogTrade = useMemo(
    () => TRADE_CATALOG.find((trade) => trade.value === form.category),
    [form.category]
  )

  const subcategories = selectedCatalogTrade?.subcategories || []

  const getMatchingTrade = (catalogTrade, subcategory = '') => {
    return trades.find((trade) => {
      return trade.category === catalogTrade.value && (subcategory ? (trade.subcategory || '') === subcategory : true)
    })
  }

  const startTradeEdit = (catalogTrade, subcategory = '') => {
    const existingTrade = getMatchingTrade(catalogTrade, subcategory)

    setForm({
      name: existingTrade?.name || (subcategory ? `${catalogTrade.label} - ${subcategory}` : catalogTrade.label),
      category: catalogTrade.value,
      subcategory,
      description: existingTrade?.description || catalogTrade.description,
      daily_rate: existingTrade?.daily_rate ?? '',
      duration_days: existingTrade?.duration_days ?? 5,
    })
    setEditingId(existingTrade?.id || null)
    setShowForm(true)
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

  const handleEdit = (trade) => {
    setForm({
      name: trade.name || '',
      category: trade.category || '',
      subcategory: trade.subcategory || '',
      description: trade.description || '',
      daily_rate: trade.daily_rate ?? '',
      duration_days: trade.duration_days ?? 5,
    })
    setEditingId(trade.id)
    setShowForm(true)
  }

  const handleDelete = async (tradeId) => {
    if (!confirm('Delete this trade?')) return

    clearMessages()
    try {
      await api.delete(`/trainings/${tradeId}`)
      setSuccess('Trade deleted successfully')
      loadTrades()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete trade')
    }
  }

  const handleCreateCatalogEntries = async () => {
    clearMessages()
    setSaving(true)
    try {
      const existingKeys = new Set(
        trades.map((trade) => `${trade.category || ''}::${trade.subcategory || ''}`)
      )
      const existingNames = new Set(
        trades.map((trade) => String(trade.name || '').trim().toLowerCase()).filter(Boolean)
      )

      const entriesToCreate = []
      TRADE_CATALOG.forEach((trade) => {
        if (trade.subcategories.length > 0) {
          trade.subcategories.forEach((subcategory) => {
            const key = `${trade.value}::${subcategory}`
            const name = `${trade.label} - ${subcategory}`
            if (!existingKeys.has(key) && !existingNames.has(name.trim().toLowerCase())) {
              entriesToCreate.push({
                name,
                category: trade.value,
                subcategory,
                description: trade.description,
                daily_rate: 0,
                duration_days: 5,
              })
            }
          })
        } else {
          const key = `${trade.value}::`
          const name = trade.label
          if (!existingKeys.has(key) && !existingNames.has(name.trim().toLowerCase())) {
            entriesToCreate.push({
              name,
              category: trade.value,
              subcategory: '',
              description: trade.description,
              daily_rate: 0,
              duration_days: 5,
            })
          }
        }
      })

      if (entriesToCreate.length === 0) {
        setSuccess('All trade catalog entries already exist')
        return
      }

      const results = await Promise.allSettled(entriesToCreate.map((entry) => api.post('/trainings', entry)))
      const createdCount = results.filter((result) => result.status === 'fulfilled').length
      const failed = results.filter((result) => result.status === 'rejected')

      if (failed.length === 0) {
        setSuccess(`${createdCount} trade catalog entries created successfully`)
      } else if (createdCount > 0) {
        setSuccess(`${createdCount} trade catalog entries created. ${failed.length} skipped or failed.`)
      } else {
        const firstErrorPayload = failed[0]?.reason?.response?.data
        const firstValidationError = firstErrorPayload?.errors
          ? Object.values(firstErrorPayload.errors).flat()[0]
          : null
        const firstError = firstValidationError || firstErrorPayload?.message || 'Failed to create trade catalog entries'
        setError(firstError)
      }

      await loadTrades()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create trade catalog entries')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!form.name.trim() || !form.category || !form.daily_rate) {
      setError('Trade name, category, and price are required')
      return
    }

    if (form.category === 'welding' && !form.subcategory) {
      setError('Choose MIG or TIG for welding')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        daily_rate: Number(form.daily_rate),
        duration_days: Number(form.duration_days) || 5,
      }

      if (editingId) {
        await api.put(`/trainings/${editingId}`, payload)
        setSuccess('Trade catalog entry updated successfully')
      } else {
        await api.post('/trainings', payload)
        setSuccess('Trade catalog entry created successfully')
      }

      resetForm()
      setShowForm(false)
      loadTrades()
    } catch (e) {
      const validationErrors = e.response?.data?.errors
      const firstValidationError = validationErrors
        ? Object.values(validationErrors).flat()[0]
        : null
      setError(firstValidationError || e.response?.data?.message || 'Failed to save trade')
    } finally {
      setSaving(false)
    }
  }

  const fixedTrades = trades.filter((trade) => TRADE_CATALOG.some((catalogTrade) => catalogTrade.value === trade.category))
  const customTrades = trades.filter((trade) => !TRADE_CATALOG.some((catalogTrade) => catalogTrade.value === trade.category))

  return (
    <SidebarLayout
      title="Trade Settings"
      headerExtra={<button style={styles.headerButton} onClick={() => { resetForm(); setShowForm(true) }}>+ Add Trade Catalog Entry</button>}
    >
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div>
            <div style={styles.kicker}>Settings</div>
            <h2 style={styles.heroTitle}>Trade catalog and pricing</h2>
            <p style={styles.heroText}>Keep the trade list fixed for operations, then let admins add extra trades and pricing from the same panel.</p>
          </div>
          <div style={styles.heroMeta}>
            <div style={styles.metaCard}>
              <div style={styles.metaValue}>{fixedTrades.length || TRADE_CATALOG.length}</div>
              <div style={styles.metaLabel}>Fixed trade types</div>
            </div>
            <div style={styles.metaCard}>
              <div style={styles.metaValue}>{TRADE_CATALOG.reduce((count, trade) => count + (trade.subcategories?.length || 0), 0)}</div>
              <div style={styles.metaLabel}>Trade variants</div>
            </div>
            <div style={styles.metaCard}>
              <div style={styles.metaValue}>{customTrades.length}</div>
              <div style={styles.metaLabel}>Others added</div>
            </div>
          </div>
        </div>

        {error && <div style={styles.alertError}>{error}<button style={styles.alertClose} onClick={() => setError('')}>✕</button></div>}
        {success && <div style={styles.alertSuccess}>{success}<button style={styles.alertClose} onClick={() => setSuccess('')}>✕</button></div>}

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h3 style={styles.panelTitle}>Trade catalog</h3>
                <p style={styles.panelText}>Set and update pricing for the standard trade groups from here.</p>
              </div>
              <button type="button" style={styles.secondaryBtn} onClick={handleCreateCatalogEntries} disabled={saving}>
                {saving ? 'Creating...' : 'Create Catalog Entries'}
              </button>
            </div>

            <div style={styles.catalogList}>
              {TRADE_CATALOG.map((trade) => (
                <div key={trade.value} style={styles.catalogItem}>
                  <div>
                    <div style={styles.catalogTitle}>{trade.label}</div>
                    <div style={styles.catalogDescription}>{trade.description}</div>
                    {trade.subcategories.length > 0 && (
                      <div style={styles.chips}>
                        {trade.subcategories.map((subcategory) => (
                          <button key={subcategory} type="button" style={styles.chipButton} onClick={() => startTradeEdit(trade, subcategory)}>
                            Edit {subcategory}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" style={styles.editCatalogBtn} onClick={() => startTradeEdit(trade)}>
                    Edit price
                  </button>
                </div>
              ))}
            </div>

            {customTrades.length > 0 && (
              <div style={styles.savedCatalogSection}>
                <div style={styles.savedCatalogHeader}>
                  <h4 style={styles.savedCatalogTitle}>Saved Trade Catalog Entries</h4>
                  <span style={styles.savedCatalogCount}>{customTrades.length}</span>
                </div>
                <div style={styles.savedCatalogList}>
                  {customTrades.map((trade) => (
                    <div key={trade.id} style={styles.savedCatalogItem}>
                      <div>
                        <div style={styles.catalogTitle}>{trade.name}</div>
                        <div style={styles.catalogDescription}>
                          {trade.category}{trade.subcategory ? ` • ${trade.subcategory}` : ''}
                          {trade.description ? ` • ${trade.description}` : ''}
                        </div>
                      </div>
                      <div style={styles.savedCatalogActions}>
                        <button type="button" style={styles.chipButton} onClick={() => handleEdit(trade)}>Edit</button>
                        <button type="button" style={styles.chipDangerButton} onClick={() => handleDelete(trade.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h3 style={styles.panelTitle}>{editingId ? 'Edit trade catalog entry' : 'Add trade catalog entry or others'}</h3>
                <p style={styles.panelText}>Use this form to set trade catalog pricing, including custom Others entries.</p>
              </div>
            </div>

            {showForm ? (
              <form onSubmit={handleSubmit}>
                <div style={styles.formGrid}>
                  <div style={styles.field}>
                    <label style={styles.label}>Trade name *</label>
                    <input
                      style={styles.input}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Welding - MIG"
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Category</label>
                    <select
                      style={styles.input}
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: '' })}
                    >
                      <option value="">Select category</option>
                      {TRADE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {subcategories.length > 0 && (
                  <div style={styles.formGrid}>
                    <div style={styles.field}>
                      <label style={styles.label}>Subcategory</label>
                      <select
                        style={styles.input}
                        value={form.subcategory}
                        onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                      >
                        <option value="">Select subcategory</option>
                        {subcategories.map((subcategory) => (
                          <option key={subcategory} value={subcategory}>{subcategory}</option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.field} />
                  </div>
                )}

                <div style={styles.formGrid}>
                  <div style={styles.field}>
                    <label style={styles.label}>Fixed price (NPR) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      style={styles.input}
                      value={form.daily_rate}
                      onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Default duration (days)</label>
                    <input
                      type="number"
                      min="1"
                      style={styles.input}
                      value={form.duration_days}
                      onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                    />
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Description</label>
                  <textarea
                    style={styles.textarea}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional trade notes..."
                  />
                </div>

                <div style={styles.formActions}>
                  <button type="submit" style={styles.primaryBtn} disabled={saving}>
                    {saving ? 'Saving...' : editingId ? 'Update trade' : 'Create trade'}
                  </button>
                  <button
                    type="button"
                    style={styles.secondaryBtn}
                    onClick={() => {
                      setShowForm(false)
                      resetForm()
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div style={styles.emptyState}>
                <div style={styles.emptyTitle}>Add a custom trade</div>
                <p style={styles.emptyText}>Use the button above to add fixed pricing for a new trade or an “Others” entry.</p>
              </div>
            )}
          </section>
        </div>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Saved trades</h3>
              <p style={styles.panelText}>All trade rows stored through the admin training API.</p>
            </div>
          </div>

          {loading ? (
            <div style={styles.loading}>Loading trades...</div>
          ) : trades.length === 0 ? (
            <div style={styles.loading}>No trades have been added yet.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Trade</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Subcategory</th>
                    <th style={styles.th}>Price</th>
                    <th style={styles.th}>Duration</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id} style={styles.tr}>
                      <td style={styles.td}>{trade.name}</td>
                      <td style={styles.td}>{trade.category}</td>
                      <td style={styles.td}>{trade.subcategory || '-'}</td>
                      <td style={styles.td}>{formatMoney(trade.daily_rate)}</td>
                      <td style={styles.td}>{trade.duration_days} days</td>
                      <td style={styles.td}>
                        <span style={trade.is_active ? styles.activePill : styles.inactivePill}>
                          {trade.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button style={styles.actionBtn} onClick={() => handleEdit(trade)}>Edit</button>
                        <button style={styles.deleteBtn} onClick={() => handleDelete(trade.id)}>Delete</button>
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
  hero: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #0f766e 100%)',
    color: '#fff',
    borderRadius: 20,
    padding: 24,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 24,
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
  },
  kicker: { textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 12, opacity: 0.75, marginBottom: 8 },
  heroTitle: { margin: 0, fontSize: 30, lineHeight: 1.1 },
  heroText: { margin: '10px 0 0', maxWidth: 640, color: 'rgba(255,255,255,0.84)', fontSize: 14, lineHeight: 1.6 },
  heroMeta: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, minWidth: 360 },
  metaCard: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 16, padding: 16, backdropFilter: 'blur(12px)' },
  metaValue: { fontSize: 24, fontWeight: 800, lineHeight: 1 },
  metaLabel: { marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  headerButton: { background: '#0f766e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 700 },
  alertError: { background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  alertSuccess: { background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  alertClose: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1 },
  grid: { display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 20, alignItems: 'start' },
  panel: { background: '#fff', borderRadius: 18, padding: 20, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)', border: '1px solid #e2e8f0' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  panelTitle: { margin: 0, fontSize: 18, color: '#0f172a' },
  panelText: { margin: '6px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.5 },
  badge: { background: '#dbeafe', color: '#1e40af', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' },
  catalogList: { display: 'grid', gap: 12 },
  catalogItem: { border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 16, background: '#f8fafc' },
  catalogTitle: { fontSize: 15, fontWeight: 800, color: '#0f172a' },
  catalogDescription: { marginTop: 4, fontSize: 13, color: '#64748b', lineHeight: 1.5 },
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  chipButton: { background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 999, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  chipDangerButton: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 999, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  editCatalogBtn: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', whiteSpace: 'nowrap' },
  savedCatalogSection: { marginTop: 18, paddingTop: 16, borderTop: '1px solid #e2e8f0' },
  savedCatalogHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
  savedCatalogTitle: { margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' },
  savedCatalogCount: { background: '#e2e8f0', color: '#0f172a', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 },
  savedCatalogList: { display: 'grid', gap: 10 },
  savedCatalogItem: { border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 16, background: '#fff' },
  savedCatalogActions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' },
  field: { display: 'flex', flexDirection: 'column', marginBottom: 14 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  label: { fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: 100, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical' },
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
  activePill: { background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 },
  inactivePill: { background: '#fee2e2', color: '#991b1b', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 },
  actionBtn: { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 8 },
  deleteBtn: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  loading: { padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: 14 },
}