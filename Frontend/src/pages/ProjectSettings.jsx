import { Fragment, useEffect, useMemo, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

const defaultTradeRow = {
  trade: '',
  quantity: '',
  salary: '',
  food: '',
  allowance: '',
  office_rate: '',
  remark: '',
  visa_charge: '',
  visa_charge_provided: true,
  visa_charge_not_applicable: false,
  fla_charge: '',
  fla_charge_provided: true,
  fla_charge_not_applicable: false,
  vfs_charge: '',
  vfs_charge_provided: true,
  vfs_charge_not_applicable: false,
  ticket_charge: '',
  ticket_charge_provided: true,
  ticket_charge_not_applicable: false,
  svp_charge: '',
  svp_charge_provided: true,
  svp_charge_not_applicable: false,
  qvc_charge: '',
  qvc_charge_provided: true,
  qvc_charge_not_applicable: false,
  service_charge: '',
  service_charge_provided: true,
  service_charge_not_applicable: false,
  additional_charge: '',
  additional_charge_provided: true,
  additional_charge_not_applicable: false,
  showDetails: false,
}

const createTradeRow = () => ({
  ...defaultTradeRow,
  id: String(Date.now()) + Math.random().toString(36).slice(2),
})

const countryOptions = [
  'Nepal',
  'UAE',
  'Qatar',
  'KSA',
  'Romania',
  'Cyprus',
  'Kuwait',
  'Oman',
  'Baharain',
  'Korea',
  'Japan',
  'Bulgaria'
].slice().sort((a, b) => String(a).localeCompare(String(b)))
const PROJECT_COLUMN_PREFS_KEY = 'mopl.project.mappings.columns.v1'
const PROJECT_COLUMN_DEFAULTS = ['Project', 'Client', 'Country', 'Trade', 'Total Demand', 'Salary', 'Office', 'Ref', 'BD', 'Status', 'Note']
const readProjectColumnPrefs = () => {
  if (typeof window === 'undefined') {
    return { order: [...PROJECT_COLUMN_DEFAULTS], hidden: [] }
  }

  try {
    const raw = localStorage.getItem(PROJECT_COLUMN_PREFS_KEY)
    if (!raw) {
      return { order: [...PROJECT_COLUMN_DEFAULTS], hidden: [] }
    }

    const parsed = JSON.parse(raw)
    const known = new Set(PROJECT_COLUMN_DEFAULTS)
    const parsedOrder = Array.isArray(parsed?.order) ? parsed.order.filter((label) => known.has(label)) : []
    const appendedDefaults = PROJECT_COLUMN_DEFAULTS.filter((label) => !parsedOrder.includes(label))
    const finalOrder = [...parsedOrder, ...appendedDefaults]
    const hidden = Array.isArray(parsed?.hidden) ? parsed.hidden.filter((label) => known.has(label)) : []

    return { order: finalOrder, hidden }
  } catch {
    return { order: [...PROJECT_COLUMN_DEFAULTS], hidden: [] }
  }
}
const getDefaultForm = () => ({
  project_name: '',
  agency_id: '',
  role_name: '',
  project_reference_code: '',
  country: '',
  total_demand: '',
  bd: '',
  note: '',
  is_active: true,
  trade_rows: [createTradeRow()],
})

export default function ProjectSettings() {
  const [agencies, setAgencies] = useState([])
  const [bdSources, setBdSources] = useState([])
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState(getDefaultForm())
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showTradeTable, setShowTradeTable] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [expandedProjects, setExpandedProjects] = useState(() => new Set())
  const [showColumnManager, setShowColumnManager] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState(() => readProjectColumnPrefs().hidden)
  const [columnOrder, setColumnOrder] = useState(() => readProjectColumnPrefs().order)

  const loadAgencies = async () => {
    try {
      const response = await api.get('/agencies')
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      // sort agencies (clients) alphabetically by company_name
      rows.sort((a, b) => String(a?.company_name || '').localeCompare(String(b?.company_name || '')))
      setAgencies(rows)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load clients')
    }
  }

  const loadBdSources = async () => {
    try {
      const response = await api.get('/bd-sources')
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      setBdSources(rows)
    } catch (err) {
      setBdSources([])
    }
  }

  const loadProjects = async () => {
    setLoading(true)
    try {
      const response = await api.get('/project-settings')
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      // sort projects alphabetically by project_name
      rows.sort((a, b) => String(a?.project_name || '').localeCompare(String(b?.project_name || '')))
      setProjects(rows)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load project mappings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAgencies()
    void loadBdSources()
    void loadProjects()
  }, [])

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const resetForm = () => {
    setForm(getDefaultForm())
    setEditingId(null)
    setShowTradeTable(false)
  }

  const selectedAgency = useMemo(
    () => agencies.find((agency) => String(agency.id) === String(form.agency_id)) || null,
    [agencies, form.agency_id]
  )

  const selectedBd = useMemo(
    () => bdSources.find((source) => String(source.id) === String(form.bd)) || null,
    [bdSources, form.bd]
  )

  const handleAgencyChange = (agencyId) => {
    const matchedAgency = agencies.find((agency) => String(agency.id) === String(agencyId)) || null
    setForm((prev) => ({
      ...prev,
      agency_id: agencyId,
      country: matchedAgency?.country || '',
    }))
  }

  const filteredProjects = useMemo(() => {
    const search = projectSearch.trim().toLowerCase()
    if (!search) return projects

    return projects.filter((project) => [
      project.project_name,
      project.project_reference_code,
      project.passport_number,
      project.candidate_name,
      project.name,
      project.agency?.company_name,
      project.agency_name,
      project.country,
      project.trade,
      project.bd,
      project.note,
    ].some((value) => String(value || '').toLowerCase().includes(search)))
  }, [projectSearch, projects])

  const groupedProjects = useMemo(() => {
    const groups = new Map()
    filteredProjects.forEach((project) => {
      const key = String(project.project_name || 'Unnamed project')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(project)
    })
    // sort groups by project name
    const entries = Array.from(groups.entries()).map(([projectName, tradeRows]) => {
      // sort tradeRows by client/company name then country
      tradeRows.sort((x, y) => {
        const ax = String(x?.agency?.company_name || x?.agency_name || '').toLowerCase()
        const ay = String(y?.agency?.company_name || y?.agency_name || '').toLowerCase()
        if (ax !== ay) return ax.localeCompare(ay)
        const cx = String(x?.country || '').toLowerCase()
        const cy = String(y?.country || '').toLowerCase()
        return cx.localeCompare(cy)
      })
      return { projectName, tradeRows }
    })

    entries.sort((a, b) => String(a.projectName || '').localeCompare(String(b.projectName || '')))
    return entries
  }, [filteredProjects])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(PROJECT_COLUMN_PREFS_KEY, JSON.stringify({
      order: columnOrder,
      hidden: hiddenColumns,
    }))
  }, [columnOrder, hiddenColumns])

  const visibleProjectColumns = columnOrder.filter((label) => !hiddenColumns.includes(label))

  const isColumnHidden = (label) => hiddenColumns.includes(label)

  const toggleColumnVisibility = (label) => {
    setHiddenColumns((current) => (
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    ))
  }

  const clearHiddenColumns = () => setHiddenColumns([])

  const resetColumnOrder = () => setColumnOrder([...PROJECT_COLUMN_DEFAULTS])

  const moveColumn = (sourceLabel, targetLabel) => {
    if (!sourceLabel || !targetLabel || sourceLabel === targetLabel) return

    setColumnOrder((current) => {
      const sourceIndex = current.indexOf(sourceLabel)
      const targetIndex = current.indexOf(targetLabel)
      if (sourceIndex === -1 || targetIndex === -1) return current

      const next = current.filter((label) => label !== sourceLabel)
      const insertIndex = next.indexOf(targetLabel)
      next.splice(insertIndex, 0, sourceLabel)
      return next
    })
  }

  const handleColumnDragStart = (label, event) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', label)
  }

  const handleColumnDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleColumnDrop = (label, event) => {
    event.preventDefault()
    const sourceLabel = event.dataTransfer.getData('text/plain')
    moveColumn(sourceLabel, label)
  }

  const formatAmountSummary = (values) => {
    if (!values.length) return '-'
    if (values.length === 1) return values[0].toLocaleString()

    const min = Math.min(...values)
    const max = Math.max(...values)

    if (min === max) return min.toLocaleString()
    return `${min.toLocaleString()} - ${max.toLocaleString()}`
  }

  const toggleProjectExpanded = (projectName) => {
    setExpandedProjects((current) => {
      const next = new Set(current)
      if (next.has(projectName)) next.delete(projectName)
      else next.add(projectName)
      return next
    })
  }

  const breakdownFields = [
    { key: 'visa_charge', label: 'Visa' },
    { key: 'fla_charge', label: 'Training Fee' },
    { key: 'vfs_charge', label: 'VFS Charge' },
    { key: 'ticket_charge', label: 'Airline Ticket' },
    { key: 'svp_charge', label: 'SVP Charge' },
    { key: 'qvc_charge', label: 'QVC Charge' },
    { key: 'service_charge', label: 'Service Charge' },
    { key: 'additional_charge', label: 'Additional Charge' },
  ]

  const normalizeCharge = (value, provided, notApplicable) => {
    if (provided || notApplicable) {
      return null
    }
    return value ? Number(value) : null
  }

  const handleChargeModeChange = (index, key, mode) => {
    const current = form.trade_rows[index] || {}
    updateTradeRow(index, {
      [`${key}_provided`]: mode === 'provided',
      [`${key}_not_applicable`]: mode === 'not_applicable',
      [key]: mode === 'amount' ? current[key] || '' : '',
    })
  }

  const getRowOfficeRateTotal = (row) => {
    const breakdownTotal = [
      row.visa_charge,
      row.fla_charge,
      row.vfs_charge,
      row.ticket_charge,
      row.svp_charge,
      row.qvc_charge,
      row.service_charge,
      row.additional_charge,
    ].reduce((sum, value) => sum + Number(value || 0), 0)

    if (breakdownTotal > 0) {
      return breakdownTotal
    }

    return row.office_rate ? Number(row.office_rate) : ''
  }

  const getVisibleOfficeRate = (row) => {
    const total = getRowOfficeRateTotal(row)
    return total !== '' ? total.toLocaleString() : ''
  }

  const visibleOfficeRate = getVisibleOfficeRate(form.trade_rows[0] || defaultTradeRow)

  const computeTotalDemand = (tradeRows) => {
    const total = tradeRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
    return total > 0 ? String(total) : ''
  }

  const updateTradeRow = (index, updates) => {
    setForm((prev) => {
      const trade_rows = prev.trade_rows.map((row, i) => (i === index ? { ...row, ...updates } : row))
      return {
        ...prev,
        trade_rows,
        total_demand: computeTotalDemand(trade_rows),
      }
    })
  }

  const addTradeRow = () => {
    setForm((prev) => ({
      ...prev,
      trade_rows: [...prev.trade_rows, createTradeRow()],
    }))
    setShowTradeTable(true)
  }

  const removeTradeRow = (index) => {
    setForm((prev) => {
      const trade_rows = prev.trade_rows.filter((_, i) => i !== index)
      return {
        ...prev,
        trade_rows,
        total_demand: computeTotalDemand(trade_rows),
      }
    })
  }

  const toggleRowDetails = (index) => {
    setForm((prev) => ({
      ...prev,
      trade_rows: prev.trade_rows.map((row, i) => ({
        ...row,
        showDetails: i === index ? !row.showDetails : false,
      })),
    }))
  }

  const handleSaveOfficeRateDetails = (index) => {
    const row = form.trade_rows[index]
    if (!row) return

    const total = getRowOfficeRateTotal(row)
    if (total !== '' && total !== Number(row.office_rate || 0)) {
      updateTradeRow(index, { office_rate: String(total) })
    }
    updateTradeRow(index, { showDetails: false })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!form.project_name.trim()) {
      setError('Project name is required')
      return
    }

    if (!form.agency_id) {
      setError('Client selection is required')
      return
    }

    const createPayload = (row) => ({
      project_name: form.project_name.trim(),
      agency_id: Number(form.agency_id),
      agency_name: selectedAgency?.company_name || '',
      role_name: form.role_name.trim(),
      country: form.country || null,
      total_demand: form.total_demand ? Number(form.total_demand) : null,
      trade: row.trade.trim(),
      number_of_requirements: row.quantity ? Number(row.quantity) : null,
      salary_per_trade: row.salary ? Number(row.salary) : null,
      food_per_trade: row.food ? Number(row.food) : null,
      allowance_per_trade: row.allowance ? Number(row.allowance) : null,
      project_reference_code: form.project_reference_code.trim(),
      office_rate_per_trade: row.office_rate ? Number(row.office_rate) : null,
      visa_charge: normalizeCharge(row.visa_charge, row.visa_charge_provided),
      fla_charge: normalizeCharge(row.fla_charge, row.fla_charge_provided),
      vfs_charge: normalizeCharge(row.vfs_charge, row.vfs_charge_provided),
      ticket_charge: normalizeCharge(row.ticket_charge, row.ticket_charge_provided),
      svp_charge: normalizeCharge(row.svp_charge, row.svp_charge_provided),
      qvc_charge: normalizeCharge(row.qvc_charge, row.qvc_charge_provided),
      service_charge: normalizeCharge(row.service_charge, row.service_charge_provided),
      additional_charge: normalizeCharge(row.additional_charge, row.additional_charge_provided),
      bd: selectedBd?.reference_name || null,
      note: row.remark.trim() || form.note.trim(),
      is_active: form.is_active,
    })

    try {
      if (editingId) {
        const firstRow = form.trade_rows[0] || defaultTradeRow
        const response = await api.put(`/project-settings/${editingId}`, createPayload(firstRow))
        const updated = response?.data?.data
        setProjects((prev) => prev.map((project) => (project.id === editingId ? updated : project)))
        setSuccess('Project mapping updated successfully')
      } else {
        const confirmed = window.confirm('Are you sure you want to create this record?')
        if (!confirmed) {
          setFormLoading(false)
          return
        }

        const createdRows = []

        for (const row of form.trade_rows) {
          if (!row.trade.trim() && !row.quantity && !row.salary && !row.office_rate && !row.remark) {
            continue
          }

          const response = await api.post('/project-settings', createPayload(row))
          if (response?.data?.data) {
            createdRows.push(response.data.data)
          }
        }

        if (createdRows.length > 0) {
          setProjects((prev) => [...createdRows, ...prev])
          setSuccess('Project mapping created successfully')
        } else {
          setError('Please add at least one trade row before saving.')
          return
        }
      }

      await loadProjects()
      resetForm()
      setShowForm(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save project mapping')
    }
  }

  const handleEdit = (project) => {
    const matchedAgency = agencies.find(
      (agency) => String(agency.id) === String(project.agency_id)
    )

    const matchedBd = bdSources.find((source) => source.reference_name === project.bd)

    setForm({
      project_name: project.project_name || '',
      agency_id: project.agency_id || matchedAgency?.id || '',
      role_name: project.role_name || '',
      project_reference_code: project.project_reference_code || '',
      country: project.country || matchedAgency?.country || '',
      total_demand: project.total_demand != null ? String(project.total_demand) : '',
      bd: matchedBd?.id ? String(matchedBd.id) : '',
      note: project.note || '',
      is_active: project.is_active ?? true,
      trade_rows: [
        {
          ...createTradeRow(),
          trade: project.trade || '',
          quantity: project.number_of_requirements ?? '',
          salary: project.salary_per_trade ? String(project.salary_per_trade) : '',
          office_rate: project.office_rate_per_trade ? String(project.office_rate_per_trade) : '',
          visa_charge: project.visa_charge != null ? String(project.visa_charge) : '',
          visa_charge_provided: project.visa_charge == null,
          fla_charge: project.fla_charge != null ? String(project.fla_charge) : '',
          fla_charge_provided: project.fla_charge == null,
          vfs_charge: project.vfs_charge != null ? String(project.vfs_charge) : '',
          vfs_charge_provided: project.vfs_charge == null,
          ticket_charge: project.ticket_charge != null ? String(project.ticket_charge) : '',
          ticket_charge_provided: project.ticket_charge == null,
          svp_charge: project.svp_charge != null ? String(project.svp_charge) : '',
          svp_charge_provided: project.svp_charge == null,
          qvc_charge: project.qvc_charge != null ? String(project.qvc_charge) : '',
          qvc_charge_provided: project.qvc_charge == null,
          service_charge: project.service_charge != null ? String(project.service_charge) : '',
          service_charge_provided: project.service_charge == null,
          additional_charge: project.additional_charge != null ? String(project.additional_charge) : '',
          additional_charge_provided: project.additional_charge == null,
          remark: project.note || '',
          showDetails: false,
        },
      ],
    })
    setEditingId(project.id)
    setShowForm(true)
  }

  const handleDelete = async (projectId) => {
    if (!window.confirm('Delete this project mapping?')) return

    try {
      await api.delete(`/project-settings/${projectId}`)
      setProjects((prev) => prev.filter((project) => project.id !== projectId))
      setSuccess('Project mapping deleted successfully')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete project mapping')
    }
  }

  const toggleProjectStatus = async (project) => {
    clearMessages()

    try {
      const payload = {
        project_name: project.project_name,
        agency_name: project.agency_name,
        role_name: project.role_name,
        project_reference_code: project.project_reference_code,
        country: project.country || null,
        bd: project.bd,
        note: project.note,
        is_active: !project.is_active,
      }

      const response = await api.put(`/project-settings/${project.id}`, payload)
      const updated = response?.data?.data
      if (updated) {
        setProjects((prev) => prev.map((item) => (item.id === project.id ? updated : item)))
      }
      setSuccess(
        updated?.is_active ? 'Project mapping activated' : 'Project mapping deactivated'
      )
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update project status')
    }
  }

  return (
    <SidebarLayout
      title="Project Settings"
      headerExtra={<button style={styles.addBtn} onClick={() => { resetForm(); setShowForm(true) }}>+ Add Project</button>}
    >
      <div style={styles.shell} className="reveal-up">
        <div style={styles.hero}>
          <div>
            <div style={styles.kicker}>Settings</div>
            <h2 style={styles.heroTitle}>Client to project mapping</h2>
            <p style={styles.heroText}>Admin can link a client company with a project name such as Project 1.</p>
          </div>
          <div style={styles.heroMeta}>
            <div style={styles.metaCard}>
              <div style={styles.metaValue}>{projects.length}</div>
              <div style={styles.metaLabel}>Project entries</div>
            </div>
          </div>
        </div>

        {error && <div style={styles.error}>{error}<button style={styles.closeBtn} onClick={() => setError('')}>✕</button></div>}
        {success && <div style={styles.success}>{success}<button style={styles.closeBtn} onClick={() => setSuccess('')}>✕</button></div>}

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>{editingId ? 'Edit Project Entry' : 'Add Project Entry'}</h3>
              <p style={styles.panelText}>Choose client, then assign a project label.</p>
            </div>
          </div>

          {showForm ? (
            <form onSubmit={handleSubmit}>
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Project Name *</label>
                  <input
                    style={styles.input}
                    value={form.project_name}
                    onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                    placeholder="e.g. Project 1"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Client / Company *</label>
                  <select
                    style={styles.input}
                    value={form.agency_id}
                    onChange={(e) => handleAgencyChange(e.target.value)}
                  >
                    <option value="">Select client</option>
                    {agencies.map((agency) => (
                      <option key={agency.id} value={agency.id}>{agency.company_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Agency Name</label>
                  <input
                    readOnly
                    style={{ ...styles.input, background: '#f8fafc', cursor: 'not-allowed' }}
                    value={selectedAgency?.company_name || ''}
                    placeholder="Selected agency name"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Project Reference Number</label>
                  <input
                    style={styles.input}
                    value={form.project_reference_code}
                    onChange={(e) => setForm({ ...form, project_reference_code: e.target.value })}
                    placeholder="Reference number"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Status</label>
                  <button
                    type="button"
                    style={form.is_active ? styles.activeStatusBtn : styles.inactiveStatusBtn}
                    onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                  >
                    {form.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Country</label>
                  <select
                    style={styles.input}
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  >
                    <option value="">Select country</option>
                    {countryOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Role Name</label>
                  <input
                    style={styles.input}
                    value={form.role_name}
                    onChange={(e) => setForm({ ...form, role_name: e.target.value })}
                    placeholder="e.g. Labour, MA, Fitter"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Total Demand</label>
                  <input
                    style={{ ...styles.input, background: '#f8fafc', cursor: 'not-allowed' }}
                    type="number"
                    min="0"
                    value={form.total_demand}
                    readOnly
                    placeholder="Auto-calculated from quantities"
                  />
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>BD</label>
                  <select
                    style={styles.input}
                    value={form.bd}
                    onChange={(e) => setForm({ ...form, bd: e.target.value })}
                  >
                    <option value="">Select BD source</option>
                    {bdSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.reference_name}{source.source_company ? ` — ${source.source_company}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Office Rate</label>
                  <input
                    style={{ ...styles.input, background: '#f8fafc', cursor: 'not-allowed' }}
                    readOnly
                    value={visibleOfficeRate}
                    placeholder="Calculated total"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    style={styles.toggleBtn}
                    onClick={() => setShowTradeTable((prev) => !prev)}
                  >
                    {showTradeTable ? 'Hide trade details' : 'Add Trade'}
                  </button>
                </div>
              </div>

              {showTradeTable && (
                <div style={styles.tableWrapper}>
                  <div style={styles.detailNote}>Enter trade quantity, office rate, and remarks for this project. Use Add on office rate to open the breakdown fields for each row.</div>
                  <table style={styles.tradeTable}>
                    <thead>
                      <tr>
                        <th style={styles.tradeTh}>SN</th>
                        <th style={styles.tradeTh}>Trade</th>
                        <th style={styles.tradeTh}>Quantity</th>
                        <th style={styles.tradeTh}>Salary</th>
                        <th style={styles.tradeTh}>Office Rate</th>
                        <th style={styles.tradeTh}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.trade_rows.map((row, index) => (
                        <tr key={row.id}>
                          <td style={styles.tradeTd}>{index + 1}</td>
                          <td style={styles.tradeTd}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <input
                                style={styles.tableInput}
                                value={row.trade}
                                onChange={(e) => updateTradeRow(index, { trade: e.target.value })}
                                placeholder="Trade"
                              />
                              {index === form.trade_rows.length - 1 && (
                                <button type="button" style={styles.inlineAddBtn} onClick={addTradeRow}>
                                  Add
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={styles.tradeTd}>
                            <input
                              style={styles.tableInput}
                              type="number"
                              min="0"
                              value={row.quantity}
                              onChange={(e) => updateTradeRow(index, { quantity: e.target.value })}
                              placeholder="Qty"
                            />
                          </td>
                          <td style={styles.tradeTd}>
                            <input
                              style={styles.tableInput}
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.salary}
                              onChange={(e) => updateTradeRow(index, { salary: e.target.value })}
                              placeholder="Salary"
                            />
                          </td>
                          <td style={styles.tradeTd}>
                            <div style={styles.inlineRateCell}>
                              <input
                                style={styles.tableInput}
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.office_rate}
                                onChange={(e) => updateTradeRow(index, { office_rate: e.target.value })}
                                placeholder="Office Rate"
                              />
                              <button
                                type="button"
                                style={styles.inlineAddBtn}
                                onClick={() => toggleRowDetails(index)}
                              >
                                {row.showDetails ? 'Hide' : 'Add'}
                              </button>
                            </div>
                          </td>
                          <td style={styles.tradeTd}>
                            <input
                              style={styles.tableInput}
                              value={row.remark}
                              onChange={(e) => updateTradeRow(index, { remark: e.target.value })}
                              placeholder="Remarks"
                            />
                            {form.trade_rows.length > 1 && (
                              <button
                                type="button"
                                style={{ ...styles.secondaryBtn, marginTop: 8 }}
                                onClick={() => removeTradeRow(index)}
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {form.trade_rows.map((row, index) => row.showDetails && (
                    <div key={`details-${row.id}`} style={styles.detailsBlock}>
                      <div style={styles.detailNote}>Office rate breakdown for row {index + 1}</div>
                      <div style={styles.detailHint}>Choose whether the company provides the charge or enter an amount.</div>
                      <div style={styles.formGrid}>
                        {breakdownFields.map((field) => {
                          const providedKey = `${field.key}_provided`
                          const notApplicableKey = `${field.key}_not_applicable`
                          const provided = row[providedKey]
                          const notApplicable = row[notApplicableKey]
                          const modeValue = provided ? 'provided' : notApplicable ? 'not_applicable' : 'amount'

                          return (
                            <div key={field.key} style={styles.field}>
                              <div style={styles.fieldHeader}>
                                <label style={styles.label}>{field.label}</label>
                                <select
                                  style={styles.modeSelect}
                                  value={modeValue}
                                  onChange={(e) => handleChargeModeChange(index, field.key, e.target.value)}
                                >
                                  <option value="provided">Company provided</option>
                                  <option value="amount">Amount</option>
                                  <option value="not_applicable">Not applicable</option>
                                </select>
                              </div>
                              <input
                                style={styles.input}
                                type="number"
                                min="0"
                                step="0.01"
                                value={row[field.key]}
                                onChange={(e) => updateTradeRow(index, { [field.key]: e.target.value })}
                                disabled={provided || notApplicable}
                                placeholder={provided ? 'Company provides this amount' : notApplicable ? 'Not applicable' : 'Enter amount'}
                              />
                            </div>
                          )
                        })}
                      </div>

                      <div style={styles.formActions}>
                        <button type="button" style={styles.primaryBtn} onClick={() => handleSaveOfficeRateDetails(index)}>
                          Save office rate details
                        </button>
                        <button type="button" style={styles.secondaryBtn} onClick={() => toggleRowDetails(index)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Note</label>
                  <input
                    style={styles.input}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Optional detail"
                  />
                </div>
              </div>

              <div style={styles.formActions}>
                <button type="submit" style={styles.primaryBtn}>{editingId ? 'Update Entry' : 'Create Entry'}</button>
                <button type="button" style={styles.secondaryBtn} onClick={() => { setShowForm(false); resetForm() }}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyTitle}>No form open</div>
              <p style={styles.emptyText}>Use Add Project to map a company to a project.</p>
            </div>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Saved Project Mappings</h3>
              <p style={styles.panelText}>Admin-defined mapping of client and project.</p>
            </div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading project mappings...</div>
          ) : projects.length === 0 ? (
            <div style={styles.emptyState}>No project mappings saved yet.</div>
          ) : (
            <>
            <div style={styles.searchRow}>
              <input
                type="search"
                style={styles.input}
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search project name, candidate name, passport number"
              />
              <button type="button" style={styles.columnsBtn} onClick={() => setShowColumnManager((prev) => !prev)}>
                {showColumnManager ? 'Close Columns' : 'Columns'}
              </button>
              <span style={styles.searchMeta}>{groupedProjects.length} projects, {filteredProjects.length} trades</span>
            </div>
            {showColumnManager && (
              <div style={styles.columnManager}>
                <div style={styles.columnManagerTitle}>Manage Table Columns</div>
                <div style={styles.columnManagerSubTitle}>Hide/unhide columns and change order.</div>
                <div style={styles.columnList}>
                  {columnOrder.map((label, index) => {
                    const isHidden = isColumnHidden(label)
                    return (
                      <div key={label} style={styles.columnItem}>
                        <label style={styles.columnCheckboxLabel}>
                          <input type="checkbox" checked={!isHidden} onChange={() => toggleColumnVisibility(label)} />
                          <span>{label}</span>
                        </label>
                        <div style={styles.columnItemActions}>
                          <button type="button" style={styles.columnActionBtn} disabled={index === 0} onClick={() => moveColumn(label, columnOrder[index - 1])}>
                            Up
                          </button>
                          <button type="button" style={styles.columnActionBtn} disabled={index === columnOrder.length - 1} onClick={() => moveColumn(label, columnOrder[index + 1])}>
                            Down
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div style={styles.tableWrap}>
              {hiddenColumns.length > 0 && (
                <div style={styles.hiddenBar}>
                  <span style={styles.hiddenBarLabel}>Hidden columns:</span>
                  {hiddenColumns.map((label) => (
                    <button key={label} type="button" onClick={() => toggleColumnVisibility(label)} style={styles.unhideBtn}>
                      Unhide {label}
                    </button>
                  ))}
                  <button type="button" onClick={clearHiddenColumns} style={styles.resetColumnsBtn}>
                    Reset Columns
                  </button>
                </div>
              )}
              <div style={styles.orderBar}>
                <span style={styles.orderBarLabel}>Drag column headers to reorder them.</span>
                <button type="button" onClick={resetColumnOrder} style={styles.resetColumnsBtn}>
                  Reset Order
                </button>
              </div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {visibleProjectColumns.map((label) => (
                      <th
                        key={label}
                        style={styles.thCompact}
                        draggable
                        onDragStart={(event) => handleColumnDragStart(label, event)}
                        onDragOver={handleColumnDragOver}
                        onDrop={(event) => handleColumnDrop(label, event)}
                      >
                        <div style={styles.thInner}>
                          <span>{label}</span>
                          <button type="button" title={`Hide ${label}`} aria-label={`Hide ${label}`} onClick={() => toggleColumnVisibility(label)} style={styles.hideColumnBtn}>
                            ×
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedProjects.map(({ projectName, tradeRows }) => {
                    const firstProject = tradeRows[0]
                    const isExpanded = expandedProjects.has(projectName)
                    const salaryValues = tradeRows
                      .map((row) => Number(row.salary_per_trade || 0))
                      .filter((value) => value > 0)
                    const officeValues = tradeRows
                      .map((row) => Number(row.office_rate_per_trade || 0))
                      .filter((value) => value > 0)
                    const salarySummary = formatAmountSummary(salaryValues)
                    const officeSummary = formatAmountSummary(officeValues)
                    return (
                      <Fragment key={projectName}>
                        <tr style={styles.tr}>
                          {visibleProjectColumns.map((label) => {
                            if (label === 'Project') {
                              return (
                                <td key={label} style={styles.td}>
                                  <strong>{projectName}</strong>
                                  <button type="button" style={styles.expandBtn} onClick={() => toggleProjectExpanded(projectName)}>
                                    {isExpanded ? 'Hide trade details' : `Show ${tradeRows.length} trade${tradeRows.length === 1 ? '' : 's'}`}
                                  </button>
                                </td>
                              )
                            }

                            if (label === 'Client') {
                              return <td key={label} style={styles.td}>{firstProject.agency?.company_name || firstProject.agency_name || '-'}</td>
                            }

                            if (label === 'Country') {
                              return <td key={label} style={styles.td}>{firstProject.country || '-'}</td>
                            }

                            if (label === 'Trade') {
                              return <td key={label} style={styles.td}><span style={styles.tradeCount}>{tradeRows.length} trade{tradeRows.length === 1 ? '' : 's'}</span></td>
                            }

                            if (label === 'Total Demand') {
                              const demandValue = firstProject.total_demand != null && firstProject.total_demand !== ''
                                ? firstProject.total_demand
                                : tradeRows.reduce((sum, row) => sum + (Number(row.number_of_requirements) || 0), 0)

                              return <td key={label} style={styles.td}>{demandValue || '-'}</td>
                            }

                            if (label === 'Salary') {
                              return <td key={label} style={styles.td}>{salarySummary}</td>
                            }

                            if (label === 'Office') {
                              return <td key={label} style={styles.td}>{officeSummary}</td>
                            }

                            if (label === 'Ref') {
                              return <td key={label} style={styles.td}>{firstProject.project_reference_code || '-'}</td>
                            }

                            if (label === 'BD') {
                              return <td key={label} style={styles.td}>{firstProject.bd || '-'}</td>
                            }

                            if (label === 'Status') {
                              return (
                                <td key={label} style={styles.td}>
                                  <span style={firstProject.is_active ? styles.activeBadge : styles.inactiveBadge}>
                                    {firstProject.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                              )
                            }

                            if (label === 'Note') {
                              return <td key={label} style={styles.td}>{firstProject.note || '-'}</td>
                            }

                            return null
                          })}
                        </tr>
                        {isExpanded && (
                          <tr key={`${projectName}-details`}>
                            <td colSpan={Math.max(visibleProjectColumns.length, 1)} style={styles.tradeDetailsCell}>
                              <div style={styles.tradeDetailsTitle}>Trade details for {projectName}</div>
                              <div style={styles.tradeTableWrap}>
                                <table style={styles.tradeTable}>
                                  <thead>
                                    <tr>
                                      <th style={styles.tradeTh}>Trade</th>
                                      <th style={styles.tradeTh}>Requirements</th>
                                      <th style={styles.tradeTh}>Salary</th>
                                      <th style={styles.tradeTh}>Office Amount</th>
                                      <th style={styles.tradeTh}>Charges</th>
                                      <th style={styles.tradeTh}>Note</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tradeRows.map((project) => {
                                      const charges = [project.visa_charge, project.fla_charge, project.vfs_charge, project.ticket_charge, project.svp_charge, project.qvc_charge, project.service_charge, project.additional_charge]
                                        .reduce((sum, value) => sum + Number(value || 0), 0)
                                      return (
                                        <tr key={project.id}>
                                          <td style={styles.tradeTd}><strong>{project.trade || '-'}</strong></td>
                                          <td style={styles.tradeTd}>{project.number_of_requirements || '-'}</td>
                                          <td style={styles.tradeTd}>{project.salary_per_trade ? Number(project.salary_per_trade).toLocaleString() : '-'}</td>
                                          <td style={styles.tradeTd}>{project.office_rate_per_trade ? Number(project.office_rate_per_trade).toLocaleString() : '-'}</td>
                                          <td style={styles.tradeTd}>{charges ? charges.toLocaleString() : 'Provided'}</td>
                                          <td style={styles.tradeTd}>{project.note || project.remark || '-'}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filteredProjects.length === 0 && <div style={styles.emptyState}>No project mappings match your search.</div>}
            </>
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
  searchRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  searchMeta: { color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' },
  expandBtn: { display: 'block', marginTop: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 7, padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  columnsBtn: { padding: '8px 14px', background: '#fff', color: '#1e3a5f', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 },
  columnManager: { marginBottom: 16, background: '#ffffff', border: '1px solid #dbe5f0', borderRadius: 10, padding: 12 },
  columnManagerTitle: { fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 4 },
  columnManagerSubTitle: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  columnList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 },
  columnItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' },
  columnCheckboxLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#0f172a', fontWeight: 700 },
  columnItemActions: { display: 'flex', gap: 6 },
  columnActionBtn: { padding: '4px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#334155', fontWeight: 700 },
  hiddenBar: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '8px 10px', background: '#f8fafc', border: '1px solid #dbe5f0', borderRadius: 8 },
  hiddenBarLabel: { fontSize: 12, fontWeight: 800, color: '#0f172a' },
  unhideBtn: { padding: '4px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 },
  resetColumnsBtn: { padding: '4px 8px', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 },
  orderBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, color: '#475569' },
  orderBarLabel: { fontWeight: 700 },
  thInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  hideColumnBtn: { border: 'none', background: 'transparent', color: '#64748b', fontSize: 15, cursor: 'pointer', lineHeight: 1 },
  tradeSummary: { display: 'grid', gap: 6 },
  actionStack: { display: 'grid', gap: 8 },
  tradeActionRow: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  tradeCount: { display: 'inline-flex', background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '5px 9px', fontSize: 12, fontWeight: 700 },
  tradeDetailsCell: { padding: 14, background: '#f8fafc', borderTop: '1px solid #dbe5f0' },
  tradeDetailsTitle: { color: '#334155', fontSize: 13, fontWeight: 800, marginBottom: 10 },
  tradeTableWrap: { overflowX: 'auto', border: '1px solid #dbe5f0', borderRadius: 10, background: '#fff' },
  tradeTable: { width: '100%', borderCollapse: 'collapse', minWidth: 760 },
  tradeTh: { textAlign: 'left', padding: '9px 10px', background: '#f1f5f9', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' },
  tradeTd: { padding: '10px', borderTop: '1px solid #e2e8f0', color: '#334155', fontSize: 12, verticalAlign: 'top' },
  panelTitle: { margin: 0, fontSize: 18, color: '#0f172a' },
  panelText: { margin: '6px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.5 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', marginBottom: 14 },
  fieldHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  modeSelect: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', outline: 'none', appearance: 'none', boxSizing: 'border-box' },
  formActions: { display: 'flex', gap: 10, marginTop: 8 },
  toggleBtn: { marginTop: 8, background: '#e2e8f0', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
  detailNote: { marginBottom: 12, color: '#475569', fontSize: 13, lineHeight: 1.5 },
  tableWrapper: { marginTop: 16, overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0', padding: 12, background: '#f8fafc' },
  tradeTable: { width: '100%', borderCollapse: 'collapse' },
  tradeTh: { padding: '10px 12px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0f172a', background: '#e2e8f0', border: '1px solid #e2e8f0' },
  tradeTd: { padding: '10px 12px', border: '1px solid #e2e8f0', verticalAlign: 'middle', position: 'relative' },
  tableInput: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' },
  inlineRateCell: { display: 'flex', flexDirection: 'column', gap: 8 },
  inlineAddBtn: { marginTop: 4, background: '#e2e8f0', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' },
  detailsBlock: { marginTop: 16, padding: 18, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16 },
  primaryBtn: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' },
  emptyState: { padding: '28px 12px', textAlign: 'center', color: '#64748b' },
  emptyTitle: { fontSize: 16, fontWeight: 800, color: '#0f172a' },
  emptyText: { margin: '8px 0 0', fontSize: 13, lineHeight: 1.6 },
  tableWrap: { overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0', minWidth: 1180 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  thCompact: { padding: '10px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 14px', fontSize: 13, color: '#334155' },
  activeStatusBtn: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
  inactiveStatusBtn: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
  activeBadge: { display: 'inline-flex', alignItems: 'center', padding: '6px 10px', background: '#dcfce7', color: '#166534', borderRadius: 9999, fontSize: 12, fontWeight: 700 },
  inactiveBadge: { display: 'inline-flex', alignItems: 'center', padding: '6px 10px', background: '#fee2e2', color: '#991b1b', borderRadius: 9999, fontSize: 12, fontWeight: 700 },
  activeActionBtn: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 8 },
  inactiveActionBtn: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 8 },
  actionBtn: { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 8 },
  deleteBtn: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
}
