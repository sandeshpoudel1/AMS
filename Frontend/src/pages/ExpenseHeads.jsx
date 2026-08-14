import { useEffect, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const SUB_HEADS_LOCAL_STORAGE_KEY = 'mopl.sub-heads'
const SUB_HEAD_META_LOCAL_STORAGE_KEY = 'mopl.sub-head-meta'

const defaultForm = {
  name: '',
  applies_to: 'Both',
  worker_linked: 'No',
  is_active: true,
}

const mapDaybookSubsToHeads = (rows) => {
  const names = [...new Set(rows.map((row) => (row?.sub || '').trim()).filter(Boolean))]
  return names.map((name) => ({
    id: `sub-${name}`,
    name,
    description: 'Loaded from daybook records',
    is_active: true,
    applies_to: 'Both',
    worker_linked: 'No',
  }))
}

const readLocalMeta = () => {
  try {
    const rows = JSON.parse(localStorage.getItem(SUB_HEAD_META_LOCAL_STORAGE_KEY) || '{}')
    return rows && typeof rows === 'object' ? rows : {}
  } catch {
    return {}
  }
}

const writeLocalMeta = (rows) => {
  localStorage.setItem(SUB_HEAD_META_LOCAL_STORAGE_KEY, JSON.stringify(rows))
}

const mergeHeadMeta = (head, meta = {}) => ({
  ...head,
  applies_to: meta.applies_to || 'Both',
  worker_linked: meta.worker_linked || 'No',
})

const resolveHeadMeta = (head) => {
  const metaRows = readLocalMeta()
  return metaRows[head.id] || metaRows[head.name] || {}
}

const mergeHeadsWithMeta = (heads) => heads.map((head) => mergeHeadMeta(head, resolveHeadMeta(head)))

const persistHeadMeta = (headId, values) => {
  const metaRows = readLocalMeta()
  writeLocalMeta({
    ...metaRows,
    [headId]: {
      ...(metaRows[headId] || {}),
      ...values,
    },
  })
}

const removeHeadMeta = (headId) => {
  const metaRows = readLocalMeta()
  if (!headId) return
  if (metaRows[headId]) {
    delete metaRows[headId]
  }
  Object.keys(metaRows).forEach((key) => {
    if (key === headId) return
    if (key === String(headId)) {
      delete metaRows[key]
    }
  })
  writeLocalMeta(metaRows)
}

const readLocalRows = (storageKey) => {
  try {
    const rows = JSON.parse(localStorage.getItem(storageKey) || '[]')
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

const writeLocalRows = (storageKey, rows) => {
  localStorage.setItem(storageKey, JSON.stringify(rows))
}

export default function ExpenseHeads() {
  const [heads, setHeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [expenseHeadApiAvailable, setExpenseHeadApiAvailable] = useState(true)
  const [form, setForm] = useState(defaultForm)
  const [editingId, setEditingId] = useState(null)

  const loadHeads = async () => {
    setLoading(true)
    try {
      const res = await api.get('/expense-heads')
      setExpenseHeadApiAvailable(true)
      setInfo('')
      const rows = Array.isArray(res.data.data) ? res.data.data : []
      setHeads(mergeHeadsWithMeta(rows))
    } catch (e) {
      if (e?.response?.status === 404) {
        setExpenseHeadApiAvailable(false)
        try {
          const daybookRes = await api.get('/day-book')
          const daybookEntries = Array.isArray(daybookRes?.data?.data?.entries) ? daybookRes.data.data.entries : []
          const fallbackHeads = mapDaybookSubsToHeads(daybookEntries)
          const localHeads = readLocalRows(SUB_HEADS_LOCAL_STORAGE_KEY)
          setHeads(mergeHeadsWithMeta([...localHeads, ...fallbackHeads]))
          setInfo('Sub Head is in preview mode. Showing mapped values from daybook records.')
          setError('')
          return
        } catch {
          // Use default error below.
        }
      }
      setError(e.response?.data?.message || 'Failed to load sub heads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHeads()
  }, [])

  const clearMessages = () => {
    setError('')
    setInfo('')
  }

  const resetForm = () => {
    setForm(defaultForm)
    setEditingId(null)
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    const normalizedName = form.name.trim().toLowerCase()
    if (!normalizedName) {
      setError('Sub head name is required')
      return
    }

    const duplicate = heads.some((head) => (
      String(head.name || '').trim().toLowerCase() === normalizedName
      && String(head.id) !== String(editingId || '')
    ))
    if (duplicate) {
      setError('A sub head with this name already exists. Please use a different name.')
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description?.trim() || null,
      is_active: Boolean(form.is_active),
      applies_to: form.applies_to,
      worker_linked: form.worker_linked,
    }

    if (!expenseHeadApiAvailable) {
      const localHeads = readLocalRows(SUB_HEADS_LOCAL_STORAGE_KEY)
      const nextHeads = editingId
        ? localHeads.map((head) => (head.id === editingId ? { ...head, ...payload } : head))
        : [{ id: `local-head-${Date.now()}`, ...payload }, ...localHeads]

      writeLocalRows(SUB_HEADS_LOCAL_STORAGE_KEY, nextHeads)
      persistHeadMeta(editingId || payload.name, payload)
      await loadHeads()
      setInfo(editingId ? 'Sub head updated locally in preview mode' : 'Sub head created locally in preview mode')
      resetForm()
      return
    }

    clearMessages()
    setSaving(true)
    try {
      const apiPayload = {
        name: payload.name,
        description: payload.description,
        is_active: payload.is_active,
      }

      if (editingId) {
        await api.put(`/expense-heads/${editingId}`, apiPayload)
        setInfo('Sub head updated successfully')
        persistHeadMeta(editingId, payload)
      } else {
        const confirmed = window.confirm('Are you sure you want to create this record?')
        if (!confirmed) {
          setSaving(false)
          return
        }

        const response = await api.post('/expense-heads', apiPayload)
        setInfo('Sub head created successfully')
        const createdHead = response?.data?.data
        if (createdHead?.id) {
          persistHeadMeta(createdHead.id, payload)
        } else {
          persistHeadMeta(payload.name, payload)
        }
      }

      resetForm()
      loadHeads()
    } catch (e) {
      const validationErrors = e.response?.data?.errors || {}
      const firstValidationError = Object.values(validationErrors).flat()[0]
      setError(firstValidationError || e.response?.data?.message || 'Failed to save sub head')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (head) => {
    setEditingId(head.id)
    setForm({
      name: head.name || '',
      description: head.description || '',
      applies_to: head.applies_to || 'Both',
      worker_linked: head.worker_linked || 'No',
      is_active: Boolean(head.is_active),
    })
  }

  const handleDelete = async (headId) => {
    if (!expenseHeadApiAvailable) {
      const nextHeads = readLocalRows(SUB_HEADS_LOCAL_STORAGE_KEY).filter((head) => head.id !== headId)
      writeLocalRows(SUB_HEADS_LOCAL_STORAGE_KEY, nextHeads)
      removeHeadMeta(headId)
      await loadHeads()
      setInfo('Sub head deleted locally in preview mode')
      return
    }
    if (!window.confirm('Delete this sub head?')) {
      return
    }

    clearMessages()
    try {
      await api.delete(`/expense-heads/${headId}`)
      setInfo('Sub head deleted successfully')
      loadHeads()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete sub head')
    }
  }


  return (
    <SidebarLayout title="Sub Head Settings" headerExtra={<button style={styles.headerBtn} onClick={resetForm}>+ New Sub Head</button>}>
      <div style={styles.container} className="reveal-up">
        {error && <div style={styles.error}>{error}<button style={styles.closeBtn} onClick={() => setError('')}>✕</button></div>}
        {info && <div style={styles.info}>{info}<button style={styles.closeInfoBtn} onClick={() => setInfo('')}>✕</button></div>}

        <div style={styles.layout}>
          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>{editingId ? 'Edit Sub Head' : 'Create Sub Head'}</h3>
            <p style={styles.panelText}>Use sub heads like Miscellaneous, Fine, Absent Penalty and use them in Finance misc entries.</p>

            <form style={styles.form} onSubmit={handleSubmit}>
              <div style={styles.field}>
                <label style={styles.label}>Head Name *</label>
                <input
                  style={styles.input}
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Fine"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Description</label>
                <textarea
                  style={styles.textarea}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional details"
                />
              </div>

              <div style={styles.gridSplit}>
                <div style={styles.field}>
                  <label style={styles.label}>Applies To</label>
                  <select style={styles.input} value={form.applies_to} onChange={(e) => setForm((prev) => ({ ...prev, applies_to: e.target.value }))}>
                    <option value="Both">Both</option>
                    <option value="Agency">Agency</option>
                    <option value="Candidate">Candidate</option>
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Worker Linked</label>
                  <select style={styles.input} value={form.worker_linked} onChange={(e) => setForm((prev) => ({ ...prev, worker_linked: e.target.value }))}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

              </div>

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                <span>Active</span>
              </label>

              <div style={styles.actions}>
                <button type="submit" style={saving ? styles.btnDisabled : styles.btn} disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update Sub Head' : 'Create Sub Head'}
                </button>
                <button type="button" style={styles.btnGray} onClick={resetForm}>Reset</button>
              </div>
            </form>
          </section>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>Configured Sub Heads</h3>

            {loading ? (
              <div style={styles.loading}>Loading sub heads...</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thead}>
                      {['Head', 'Applies To', 'Worker Linked', 'Status', 'Actions'].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heads.length === 0 && <tr><td colSpan={4} style={styles.empty}>No sub heads found</td></tr>}
                    {heads.map((head) => (
                      <tr key={head.id} style={styles.tr}>
                        <td style={styles.td}><strong>{head.name}</strong></td>
                        <td style={styles.td}>{head.applies_to || 'Both'}</td>
                        <td style={styles.td}>{head.worker_linked || 'No'}</td>
                        <td style={styles.td}><span style={head.is_active ? styles.active : styles.inactive}>{head.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td style={styles.td}>
                          <div style={styles.actionRow}>
                            <button style={styles.btnMini} onClick={() => handleEdit(head)}>Edit</button>
                            <button style={styles.btnMiniDanger} onClick={() => handleDelete(head.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: { display: 'grid', gap: 14 },
  error: { background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: '10px 14px', color: '#be123c', fontSize: 13, marginBottom: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 600 },
  info: { background: '#e8f1ff', border: '1px solid #cfe1fb', borderRadius: 12, padding: '10px 14px', color: '#114388', fontSize: 13, marginBottom: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 600 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#be123c' },
  closeInfoBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#114388' },
  headerBtn: { padding: '9px 16px', background: 'linear-gradient(135deg, #0a3772, #0f4d9d)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(320px, 0.95fr) minmax(0, 1.25fr)', gap: 16 },
  linkGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  gridSplit: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 },
  panel: { background: 'rgba(255,255,255,0.9)', border: '1px solid #dbe5f3', borderRadius: 16, boxShadow: '0 14px 24px rgba(17, 34, 64, 0.07)', padding: 16 },
  panelTitle: { margin: '0 0 6px', color: '#0f2a4f', fontSize: 18, fontWeight: 800 },
  panelText: { margin: '0 0 14px', color: '#5f779b', fontSize: 12 },
  form: { display: 'grid', gap: 12 },
  field: { display: 'grid', gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: '#27466f' },
  input: { width: '100%', padding: '9px 11px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', color: '#173864', background: 'linear-gradient(180deg, #ffffff, #f8fbff)' },
  textarea: { width: '100%', minHeight: 80, padding: '9px 11px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', color: '#173864', background: 'linear-gradient(180deg, #ffffff, #f8fbff)', resize: 'vertical' },
  checkboxRow: { display: 'inline-flex', gap: 8, alignItems: 'center', color: '#27466f', fontSize: 13, fontWeight: 600 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  btn: { padding: '9px 18px', background: 'linear-gradient(135deg, #0a3772, #0f4d9d)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 },
  btnDisabled: { padding: '9px 18px', background: '#9aacbf', color: '#fff', border: 'none', borderRadius: 10, cursor: 'not-allowed', fontWeight: 700 },
  btnGray: { padding: '9px 18px', background: '#e8edf6', color: '#27466f', border: '1px solid #d4dfef', borderRadius: 10, cursor: 'pointer', fontWeight: 600 },
  loading: { textAlign: 'center', color: '#526686', padding: 40 },
  tableWrap: { borderRadius: 12, overflow: 'hidden', border: '1px solid #dbe5f3' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#eef4fc' },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#35557d', borderBottom: '1px solid #d7e3f2' },
  tr: { borderBottom: '1px solid #edf3fb' },
  td: { padding: '12px 14px', fontSize: 13, color: '#27466f', verticalAlign: 'top' },
  meta: { color: '#7390b5', fontSize: 11, marginTop: 2 },
  empty: { color: '#6c84a6', fontSize: 12, padding: 20, textAlign: 'center' },
  tableWrapAlt: { borderRadius: 12, overflow: 'hidden', border: '1px solid #dbe5f3', marginTop: 12 },
  active: { background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700 },
  inactive: { background: '#fee2e2', color: '#991b1b', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700 },
  actionRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  btnMini: { padding: '4px 8px', background: '#e8f1ff', border: '1px solid #cfe1fb', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#114388' },
  btnMiniDanger: { padding: '4px 8px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#be123c' },
}
