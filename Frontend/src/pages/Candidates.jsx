import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { CANDIDATE_STATUSES } from '../constants/statuses'
import { fetchPassportStoreStatusTemplates, fetchStatusTemplates, STATUS_EVENT } from '../utils/statusTemplates'

const candidateColumnDefaults = ['ID', 'Name', 'Age', 'Passport', 'Passport Issue Date', 'Passport Expiry Date', 'Passport Validity Remaining', 'Passport Out Date', 'Reference Name', 'Project', 'Trade', 'Passport Store Status', 'Status', 'Active', 'Created', 'Actions']

const toStatusValue = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '_')
  .replace(/-/g, '_')
  .replace(/[^a-z0-9_]/g, '')

const toStatusLabel = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (ch) => ch.toUpperCase())

const parseTemplateStatuses = (rawTemplates) => {
  if (!Array.isArray(rawTemplates)) return []
  const values = rawTemplates
    .map((row) => toStatusValue(typeof row === 'string' ? row : row?.label))
    .filter(Boolean)
  return Array.from(new Set(values))
}

const calculateAge = (dateValue) => {
  if (!dateValue) return ''
  const birthDate = new Date(dateValue)
  if (Number.isNaN(birthDate.getTime())) return ''

  const today = new Date()
  let years = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    years -= 1
  }

  return years >= 0 ? String(years) : ''
}

const formatDateInputValue = (dateValue, offsetDays = 0) => {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

const calculatePassportRenewalDay = (expiryDate) => formatDateInputValue(expiryDate, -30)

const calculatePassportExpiryRemaining = (expiryDate) => {
  if (!expiryDate) return ''
  const expiry = new Date(expiryDate)
  if (Number.isNaN(expiry.getTime())) return ''

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const expiryDateOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate())
  if (expiryDateOnly < startOfToday) {
    return 'Expired'
  }

  let years = expiryDateOnly.getFullYear() - startOfToday.getFullYear()
  let months = expiryDateOnly.getMonth() - startOfToday.getMonth()
  const days = expiryDateOnly.getDate() - startOfToday.getDate()

  if (days < 0) {
    months -= 1
  }

  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts = []
  if (years > 0) {
    parts.push(`${years} year${years === 1 ? '' : 's'}`)
  }
  if (months > 0) {
    parts.push(`${months} month${months === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) {
    return 'Less than 1 month'
  }

  return parts.join(' ')
}

const defaultForm = {
  full_name: '',
  email: '',
  phone: '',
  passport_number: '',
  date_of_birth: '',
  passport_issue_date: '',
  passport_expiry_date: '',
  gender: '',
  nationality: '',
  status: '',
  passport_store_status: '',
  passport_store_out_by: '',
  source: '',
  address: '',
  notes: '',
  project_id: '',
  project_trade: '',
}

const PASSPORT_CACHE_KEY = 'mopl.candidate.passport-cache.v1'

const readPassportCache = () => {
  try {
    const raw = localStorage.getItem(PASSPORT_CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writePassportCache = (cache) => {
  try {
    localStorage.setItem(PASSPORT_CACHE_KEY, JSON.stringify(cache || {}))
  } catch {
    // Ignore storage failures.
  }
}

const pickPassportFields = (row) => ({
  passport_issue_date: row?.passport_issue_date || '',
  passport_expiry_date: row?.passport_expiry_date || '',
  passport_renewal_day: row?.passport_renewal_day || '',
})

const mergePassportFallback = (serverRow, localRow, cachedRow) => ({
  ...serverRow,
  passport_issue_date: serverRow?.passport_issue_date || localRow?.passport_issue_date || cachedRow?.passport_issue_date || '',
  passport_expiry_date: serverRow?.passport_expiry_date || localRow?.passport_expiry_date || cachedRow?.passport_expiry_date || '',
  passport_renewal_day: serverRow?.passport_renewal_day || localRow?.passport_renewal_day || cachedRow?.passport_renewal_day || '',
})

export default function Candidates() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = String(user?.role || user?.role_label || '').toLowerCase().replace(/\s+/g, '_')
  const isAdminUser = role === 'admin' || role === 'superadmin' || role === 'super_admin'
  const isCandidateOfficer = role === 'candidate_officer'
  const isFinanceOfficer = role === 'finance_officer'
  const isDocumentationUser = role === 'documentation' || role === 'documentation_head'
  const canCreateCandidate = isAdminUser || isCandidateOfficer || isFinanceOfficer || isDocumentationUser
  const canEditCandidate = isAdminUser || isCandidateOfficer || isFinanceOfficer || isDocumentationUser
  const canManageStatus = isAdminUser
  const canImportCandidates = isAdminUser

  const [candidates, setCandidates] = useState([])
  const [referenceSources, setReferenceSources] = useState([])
  const [projects, setProjects] = useState([])
  const [pagination, setPagination] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sortField, setSortField] = useState('id')
  const [sortDirection, setSortDirection] = useState('asc')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [editingId, setEditingId] = useState(null)
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [selectedProjectName, setSelectedProjectName] = useState('')
  const [statusOptions, setStatusOptions] = useState([])
  const [passportStoreLabels, setPassportStoreLabels] = useState([])
  const [latestVisaEntriesByCandidate, setLatestVisaEntriesByCandidate] = useState({})
  const [hiddenColumns, setHiddenColumns] = useState([])
  const [columnOrder, setColumnOrder] = useState(candidateColumnDefaults)
  const [viewCandidate, setViewCandidate] = useState(null)
  const [viewDocuments, setViewDocuments] = useState([])
  const [viewDocumentsLoading, setViewDocumentsLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewMimeType, setPreviewMimeType] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewingId, setPreviewingId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  const statusOptionSet = useMemo(() => new Set(statusOptions), [statusOptions])

  const statusOptionsWithCurrent = useMemo(() => {
    try {
      const normalizedOptions = Array.isArray(statusOptions) ? statusOptions : []
      const current = String(form?.status || '').trim()
      if (!current) return normalizedOptions
      // if current is not already present, include it at the front so it stays selected
      const has = normalizedOptions.some((s) => String(s) === String(current))
      return has ? normalizedOptions : [current, ...normalizedOptions]
    } catch (e) {
      return statusOptions
    }
  }, [statusOptions, form?.status])

  const load = async (p = 1) => {
    setLoading(true)
    try {
      const [candidateRes, visaRes] = await Promise.all([
        api.get('/candidates', { params: { page: p, search, status, per_page: 100 } }),
        api.get('/candidate-flown', { params: { per_page: 500 } }).catch(() => ({ data: { data: { entries: [] } } })),
      ])

      const rows = candidateRes.data.data.candidates
      setCandidates((current) => {
        const currentById = new Map(current.map((row) => [String(row.id), row]))
        const cachedById = readPassportCache()
        const merged = rows.map((row) => {
          const key = String(row.id)
          return mergePassportFallback(row, currentById.get(key), cachedById[key])
        })

        const nextCache = { ...cachedById }
        merged.forEach((row) => {
          nextCache[String(row.id)] = pickPassportFields(row)
        })
        writePassportCache(nextCache)
        return merged
      })
      setPagination(candidateRes.data.pagination)

      const visaEntries = Array.isArray(visaRes?.data?.data?.entries)
        ? visaRes.data.data.entries
        : Array.isArray(visaRes?.data?.data)
          ? visaRes.data.data
          : []

      const latestByCandidate = {}
      visaEntries.forEach((entry) => {
        const candidateId = String(entry?.candidate_id || '')
        if (!candidateId) return
        const current = latestByCandidate[candidateId]
        const currentTs = new Date(current?.updated_at || current?.created_at || 0).getTime()
        const rowTs = new Date(entry?.updated_at || entry?.created_at || 0).getTime()
        if (!current || rowTs >= currentTs) {
          latestByCandidate[candidateId] = entry
        }
      })
      setLatestVisaEntriesByCandidate(latestByCandidate)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load candidates')
    } finally {
      setLoading(false)
    }
  }

  const loadReferenceSources = async () => {
    try {
      const response = await api.get('/reference-sources')
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []

      // Keep the latest list cached for any legacy consumers still reading localStorage.
      localStorage.setItem('mopl.reference-sources', JSON.stringify(rows))
      setReferenceSources(rows)
      return
    } catch {
      // Fallback for environments where reference API is temporarily unavailable.
    }

    try {
      const stored = JSON.parse(localStorage.getItem('mopl.reference-sources') || '[]')
      setReferenceSources(Array.isArray(stored) ? stored : [])
    } catch {
      setReferenceSources([])
    }
  }

  const loadProjects = async () => {
    try {
      const response = await api.get('/project-settings')
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      setProjects(rows)
    } catch {
      // Silently fail if projects API is unavailable
      setProjects([])
    }
  }

  const loadStatusOptions = async () => {
    try {
      const [parsed, passportRows] = await Promise.all([
        fetchStatusTemplates(),
        fetchPassportStoreStatusTemplates(),
      ])

      const templateStatuses = parseTemplateStatuses(parsed)
      const labels = Array.isArray(passportRows)
        ? passportRows.map((row) => String(row?.label || '')).filter(Boolean)
        : []

      setPassportStoreLabels(labels)
      // Exclude the 'registered' status from the dropdown per request
      const candidates = templateStatuses.length > 0 ? templateStatuses : CANDIDATE_STATUSES
      setStatusOptions(candidates)
    } catch {
      setPassportStoreLabels([])
      setStatusOptions(CANDIDATE_STATUSES)
    }
  }

  const projectGroups = useMemo(() => {
    const groups = new Map()
    projects.forEach((project) => {
      const name = String(project.project_name || '').trim()
      if (!name) return
      if (!groups.has(name)) groups.set(name, [])
      groups.get(name).push(project)
    })
    return Array.from(groups.entries()).map(([name, tradeRows]) => ({ name, tradeRows }))
  }, [projects])

  const selectedProjectTrades = useMemo(
    () => projectGroups.find((group) => group.name === selectedProjectName)?.tradeRows || [],
    [projectGroups, selectedProjectName]
  )

  useEffect(() => {
    load(page)
    void loadReferenceSources()
    void loadProjects()
  }, [page, status])

  useEffect(() => {
    const refreshFromServer = () => {
      void load(page)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshFromServer()
      }
    }

    window.addEventListener('focus', refreshFromServer)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', refreshFromServer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [page, search, status])

  useEffect(() => {
    void loadStatusOptions()
    const handler = () => {
      void loadStatusOptions()
    }
    window.addEventListener(STATUS_EVENT, handler)
    return () => window.removeEventListener(STATUS_EVENT, handler)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    load(1)
  }

  const resetForm = () => {
    setForm(defaultForm)
    setEditingId(null)
    setShowForm(false)
    setSelectedProjectName('')
  }

  const clearMessages = () => {
    setError('')
    setInfo('')
  }

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault()
    if (!canCreateCandidate && !editingId) {
      setError('You do not have permission to create candidates')
      return
    }

    if (editingId && !canEditCandidate) {
      setError('You do not have permission to update candidates')
      return
    }

    if (!form.project_id) {
      setError('Trade is required')
      return
    }

    if (!String(form.passport_store_status || '').trim()) {
      setError('Passport Store Status is required')
      return
    }

    const passportOutSelected = String(form.passport_store_status || '')
      .toLowerCase()
      .includes('passport out')

    if (passportOutSelected && !String(form.passport_store_out_by || '').trim()) {
      setError('Passport Out name is required when Original Passport Out is selected')
      return
    }

    // Ask for confirmation before creating a new candidate
    if (!editingId) {
      const confirmed = window.confirm(`Are you sure you want to create candidate ${form.full_name || ''}?`)
      if (!confirmed) return
    }

    setFormLoading(true)
    clearMessages()

    try {
      const payload = { ...form }
      if (!payload.status) {
        delete payload.status
      }
      if (!payload.passport_store_status) {
        delete payload.passport_store_status
      }
      if (!payload.passport_store_out_by) {
        delete payload.passport_store_out_by
      }

      if (editingId) {
        const response = await api.put(`/candidates/${editingId}`, payload)
        const updatedFromApi = response?.data?.data?.candidate || { id: editingId }
        const updatedCandidate = {
          ...updatedFromApi,
          ...payload,
          id: updatedFromApi.id || editingId,
          project: updatedFromApi.project || candidates.find((candidate) => String(candidate.id) === String(editingId))?.project,
        }
        setCandidates((current) => current.map((candidate) => (
          String(candidate.id) === String(updatedCandidate.id)
            ? { ...candidate, ...updatedCandidate }
            : candidate
        )))
        {
          const cache = readPassportCache()
          cache[String(updatedCandidate.id)] = pickPassportFields(updatedCandidate)
          writePassportCache(cache)
        }
        setInfo('Candidate updated successfully')
      } else {
        const response = await api.post('/candidates', payload)
        const createdFromApi = response?.data?.data?.candidate || { id: Date.now() }
        const createdCandidate = {
          ...createdFromApi,
          ...payload,
          id: createdFromApi.id || Date.now(),
        }
        setCandidates((current) => [createdCandidate, ...current])
        {
          const cache = readPassportCache()
          cache[String(createdCandidate.id)] = pickPassportFields(createdCandidate)
          writePassportCache(cache)
        }
        setInfo('Candidate created successfully')
      }
      resetForm()
    } catch (e) {
      const apiErrors = e.response?.data?.errors
      const passportError = Array.isArray(apiErrors?.passport_number) ? apiErrors.passport_number[0] : null
      setError(passportError || e.response?.data?.message || JSON.stringify(apiErrors) || 'Failed to save candidate')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = (candidate) => {
    if (!canEditCandidate) {
      setError('You do not have permission to edit candidate records')
      return
    }

    setEditingId(candidate.id)
    setForm({
      full_name: candidate.full_name || '',
      email: candidate.email || '',
      phone: candidate.phone || '',
      passport_number: candidate.passport_number || '',
      date_of_birth: candidate.date_of_birth || '',
      passport_issue_date: candidate.passport_issue_date || '',
      passport_expiry_date: candidate.passport_expiry_date || '',
      gender: candidate.gender || '',
      nationality: candidate.nationality || '',
      status: statusOptionSet.has(toStatusValue(candidate.status)) ? toStatusValue(candidate.status) : '',
      passport_store_status: candidate.passport_store_status || candidate.passport_store || '',
      passport_store_out_by: candidate.passport_store_out_by || candidate.passport_store_remark || candidate.passport_store_owner || '',
      source: candidate.source || '',
      address: candidate.address || '',
      notes: candidate.notes || '',
      project_id: candidate.project_id || '',
      project_trade: candidate.project?.trade || candidate.project?.trade_name || '',
    })
    setSelectedProjectName(candidate.project?.project_name || '')
    setShowForm(true)
  }

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl('')
    setPreviewMimeType('')
    setPreviewTitle('')
    setPreviewingId(null)
  }

  const downloadBlob = (blobData, fileName) => {
    const url = URL.createObjectURL(blobData)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || 'document'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handlePreview = async (documentId, fileName) => {
    clearMessages()
    setPreviewingId(documentId)

    try {
      const response = await api.get(`/candidate-documents/${documentId}/download`, {
        responseType: 'blob',
      })

      const blobUrl = URL.createObjectURL(response.data)
      setPreviewUrl(blobUrl)
      setPreviewTitle(fileName || 'document')
      setPreviewMimeType(response.headers?.['content-type'] || '')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to preview document')
    } finally {
      setPreviewingId(null)
    }
  }

  const handleDownload = async (documentId, fileName) => {
    clearMessages()
    setDownloadingId(documentId)

    try {
      const response = await api.get(`/candidate-documents/${documentId}/download`, {
        responseType: 'blob',
      })
      downloadBlob(response.data, fileName || 'document')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to download document')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleViewDocuments = async (candidate) => {
    clearMessages()
    setViewCandidate(candidate)
    setViewDocuments([])
    setViewDocumentsLoading(true)
    setPreviewUrl('')
    setPreviewMimeType('')
    setPreviewTitle('')

    try {
      const response = await api.get(`/candidates/${candidate.id}/documents`, { params: { per_page: 300 } })
      const rows = Array.isArray(response?.data?.data?.documents)
        ? response.data.data.documents
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : []
      setViewDocuments(rows)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load candidate documents')
    } finally {
      setViewDocumentsLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!isAdminUser) {
      setError('Only administrators can delete candidate records')
      return
    }

    if (!window.confirm('Delete this candidate?')) {
      return
    }

    clearMessages()
    try {
      await api.delete(`/candidates/${id}`)
      setInfo('Candidate deleted successfully')
      load(page)
    } catch (e) {
      setError(e.response?.data?.message || 'Delete failed')
    }
  }

  const toggleActive = async (candidate) => {
    if (!canEditCandidate) {
      setError('You do not have permission to activate or deactivate candidate records')
      return
    }

    clearMessages()
    try {
      await api.post(`/candidates/${candidate.id}/${candidate.is_active ? 'deactivate' : 'activate'}`)
      setInfo(`Candidate ${candidate.is_active ? 'deactivated' : 'activated'} successfully`)
      load(page)
    } catch (e) {
      setError(e.response?.data?.message || 'Status change failed')
    }
  }

  const quickStatus = async (candidate, nextStatus) => {
    if (!isAdminUser) {
      setError('Only administrators can change candidate status')
      return
    }

    if (!nextStatus) {
      return
    }

    clearMessages()
    try {
      await api.post(`/candidates/${candidate.id}/status`, { status: nextStatus })
      setInfo('Candidate status updated successfully')
      load(page)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update status')
    }
  }

  const handleExport = () => {
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    if (status) q.set('status', status)
    const query = q.toString()
    const url = `${api.defaults.baseURL}/candidates/export${query ? `?${query}` : ''}`
    window.open(url, '_blank')
  }

  const handlePassportExpiryChange = (value) => {
    setForm((current) => ({
      ...current,
      passport_expiry_date: value,
    }))
  }

  const handleSort = (columnLabel) => {
    const fieldMap = {
      'ID': 'id',
      'Name': 'name',
      'Status': 'status',
      'Active': 'active',
    }

    const nextField = fieldMap[columnLabel]
    if (!nextField) return

    if (sortField === nextField) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(nextField)
      setSortDirection(nextField === 'name' ? 'asc' : 'asc')
    }
  }

  const sortedCandidates = useMemo(() => {
    const nextRows = [...candidates]

    nextRows.sort((a, b) => {
      if (sortField === 'id') {
        return Number(a.id || 0) - Number(b.id || 0)
      }

      if (sortField === 'name') {
        const aName = String(a.full_name || '').trim().toLowerCase()
        const bName = String(b.full_name || '').trim().toLowerCase()
        return aName.localeCompare(bName)
      }

      if (sortField === 'active') {
        const aActive = a.is_active === true || a.is_active === 1 || a.is_active === '1'
        const bActive = b.is_active === true || b.is_active === 1 || b.is_active === '1'
        return Number(aActive) - Number(bActive)
      }

      if (sortField === 'status') {
        const aStatus = String(a.status || '').trim().toLowerCase()
        const bStatus = String(b.status || '').trim().toLowerCase()
        return aStatus.localeCompare(bStatus)
      }

      return 0
    })

    return sortDirection === 'asc' ? nextRows : nextRows.reverse()
  }, [candidates, sortDirection, sortField])

  const renderSortIndicator = (columnLabel) => {
    const fieldMap = {
      'ID': 'id',
      'Name': 'name',
      'Status': 'status',
      'Active': 'active',
    }
    const field = fieldMap[columnLabel]
    if (!field || sortField !== field) return '↕'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const candidateColumns = ['ID', 'Name', 'Passport', 'Passport Store Status', 'Reference Name', 'Project', 'Trade', 'Status', 'Active', 'Created', 'Actions']

  const isColumnHidden = (label) => hiddenColumns.includes(label)

  const toggleColumnVisibility = (label) => {
    setHiddenColumns((current) => (
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    ))
  }

  const clearHiddenColumns = () => setHiddenColumns([])

  const visibleCandidateColumns = columnOrder.filter((label) => !isColumnHidden(label))

  const resetColumnOrder = () => setColumnOrder(candidateColumnDefaults)

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

  const handleImport = async () => {
    if (!isAdminUser) {
      setError('Only administrators can import candidate data')
      return
    }

    if (!importFile) {
      setError('Choose a CSV file to import')
      return
    }

    clearMessages()
    setImporting(true)

    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await api.post('/candidates/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const summary = res.data?.data?.summary
      setInfo(`Import complete. Created: ${summary.created}, Updated: ${summary.updated}, Skipped: ${summary.skipped}, Errors: ${summary.errors}`)
      setImportFile(null)
      load(1)
    } catch (e) {
      setError(e.response?.data?.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const renderPreviewContent = () => {
    if (!previewUrl) return null

    if (previewMimeType.includes('pdf')) {
      return <iframe title={previewTitle} src={previewUrl} style={styles.previewFrame} />
    }

    if (previewMimeType.includes('image')) {
      return <img src={previewUrl} alt={previewTitle} style={styles.previewImage} />
    }

    if (previewMimeType.includes('msword') || previewMimeType.includes('officedocument')) {
      return (
        <div style={styles.previewFallback}>
          <p>Cannot preview this document inline.</p>
          <a href={previewUrl} target="_blank" rel="noreferrer" style={styles.previewLink}>Open in new tab</a>
        </div>
      )
    }

    return (
      <div style={styles.previewFallback}>
        <p>Preview is not available for this file type.</p>
        <a href={previewUrl} target="_blank" rel="noreferrer" style={styles.previewLink}>Open in new tab</a>
      </div>
    )
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <SidebarLayout title="Candidate Module" headerExtra={canCreateCandidate ? <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ Add Candidate</button> : null}>
      <div style={styles.container} className="reveal-up">

        {error && <div style={styles.error}>{error}<button style={styles.closeErr} onClick={() => setError('')}>✕</button></div>}
        {info && <div style={styles.info}>{info}<button style={styles.closeErrBlue} onClick={() => setInfo('')}>✕</button></div>}

        <div style={styles.toolbarTop}>
          <button style={styles.addBtn} onClick={handleExport}>Export CSV</button>
          <button style={styles.addBtn} onClick={() => load(page)}>Refresh</button>
          {canImportCandidates && (
            <>
              <input type="file" accept=".csv,text/csv" onChange={e => setImportFile(e.target.files?.[0] || null)} />
              <button style={importing ? styles.btnDisabled : styles.btn} onClick={handleImport} disabled={importing}>{importing ? 'Importing...' : 'Import CSV'}</button>
            </>
          )}
        </div>

        {showForm && canCreateCandidate && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>{editingId ? 'Edit Candidate' : 'Create Candidate'}</h3>
            <form onSubmit={handleCreateOrUpdate} style={styles.formGrid}>
              <div style={styles.field}><label style={styles.label}>Full Name *</label><input style={styles.input} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required /></div>
              <div style={styles.field}><label style={styles.label}>Email</label><input style={styles.input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div style={styles.field}><label style={styles.label}>Phone *</label><input style={styles.input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required /></div>
              <div style={styles.field}><label style={styles.label}>Passport Number *</label><input style={styles.input} value={form.passport_number} onChange={e => setForm({ ...form, passport_number: e.target.value })} required /></div>
              <div style={styles.field}><label style={styles.label}>Date of Birth *</label><input style={styles.input} type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} required disabled={Boolean(editingId)} /></div>
              <div style={styles.field}><label style={styles.label}>Age</label><input style={styles.input} value={calculateAge(form.date_of_birth)} readOnly placeholder="Auto calculated" /></div>
              <div style={styles.field}><label style={styles.label}>Gender *</label><select style={styles.input} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} required><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
              <div style={styles.field}>
                <label style={styles.label}>Nationality *</label>
                <select style={styles.input} value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} required>
                  <option value="">Select nationality</option>
                  <option value="Nepal">Nepal</option>
                  <option value="India">India</option>
                  <option value="China">China</option>
                  <option value="Bangladesh">Bangladesh</option>
                  <option value="Pakistan">Pakistan</option>
                  <option value="Srilanka">Srilanka</option>
                  <option value="Africa">Africa</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div style={styles.field}><label style={styles.label}>Status *</label><select style={styles.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="">Select status</option>{statusOptionsWithCurrent.map(s => <option key={s} value={s}>{toStatusLabel(s)}</option>)}</select></div>
              <div style={styles.passportStoreFieldRow}>
                <div style={styles.field}>
                  <label style={styles.label}>Passport Store Status *</label>
                  <select style={styles.input} value={form.passport_store_status} onChange={e => {
                    const val = e.target.value
                    const isOut = String(val || '').toLowerCase().includes('passport out')
                    setForm(current => ({
                      ...current,
                      passport_store_status: val,
                      passport_store_out_by: isOut ? current.passport_store_out_by : '',
                      passport_store_out_date: isOut && !current.passport_store_out_date ? new Date().toISOString().slice(0,10) : current.passport_store_out_date,
                    }))
                  }} required>
                    <option value="">Select passport store status</option>
                    {passportStoreLabels.map((label) => <option key={label} value={label}>{label}</option>)}
                  </select>
                </div>
                {String(form.passport_store_status || '').toLowerCase().includes('passport out') && (
                  <div style={styles.field}>
                    <label style={styles.label}>Passport taken out by name</label>
                    <input style={styles.input} value={form.passport_store_out_by} onChange={e => setForm({ ...form, passport_store_out_by: e.target.value })} placeholder="Name of person who took the passport" />
                    <div style={{ marginTop: 8 }}>
                      <label style={styles.label}>Passport Out Date</label>
                      <input style={styles.input} type="date" value={form.passport_store_out_date || ''} onChange={e => setForm({ ...form, passport_store_out_date: e.target.value })} readOnly={String(form.passport_store_status || '').toLowerCase().includes('passport out')} />
                    </div>
                  </div>
                )}
              </div>
              <div style={styles.field}><label style={styles.label}>Passport Date of Issue</label><input style={styles.input} type="date" value={form.passport_issue_date} onChange={e => setForm({ ...form, passport_issue_date: e.target.value })} /></div>
              <div style={styles.field}><label style={styles.label}>Passport Date of Expiry</label><input style={styles.input} type="date" value={form.passport_expiry_date} onChange={e => handlePassportExpiryChange(e.target.value)} /></div>
              <div style={styles.field}><label style={styles.label}>Passport Validity Remaining</label><input style={styles.input} value={calculatePassportExpiryRemaining(form.passport_expiry_date)} readOnly placeholder="Auto calculated" /></div>
              <div style={styles.field}>
                <label style={styles.label}>Reference Name *</label>
                <select style={styles.input} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} required>
                  <option value="">Select reference...</option>
                  {referenceSources.map((reference) => (
                    <option key={reference.id} value={reference.reference_name}>
                      {reference.reference_name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Project *</label>
                <select
                  style={styles.input}
                  value={selectedProjectName}
                  onChange={(e) => {
                    const projectName = e.target.value
                    setForm({
                      ...form,
                      project_id: '',
                      project_trade: '',
                    })
                    setSelectedProjectName(projectName)
                  }}
                  required
                >
                  <option value="">Select project...</option>
                  {projectGroups.map((group) => (
                    <option key={group.name} value={group.name}>
                      {group.name} - {group.tradeRows[0]?.agency_name || group.tradeRows[0]?.agency?.company_name || ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Trade *</label>
                <select
                  style={styles.input}
                  value={form.project_id}
                  onChange={(e) => {
                    const projectId = e.target.value
                    const project = selectedProjectTrades.find((item) => String(item.id) === projectId)
                    setForm({
                      ...form,
                      project_id: projectId,
                      project_trade: project?.trade || project?.trade_name || '',
                    })
                  }}
                  disabled={!selectedProjectName}
                  required
                >
                  <option value="">{selectedProjectName ? 'Select trade...' : 'Select project first'}</option>
                  {selectedProjectTrades.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.trade || project.trade_name || 'Unspecified trade'}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}><label style={styles.label}>Address *</label><input style={styles.input} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required /></div>
              <div style={{ ...styles.field, gridColumn: '1/-1' }}><label style={styles.label}>Notes *</label><textarea style={styles.input} rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} required /></div>
              <div style={styles.formActions}>
                <button type="submit" style={formLoading ? styles.btnDisabled : styles.btn} disabled={formLoading}>{formLoading ? 'Saving...' : editingId ? 'Update Candidate' : 'Create Candidate'}</button>
                <button type="button" style={styles.btnGray} onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        )}
        <div>
            <div style={styles.toolbar}>
              <form onSubmit={handleSearch} style={styles.searchRow}>
                <input style={styles.searchInput} placeholder="Search by name, email, passport..." value={search} onChange={e => setSearch(e.target.value)} />
                <button type="submit" style={styles.searchBtn}>Search</button>
              </form>
              <select style={styles.filterSelect} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
                <option value="">All Status</option>
                {statusOptions.map(s => <option key={s} value={s}>{toStatusLabel(s)}</option>)}
              </select>
            </div>

            {loading ? (
              <div style={styles.loading}>Loading candidates...</div>
            ) : (
              <div style={styles.tableWrap}>
                {hiddenColumns.length > 0 && (
                  <div style={styles.hiddenBar}>
                    <span style={styles.hiddenBarLabel}>Hidden columns:</span>
                    {hiddenColumns.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleColumnVisibility(label)}
                        style={styles.unhideBtn}
                      >
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
                    <tr style={styles.thead}>
                      {visibleCandidateColumns.map((h) => (
                        <th
                          key={h}
                          style={styles.th}
                          draggable
                          onDragStart={(event) => handleColumnDragStart(h, event)}
                          onDragOver={handleColumnDragOver}
                          onDrop={(event) => handleColumnDrop(h, event)}
                        >
                          <div style={styles.thInner}>
                            <button
                              type="button"
                              onClick={() => handleSort(h)}
                              style={styles.sortHeaderBtn}
                              aria-label={`Sort by ${h}`}
                            >
                              <span>{h}</span>
                              <span style={styles.sortIndicator}>{renderSortIndicator(h)}</span>
                            </button>
                            <button
                              type="button"
                              title={`Hide ${h}`}
                              aria-label={`Hide ${h}`}
                              onClick={() => toggleColumnVisibility(h)}
                              style={styles.hideColumnBtn}
                            >
                              ×
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCandidates.length === 0 && <tr><td colSpan={visibleCandidateColumns.length || 1} style={styles.empty}>No candidates found</td></tr>}
                    {sortedCandidates.map((c) => (
                      <tr key={c.id} style={styles.tr} onClick={() => navigate(`/candidates/${c.id}`)}>
                        {visibleCandidateColumns.map((label) => {
                          if (label === 'ID') {
                            return <td key={label} style={styles.td}>{c.id}</td>
                          }

                          if (label === 'Name') {
                            return <td key={label} style={styles.td}><strong>{c.full_name}</strong><div style={styles.meta}>{c.email || 'No email'}</div></td>
                          }

                          if (label === 'Age') {
                            return <td key={label} style={styles.td}>{calculateAge(c.date_of_birth) || '-'}</td>
                          }

                          if (label === 'Passport') {
                            return <td key={label} style={styles.td}>{c.passport_number || '-'}</td>
                          }

                          if (label === 'Passport Issue Date') {
                            return <td key={label} style={styles.td}>{c.passport_issue_date ? String(c.passport_issue_date).slice(0, 10) : '-'}</td>
                          }

                          if (label === 'Passport Expiry Date') {
                            return <td key={label} style={styles.td}>{c.passport_expiry_date ? String(c.passport_expiry_date).slice(0, 10) : '-'}</td>
                          }

                          if (label === 'Passport Validity Remaining') {
                            return <td key={label} style={styles.td}>{calculatePassportExpiryRemaining(c.passport_expiry_date) || '-'}</td>
                          }

                          if (label === 'Passport Out Date') {
                            return <td key={label} style={styles.td}>{c.passport_store_out_date ? String(c.passport_store_out_date).slice(0,10) : '-'}</td>
                          }

                          if (label === 'Passport Store Status') {
                            const visaEntry = latestVisaEntriesByCandidate[String(c.id)] || null
                            const rawChecklist = visaEntry?.manual_checklist
                            let checklist = []

                            try {
                              if (Array.isArray(rawChecklist)) {
                                checklist = rawChecklist
                              } else if (typeof rawChecklist === 'string' && rawChecklist.trim()) {
                                const parsed = JSON.parse(rawChecklist)
                                checklist = Array.isArray(parsed) ? parsed : []
                              }
                            } catch {
                              checklist = []
                            }

                            const normalizeToken = (value) => String(value || '')
                              .toLowerCase()
                              .replace(/[^a-z0-9]/g, '')

                            const normalizeStatusValue = (value) => String(value || '')
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, ' ')
                              .trim()

                            const uniquePassportStoreLabels = Array.from(
                              new Map(
                                passportStoreLabels.map((label) => {
                                  const normalized = normalizeToken(String(label || '').trim())
                                  return [normalized, String(label || '').trim()]
                                })
                              ).values()
                            )

                            const visibleEntries = []
                            const renderedTokens = new Set()

                            const renderPassportStoreBadge = (rowLabel, statusLabel, outName, isOut) => {
                              const displayText = String(rowLabel || '').trim() === String(statusLabel || '').trim()
                                ? statusLabel
                                : `${rowLabel}: ${statusLabel}`

                              return (
                                <div key={`${rowLabel}-${statusLabel}`} style={getPassportStoreBadgeStyle(statusLabel)}>
                                  <span>{displayText}</span>
                                  {isOut && outName && (
                                    <span style={{ display: 'block', marginTop: 4, color: '#334155', fontSize: 11, fontWeight: 700 }}>
                                      Passport taken out by: {outName}
                                    </span>
                                  )}
                                </div>
                              )
                            }

                            const getPassportStoreStatusType = (value) => {
                              const normalized = normalizeStatusValue(value)
                              if (/\boriginal passport out\b|\bpassport out\b|\bout\b/.test(normalized)) {
                                return 'out'
                              }
                              if (/\boriginal passport in\b|\bpassport in\b|\bin\b/.test(normalized)) {
                                return 'in'
                              }
                              return 'unknown'
                            }

                            const getPassportStoreBadgeStyle = (statusForBadge) => {
                              const type = getPassportStoreStatusType(statusForBadge)
                              if (type === 'out') return styles.passportStoreBadgeOut
                              if (type === 'in') return styles.passportStoreBadgeIn
                              return styles.passportStoreBadge
                            }

                            const candidateStatus = String(c.passport_store_status || '').trim()
                            const candidateOutBy = String(c.passport_store_out_by || '').trim()
                            const candidateStatusType = getPassportStoreStatusType(candidateStatus)

                            if (candidateStatus) {
                              const statusLabel = candidateStatusType === 'out'
                                ? 'Original Passport Out'
                                : candidateStatusType === 'in'
                                  ? 'Original Passport In'
                                  : candidateStatus

                              const matchingLabel = uniquePassportStoreLabels.find((storedLabel) => normalizeToken(storedLabel) === normalizeToken(candidateStatus))
                              const rowLabel = matchingLabel || candidateStatus
                              const normalizedRowLabel = normalizeToken(rowLabel)

                              if (!renderedTokens.has(normalizedRowLabel)) {
                                visibleEntries.push(renderPassportStoreBadge(rowLabel, statusLabel, candidateOutBy, candidateStatusType === 'out'))
                                renderedTokens.add(normalizedRowLabel)
                              }
                            }

                            uniquePassportStoreLabels.forEach((storedLabel) => {
                              const wanted = normalizeToken(storedLabel)
                              if (renderedTokens.has(wanted)) return
                              const item = checklist.find((row) => {
                                const rowLabel = normalizeToken(row?.label)
                                const rowKey = normalizeToken(row?.key)
                                return rowLabel === wanted || rowKey === wanted || rowKey.includes(wanted) || rowKey.includes(`passportstore${wanted}`)
                              })

                              if (!item) return

                              const itemStatusValue = String(item.status || item.label || '').trim()
                              const itemStatusType = getPassportStoreStatusType(itemStatusValue)
                              if (candidateStatusType === 'in' && itemStatusType === 'out') return
                              if (candidateStatusType === 'out' && itemStatusType === 'in') return

                              const normalizedStatus = String(item.status || '').trim().toLowerCase()
                              const statusLabel = itemStatusType === 'out'
                                ? 'Original Passport Out'
                                : itemStatusType === 'in'
                                  ? 'Original Passport In'
                                  : String(item.status || '').trim() || 'Registered'

                              const outName = String(item.remarks || item.passport_store_out_by || c.passport_store_out_by || '').trim()
                              const rowLabel = String(storedLabel || '').trim()

                              const normalizedRowLabel = normalizeToken(rowLabel)
                              if (renderedTokens.has(normalizedRowLabel)) return

                              visibleEntries.push(renderPassportStoreBadge(rowLabel, statusLabel, outName, itemStatusType === 'out'))
                              renderedTokens.add(normalizedRowLabel)
                            })

                            return <td key={label} style={styles.td}>{visibleEntries.length > 0 ? visibleEntries : '—'}</td>
                          }

                          if (label === 'Reference Name') {
                            return <td key={label} style={styles.td}>{c.source || '-'}</td>
                          }

                          if (label === 'Project') {
                            return <td key={label} style={styles.td}>{c.project?.project_name || '-'}</td>
                          }

                          if (label === 'Trade') {
                            return <td key={label} style={styles.td}>{c.project?.trade || c.project?.trade_name || '-'}</td>
                          }

                          if (label === 'Status') {
                            const currentStatus = String(c.status || '').trim()
                            const hasCurrentOption = statusOptions.some((s) => String(s) === currentStatus)
                            return (
                              <td key={label} style={styles.td}>
                                {canManageStatus ? (
                                  <select
                                    style={styles.statusSelect}
                                    value={currentStatus}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => quickStatus(c, e.target.value)}
                                    disabled={statusOptions.length === 0}
                                  >
                                    <option value="">{statusOptions.length === 0 ? 'No status configured' : 'Select status'}</option>
                                    {!hasCurrentOption && currentStatus && (
                                      <option key={`current-${c.id}`} value={currentStatus}>{toStatusLabel(currentStatus)}</option>
                                    )}
                                    {statusOptions.map(s => <option key={s} value={s}>{toStatusLabel(s)}</option>)}
                                  </select>
                                ) : (
                                  <span style={styles.statusBadge}>{currentStatus ? toStatusLabel(currentStatus) : '-'}</span>
                                )}
                              </td>
                            )
                          }

                          if (label === 'Active') {
                            return <td key={label} style={styles.td}><span style={c.is_active ? styles.active : styles.inactive}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                          }

                          if (label === 'Created') {
                            return <td key={label} style={styles.td}>{c.created_at?.slice(0, 10)}</td>
                          }

                          if (label === 'Actions') {
                            return (
                              <td key={label} style={styles.td}>
                                <div style={styles.actionRow} onClick={e => e.stopPropagation()}>
                                  {canEditCandidate && <button style={styles.btnMini} onClick={() => handleEdit(c)}>Edit</button>}
                                  <button style={styles.btnMini} onClick={() => void handleViewDocuments(c)}>View</button>
                                  <button style={styles.btnMiniWarn} onClick={() => {
                                    const action = c.is_active ? 'deactivate' : 'activate'
                                    if (window.confirm(`Are you sure you want to ${action} ${c.full_name}?`)) {
                                      toggleActive(c)
                                    }
                                  }}>{c.is_active ? 'Deactivate' : 'Activate'}</button>
                                  {isAdminUser && <button style={styles.btnMiniDanger} onClick={() => handleDelete(c.id)}>Delete</button>}
                                </div>
                              </td>
                            )
                          }

                          return <td key={label} style={styles.td}>-</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewCandidate && (
              <div style={styles.modalBackdrop} onClick={() => { closePreview(); setViewCandidate(null); setViewDocuments([]) }}>
                <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
                  <div style={styles.modalHeader}>
                    <div>
                      <div style={styles.modalTitle}>Uploaded Documents</div>
                      <div style={styles.modalSubtitle}>{viewCandidate.full_name || 'Candidate'} • {viewCandidate.passport_number || 'No passport'}</div>
                    </div>
                    <button type="button" style={styles.closeBtn} onClick={() => { closePreview(); setViewCandidate(null); setViewDocuments([]) }}>✕</button>
                  </div>

                  {viewDocumentsLoading ? (
                    <div style={styles.empty}>Loading documents...</div>
                  ) : viewDocuments.length === 0 ? (
                    <div style={styles.empty}>No documents uploaded for this candidate.</div>
                  ) : (
                    <>
                      <div style={styles.documentList}>
                        {viewDocuments.map((doc) => (
                          <div key={doc.id || doc.document_id || doc.original_name} style={styles.documentItem}>
                            <div style={styles.documentInfo}>
                              <div style={styles.documentName}>{doc.title || doc.original_name || doc.document_type || 'Document'}</div>
                              <div style={styles.documentMeta}>{doc.original_name && doc.title ? doc.original_name : ''}</div>
                              <div style={styles.documentMeta}>Uploaded by {doc.uploader?.full_name || doc.uploader?.name || 'Unknown'}</div>
                            </div>
                            <div style={styles.documentActions}>
                              <button style={styles.smallBtn} type="button" onClick={() => void handlePreview(doc.id, doc.original_name)} disabled={previewingId === doc.id}>
                                {previewingId === doc.id ? 'Loading…' : 'Preview'}
                              </button>
                              <button style={styles.smallBtn} type="button" onClick={() => void handleDownload(doc.id, doc.original_name)} disabled={downloadingId === doc.id}>
                                {downloadingId === doc.id ? 'Loading…' : 'Download'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {previewUrl && (
                        <section style={styles.previewPanel}>
                          <div style={styles.previewHeader}>
                            <div>
                              <h3 style={styles.panelTitle}>Preview</h3>
                              <div style={styles.meta}>{previewTitle}</div>
                            </div>
                            <button style={styles.closeBtnSmall} type="button" onClick={closePreview}>Close</button>
                          </div>
                          <div style={styles.previewContainer}>{renderPreviewContent()}</div>
                        </section>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {pagination.last_page > 1 && (
              <div style={styles.pagination}>
                <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={styles.pageInfo}>Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)</span>
                <button style={styles.pageBtn} disabled={page === pagination.last_page} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
        </div>
      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: { display: 'grid', gap: 14 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: 800, color: '#0f2a4f', margin: 0 },
  addBtn: {
    background: 'linear-gradient(135deg, #0a3772, #0f4d9d 58%, #1c6bd0)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '10px 18px',
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 12px 22px rgba(15, 77, 157, 0.24)',
  },
  info: {
    background: '#e8f1ff',
    border: '1px solid #cfe1fb',
    borderRadius: 12,
    padding: '10px 14px',
    color: '#114388',
    fontSize: 13,
    marginBottom: 10,
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 600,
  },
  error: {
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    borderRadius: 12,
    padding: '10px 14px',
    color: '#be123c',
    fontSize: 13,
    marginBottom: 10,
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 600,
  },
  closeErr: { background: 'none', border: 'none', cursor: 'pointer', color: '#be123c' },
  closeErrBlue: { background: 'none', border: 'none', cursor: 'pointer', color: '#114388' },
  toolbarTop: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid #dbe5f3',
    borderRadius: 14,
    padding: 10,
  },
  formCard: {
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid #dce5f2',
    borderRadius: 18,
    padding: 24,
    marginBottom: 14,
    boxShadow: '0 14px 24px rgba(17, 34, 64, 0.08)',
  },
  formTitle: { margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#0f2a4f' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 },
  passportStoreFieldRow: { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(260px, 1fr)', gap: 14, alignItems: 'end' },
  field: {},
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#27466f', marginBottom: 4 },
  input: {
    width: '100%',
    padding: '9px 11px',
    border: '1px solid #cfdaea',
    borderRadius: 10,
    fontSize: 13,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    color: '#173864',
    background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
  },
  formActions: { gridColumn: '1/-1', display: 'flex', gap: 10, flexWrap: 'wrap' },
  btn: {
    padding: '9px 20px',
    background: 'linear-gradient(135deg, #0a3772, #0f4d9d)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 700,
  },
  btnDisabled: { padding: '9px 20px', background: '#9aacbf', color: '#fff', border: 'none', borderRadius: 10, cursor: 'not-allowed', fontWeight: 700 },
  btnGray: { padding: '9px 20px', background: '#e8edf6', color: '#27466f', border: '1px solid #d4dfef', borderRadius: 10, cursor: 'pointer' },
  toolbar: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid #dbe5f3',
    borderRadius: 14,
    padding: 10,
  },
  searchRow: { display: 'flex', gap: 8, flex: 1, minWidth: 230 },
  searchInput: { flex: 1, padding: '9px 12px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13 },
  searchBtn: { padding: '9px 16px', background: '#1c6bd0', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 },
  filterSelect: { padding: '9px 12px', border: '1px solid #cfdaea', borderRadius: 10, fontSize: 13 },
  loading: {
    textAlign: 'center',
    color: '#526686',
    padding: 40,
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid #dbe5f3',
    borderRadius: 14,
  },
  tableWrap: {
    background: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    border: '1px solid #dbe5f3',
    boxShadow: '0 14px 22px rgba(17, 34, 64, 0.07)',
    overflow: 'hidden',
  },
  hiddenBar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    padding: '10px 12px',
    marginBottom: 12,
    borderRadius: 14,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
  },
  hiddenBarLabel: {
    color: '#1d4ed8',
    fontWeight: 800,
    fontSize: 12,
  },
  unhideBtn: {
    border: '1px solid #93c5fd',
    background: '#fff',
    color: '#1d4ed8',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  resetColumnsBtn: {
    border: '1px solid #93c5fd',
    background: 'linear-gradient(135deg, #eef2ff 0%, #dbeafe 100%)',
    color: '#1d4ed8',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  orderBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    padding: '10px 12px',
    marginBottom: 12,
    borderRadius: 14,
    background: '#f8fbff',
    border: '1px solid #dbe5f3',
  },
  orderBarLabel: {
    color: '#35557d',
    fontWeight: 800,
    fontSize: 12,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#eef4fc' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#35557d', borderBottom: '1px solid #d7e3f2', letterSpacing: '0.02em' },
  thInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sortHeaderBtn: {
    border: 'none',
    background: 'transparent',
    color: '#35557d',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.02em',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  },
  sortIndicator: { color: '#265aa7', fontSize: 11, fontWeight: 900 },
  hideColumnBtn: {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: '1px solid #bfdbfe',
    background: '#fff',
    color: '#1d4ed8',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1,
    flex: '0 0 auto',
  },
  tr: { borderBottom: '1px solid #edf3fb', cursor: 'pointer' },
  td: { padding: '12px 16px', fontSize: 13, color: '#27466f', verticalAlign: 'top' },
  passportStoreBadge: { display: 'inline-flex', alignItems: 'center', padding: '3px 9px', marginRight: 5, marginBottom: 4, borderRadius: 999, background: '#d1fae5', color: '#065f46', fontSize: 10, fontWeight: 800, border: '1px solid #86efac' },
  passportStoreBadgeIn: { display: 'inline-flex', alignItems: 'center', padding: '3px 9px', marginRight: 5, marginBottom: 4, borderRadius: 999, background: '#dcfce7', color: '#166534', fontSize: 10, fontWeight: 800, border: '1px solid #86efac' },
  passportStoreBadgeOut: { display: 'inline-flex', alignItems: 'center', padding: '3px 9px', marginRight: 5, marginBottom: 4, borderRadius: 999, background: '#fee2e2', color: '#991b1b', fontSize: 10, fontWeight: 800, border: '1px solid #fca5a5' },
  meta: { color: '#7390b5', fontSize: 11, marginTop: 2 },
  empty: { color: '#6c84a6', fontSize: 12, padding: 20, textAlign: 'center' },
  statusSelect: { border: '1px solid #c7d6ea', borderRadius: 8, padding: '4px 8px', fontSize: 12, background: '#f7faff' },
  active: { background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700 },
  inactive: { background: '#fee2e2', color: '#991b1b', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700 },
  actionRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  btnMini: { padding: '4px 8px', background: '#e8f1ff', border: '1px solid #cfe1fb', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#114388' },
  btnMiniWarn: { padding: '4px 8px', background: '#fff7e6', border: '1px solid #ffdca8', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#9a6100' },
  btnMiniDanger: { padding: '4px 8px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#be123c' },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20, flexWrap: 'wrap' },
  pageBtn: { padding: '7px 16px', background: '#ffffff', border: '1px solid #cfdaea', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#27466f', fontWeight: 600 },
  pageInfo: { fontSize: 13, color: '#5f779b', fontWeight: 600 },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(11, 30, 63, 0.54)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 },
  modalCard: { width: 'min(760px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: '#fff', borderRadius: 16, border: '1px solid #dbe5f3', boxShadow: '0 24px 60px rgba(12, 33, 72, 0.22)', padding: 18 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 800, color: '#0f2a4f' },
  modalSubtitle: { color: '#6b7b92', fontSize: 13, marginTop: 4 },
  previewPanel: { marginTop: 18, padding: 22, borderRadius: 20, border: '1px solid #e9eff7', background: '#ffffff' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 16 },
  panelTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#0f2a4f' },
  previewContainer: { minHeight: 180, borderRadius: 16, background: '#f6f8ff', padding: 12 },
  previewFrame: { width: '100%', minHeight: 320, border: 'none', borderRadius: 12 },
  previewImage: { maxWidth: '100%', borderRadius: 12 },
  previewFallback: { color: '#344054', fontSize: 14 },
  previewLink: { color: '#0c6cdb', textDecoration: 'none' },
  closeBtn: { padding: '8px 10px', borderRadius: 10, border: '1px solid #dbe5f3', background: '#eef4fc', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  closeBtnSmall: { padding: '8px 12px', borderRadius: 10, border: '1px solid #dbe5f3', background: '#eef4fc', cursor: 'pointer' },
  documentInfo: { display: 'grid', gap: 4 },
  documentActions: { display: 'flex', gap: 10, alignItems: 'center' },
  documentMeta: { color: '#6b7b92', fontSize: 12 },
  smallBtn: { padding: '8px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' },
  documentList: { display: 'grid', gap: 10 },
  documentItem: { padding: 12, borderRadius: 12, background: '#fff', border: '1px solid #dbe5f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  documentName: { color: '#0f2a4f', fontWeight: 700 },
  meta: { color: '#6b7b92', fontSize: 12 },
  refCandidateChip: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#edf4ff', border: '1px solid #cfe1fb', borderRadius: 10, padding: '6px 10px' },
  refDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cfdaea', borderRadius: 10, boxShadow: '0 10px 18px rgba(17, 34, 64, 0.12)', zIndex: 50, maxHeight: 200, overflowY: 'auto' },
  refDropdownItem: { padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderBottom: '1px solid #edf3fb' },
  refCard: { border: '1px solid #dbe5f3', borderRadius: 10, padding: 10, marginBottom: 8, background: '#f9fbff' },
  refCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  refId: { fontSize: 11, fontWeight: 700, color: '#114388', background: '#e8f1ff', padding: '2px 8px', borderRadius: 999 },
  refRow: { display: 'flex', gap: 6, fontSize: 12, marginBottom: 3 },
  refLabel: { color: '#647ea4', minWidth: 70 },
  refVal: { color: '#0f2a4f', fontWeight: 600 },
}
