import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import {
  fetchPassportStoreStatusTemplates,
  fetchStatusTemplates,
  notifyStatusTemplatesUpdated,
  savePassportStoreStatusTemplates,
  saveStatusTemplates,
} from '../utils/statusTemplates'

class ChecklistEntry {
  constructor({ key, label, status, manual = true }) {
    this.key = key
    this.label = label
    this.status = status || 'not_received'
    this.manual = manual
  }

  static createManual(label, status = 'not_received') {
    return new ChecklistEntry({ key: `manual_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, label, status, manual: true })
  }
}

export default function DocumentChecklistSettings() {
  const [entries, setEntries] = useState([])
  const [passportStoreEntries, setPassportStoreEntries] = useState([])
  const [newLabel, setNewLabel] = useState('')
  const [passportStoreNewLabel, setPassportStoreNewLabel] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const rows = await fetchStatusTemplates()
        setEntries(rows)
      } catch {
        setEntries([])
      }

      try {
        const passportRows = await fetchPassportStoreStatusTemplates()
        setPassportStoreEntries(passportRows)
      } catch {
        setPassportStoreEntries([])
      }
    }

    void load()
  }, [])

  const addEntry = () => {
    if (!newLabel.trim()) return
    setEntries((prev) => [...prev, ChecklistEntry.createManual(newLabel.trim())])
    setNewLabel('')
  }

  const addPassportStoreEntry = () => {
    if (!passportStoreNewLabel.trim()) return
    setPassportStoreEntries((prev) => [...prev, ChecklistEntry.createManual(passportStoreNewLabel.trim())])
    setPassportStoreNewLabel('')
  }

  const removeEntry = (key) => setEntries((prev) => prev.filter((e) => e.key !== key))
  const removePassportStoreEntry = (key) => setPassportStoreEntries((prev) => prev.filter((e) => e.key !== key))

  const save = async () => {
    try {
      const saved = await saveStatusTemplates(entries)
      const savedPassportStore = await savePassportStoreStatusTemplates(passportStoreEntries)
      setEntries(saved)
      setPassportStoreEntries(savedPassportStore)
      setInfo('Status settings saved')
      notifyStatusTemplatesUpdated()
      setTimeout(() => setInfo(''), 3000)
    } catch (err) {
      const statusCode = err?.response?.status
      const errorCode = err?.response?.data?.error_code
      const message = String(err?.response?.data?.message || '')
      const lowered = message.toLowerCase()
      const missingTable = lowered.includes('status storage table is missing')
        || lowered.includes('app_settings table is missing')

      if (statusCode === 503 && (errorCode === 'APP_SETTINGS_TABLE_MISSING' || missingTable)) {
        setInfo('Status saved locally for now. Run backend migration to share across devices.')
        setTimeout(() => setInfo(''), 4000)
        return
      }

      setError(message || 'Failed to save')
    }
  }

  const updateLabel = (key, label) => setEntries((prev) => prev.map((e) => e.key === key ? { ...e, label } : e))
  const updatePassportStoreLabel = (key, label) => setPassportStoreEntries((prev) => prev.map((e) => e.key === key ? { ...e, label } : e))

  const list = useMemo(() => entries || [], [entries])
  const passportStoreList = useMemo(() => passportStoreEntries || [], [passportStoreEntries])

  const styles = {
    container: { display: 'grid', gap: 14 },
    panel: { background: '#ffffff', border: '1px solid #dbe3ef', borderRadius: 14, padding: 16 },
    panelTitle: { margin: '0 0 12px', color: '#0f2a4f', fontSize: 18, fontWeight: 800 },
    addRow: { display: 'grid', gridTemplateColumns: '1fr 220px 140px', gap: 10, marginBottom: 16, alignItems: 'center' },
    input: { width: '100%', border: '1px solid #c8d5e6', borderRadius: 10, padding: '9px 12px', fontSize: 14, background: '#fff' },
    select: { width: '100%', border: '1px solid #c8d5e6', borderRadius: 10, padding: '9px 12px', fontSize: 14, background: '#fff' },
    addBtn: { background: '#94a3b8', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 },
    checklistGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
    checklistItem: { padding: 16, borderRadius: 16, background: '#f8fbff', border: '1px solid #dbe3ef', display: 'grid', gap: 8 },
    checklistLabelInput: { border: '1px solid #c8d5e6', borderRadius: 8, padding: '8px 10px', fontSize: 13 },
    smallBtnDanger: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
    saveRow: { marginTop: 18, display: 'flex', justifyContent: 'flex-start' },
    saveBtn: { background: 'linear-gradient(135deg, #0a3772, #1c6bd0)', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 18px', cursor: 'pointer', fontWeight: 700 },
    headlineRow: {
      display: 'grid',
      gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 1fr)',
      gap: 12,
      alignItems: 'center',
      marginBottom: 14,
    },
    headingIdea: {
      minHeight: 92,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderRadius: 18,
      background: 'linear-gradient(180deg, #eef5fc, #ffffff)',
      border: '1px solid #ccdcee',
      color: '#24416d',
      fontWeight: 800,
      fontSize: 28,
      lineHeight: 1.05,
      position: 'relative',
    },
    closeRound: {
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 34,
      height: 34,
      borderRadius: '50%',
      border: '2px solid #9cc2ff',
      background: '#eef4ff',
      color: '#1e40af',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      fontWeight: 800,
    },
    headlineSelectWrap: { display: 'flex', justifyContent: 'center', marginTop: 8, marginBottom: 26 },
    headlineSelect: {
      minWidth: 300,
      padding: '12px 16px',
      borderRadius: 18,
      border: '1px solid #aebbd1',
      background: '#eef5ff',
      color: '#243b54',
      fontWeight: 800,
      fontSize: 24,
      outline: 'none',
    },
  }

  return (
    <SidebarLayout title="Status">
      <div style={styles.container}>
        {error && <div style={{ background: '#fee2e2', color: '#9f1239', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px' }}>{error}</div>}
        {info && <div style={{ background: '#e0f2fe', color: '#0c4a6e', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 12px' }}>{info}</div>}

        <section style={styles.panel}>
          <div style={styles.headlineRow}>
            <div style={styles.headingIdea}>
              <span>Passport Store Status</span>
              <span style={styles.closeRound}>×</span>
            </div>
            <div style={styles.headingIdea}>
              <span>Status</span>
              <span style={styles.closeRound}>×</span>
            </div>
          </div>
    

          <h3 style={styles.panelTitle}>Status</h3>

          <div style={styles.addRow}>
            <input placeholder="New status entry label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} style={styles.input} />
            <div />
            <button onClick={addEntry} style={styles.addBtn}>Add Status Entry</button>
          </div>

          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e6eef9' }}>Status Name</th>
                  <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #e6eef9' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.key}>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
                      <span>{item.label}</span>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                      <button onClick={() => {
                        const newLabel = prompt('Edit status name', item.label)
                        if (newLabel !== null) updateLabel(item.key, newLabel)
                      }} style={{ marginRight: 8, padding: '6px 10px', borderRadius: 6, border: 'none', background: '#e6f0ff', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => {
                        if (confirm('Delete this status entry?')) removeEntry(item.key)
                      }} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#fee2e2', cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: 12, color: '#64748b' }}>No status entries yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={styles.saveRow}>
            <button onClick={() => void save()} style={styles.saveBtn}>{'Save Status'}</button>
          </div>
        </section>

        <section style={styles.panel}>
          <h3 style={styles.panelTitle}>Passport Store Status</h3>

          <div style={styles.addRow}>
            <input placeholder="New passport store status" value={passportStoreNewLabel} onChange={(e) => setPassportStoreNewLabel(e.target.value)} style={styles.input} />
            <div />
            <button onClick={addPassportStoreEntry} style={styles.addBtn}>Add Status Entry</button>
          </div>

          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e6eef9' }}>Passport Store Status</th>
                  <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #e6eef9' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {passportStoreList.map((item) => (
                  <tr key={item.key}>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
                      <span>{item.label}</span>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                      <button onClick={() => {
                        const newLabel = prompt('Edit passport store status name', item.label)
                        if (newLabel !== null) updatePassportStoreLabel(item.key, newLabel)
                      }} style={{ marginRight: 8, padding: '6px 10px', borderRadius: 6, border: 'none', background: '#e6f0ff', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => {
                        if (confirm('Delete this passport store status entry?')) removePassportStoreEntry(item.key)
                      }} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#fee2e2', cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
                {passportStoreList.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: 12, color: '#64748b' }}>No passport store status entries yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SidebarLayout>
  )
}
