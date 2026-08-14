import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

class ChecklistEntry {
  constructor({ key, label, status, type = 'received', manual = false }) {
    this.key = key
    this.label = label
    this.status = status
    this.type = type
    this.manual = manual
  }

  static createDefault(key, label) {
    return new ChecklistEntry({ key, label, status: 'not_received', type: 'received', manual: false })
  }

  static createManual(label) {
    const key = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    return new ChecklistEntry({ key, label, status: 'not_received', type: 'received', manual: true })
  }
}

const ACCEPTED_FILES = '.pdf,.jpg,.jpeg,.png,.doc,.docx'
const DEFAULT_DOCUMENTS_PER_PAGE = 8
const DEFAULT_STATUS_ITEMS = [
  { key: 'passport', label: 'Passport' },
  { key: 'photo', label: 'Photo' },
  { key: 'medical', label: 'Medical' },
  { key: 'pcc', label: 'PCC' },
  { key: 'vfs', label: 'VFS' },
  { key: 'mol', label: 'MOL' },
  { key: 'labour_card', label: 'Labour Card' },
  { key: 'visa', label: 'VISA' },
  { key: 'medical_online', label: 'Medical Online' },
  { key: 'fla', label: 'FLA' },
  { key: 'ticket', label: 'Ticket' },
  { key: 'deployment_status', label: 'Deployment Status' },
  { key: 'mofa', label: 'MOFA' },
  { key: 'biometric', label: 'Biometric' },
  { key: 'svp', label: 'SVP' },
  { key: 'qvc', label: 'QVC' },
]

export default function DocumentController() {
  const statusAutosaveTimerRef = useRef(null)
  const [candidates, setCandidates] = useState([])
  const [candidateSearch, setCandidateSearch] = useState('')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [documents, setDocuments] = useState([])
  const [visaEntries, setVisaEntries] = useState([])
  const [files, setFiles] = useState([])
  const [uploadInputKey, setUploadInputKey] = useState(0)
  const [title, setTitle] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [documentsPerPage, setDocumentsPerPage] = useState(DEFAULT_DOCUMENTS_PER_PAGE)
  const [documentSearch, setDocumentSearch] = useState('')
  const [documentTypeFilter, setDocumentTypeFilter] = useState('all')
  const [documentSort, setDocumentSort] = useState('newest')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [projects, setProjects] = useState([])
  const [projectSearch, setProjectSearch] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [showProjectPicker, setShowProjectPicker] = useState(false)

  const [loadingCandidates, setLoadingCandidates] = useState(true)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [loadingVisaStatuses, setLoadingVisaStatuses] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewDocuments, setPreviewDocuments] = useState([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewMimeType, setPreviewMimeType] = useState('')
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [batchDownloading, setBatchDownloading] = useState(false)
  const [editingDocumentId, setEditingDocumentId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [titleSavingId, setTitleSavingId] = useState(null)

  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [checklistEntries, setChecklistEntries] = useState([])
  const [newChecklistLabel, setNewChecklistLabel] = useState('')
  const [checklistDirty, setChecklistDirty] = useState(false)
  const [savingChecklist, setSavingChecklist] = useState(false)
  const [templates, setTemplates] = useState([])
  const [passportStoreLabels, setPassportStoreLabels] = useState([])
  const [passportStoreStatus, setPassportStoreStatus] = useState('registered')
  const [passportStoreOutBy, setPassportStoreOutBy] = useState('')
  const [candidatePickerId, setCandidatePickerId] = useState('')

  const { user } = useAuth()

  const clearMessages = () => {
    setError('')
    setInfo('')
  }

  const selectedCandidate = useMemo(
    () => candidates.find((item) => String(item.id) === String(selectedCandidateId)),
    [candidates, selectedCandidateId]
  )

  const filteredCandidates = useMemo(() => {
    const search = candidateSearch.trim().toLowerCase()
    if (!search) return candidates

    return candidates.filter((candidate) => {
      const fullName = (candidate.full_name || '').toLowerCase()
      const passport = (candidate.passport_number || '').toLowerCase()
      const email = (candidate.email || '').toLowerCase()
      return fullName.includes(search) || passport.includes(search) || email.includes(search)
    })
  }, [candidateSearch, candidates])

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === String(selectedProjectId)),
    [projects, selectedProjectId]
  )

  const filteredProjects = useMemo(() => {
    const search = projectSearch.trim().toLowerCase()
    if (!search) return projects

    return projects.filter((project) => {
      const name = (project.project_name || '').toLowerCase()
      const trade = (project.trade || '').toLowerCase()
      return name.includes(search) || trade.includes(search)
    })
  }, [projectSearch, projects])

  const filteredDocuments = useMemo(() => {
    const search = documentSearch.trim().toLowerCase()

    return documents.filter((doc) => {
      const typeLabel = getDocumentTypeLabel(doc).toLowerCase()
      const matchesType = documentTypeFilter === 'all' || typeLabel === documentTypeFilter
      if (!matchesType) return false

      if (!search) return true

      const titleValue = String(doc.title || '').toLowerCase()
      const fileName = String(doc.original_name || '').toLowerCase()
      const uploader = String(doc?.uploader?.full_name || doc?.uploader?.name || '').toLowerCase()
      return titleValue.includes(search) || fileName.includes(search) || uploader.includes(search)
    })
  }, [documentSearch, documentTypeFilter, documents])

  const sortedDocuments = useMemo(() => {
    const rows = [...filteredDocuments]
    rows.sort((left, right) => {
      if (documentSort === 'oldest') {
        return new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime()
      }
      if (documentSort === 'name_asc') {
        return String(left.original_name || '').localeCompare(String(right.original_name || ''))
      }
      if (documentSort === 'name_desc') {
        return String(right.original_name || '').localeCompare(String(left.original_name || ''))
      }
      if (documentSort === 'size_asc') {
        return Number(left.size_bytes || 0) - Number(right.size_bytes || 0)
      }
      if (documentSort === 'size_desc') {
        return Number(right.size_bytes || 0) - Number(left.size_bytes || 0)
      }

      return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
    })
    return rows
  }, [documentSort, filteredDocuments])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedDocuments.length / documentsPerPage)),
    [documentsPerPage, sortedDocuments.length]
  )

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * documentsPerPage
    return sortedDocuments.slice(start, start + documentsPerPage)
  }, [currentPage, documentsPerPage, sortedDocuments])

  const documentSummary = useMemo(() => {
    const summary = {
      total: documents.length,
      totalBytes: 0,
      pdf: 0,
      doc: 0,
      image: 0,
      other: 0,
    }

    documents.forEach((doc) => {
      summary.totalBytes += Number(doc.size_bytes || 0)
      const type = getDocumentTypeLabel(doc)
      if (type === 'PDF') summary.pdf += 1
      else if (type === 'DOC') summary.doc += 1
      else if (type === 'IMAGE') summary.image += 1
      else summary.other += 1
    })

    return summary
  }, [documents])

  const selectedCount = selectedDocumentIds.length

  const selectedDocuments = useMemo(
    () => documents.filter((doc) => selectedDocumentIds.includes(doc.id)),
    [documents, selectedDocumentIds]
  )

  const selectedPdfDocuments = useMemo(
    () => selectedDocuments.filter((doc) => getDocumentTypeLabel(doc) === 'PDF'),
    [selectedDocuments]
  )

  const hasSelectedPdfs = selectedPdfDocuments.length > 0

  const latestVisaEntry = useMemo(() => {
    if (!visaEntries || visaEntries.length === 0) return null
    return [...visaEntries]
      .filter(Boolean)
      .sort((left, right) => {
        return new Date(right.updated_at || right.created_at || 0).getTime()
          - new Date(left.updated_at || left.created_at || 0).getTime()
      })[0] || null
  }, [visaEntries])

  const defaultChecklistStatus = (key) => {
    if (key === 'medical_online_status' || key === 'orientation_online_status') {
      return 'not_done'
    }
    if (key === 'deployment_status') {
      return 'not_flown'
    }
    return 'not_received'
  }

  const normalizeChecklistKey = (value) => {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
  }

  const isAdminUser = useMemo(() => {
    const role = String(user?.role || user?.role_label || '').toLowerCase().replace(/\s+/g, '_')
    return role === 'admin' || role === 'superadmin' || role === 'super_admin'
  }, [user])

  const canEditChecklist = Boolean(user)

  useEffect(() => {
    const manualEntries = Array.isArray(latestVisaEntry?.manual_checklist)
      ? latestVisaEntry.manual_checklist.map((item) => new ChecklistEntry({
          key: item.key || `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          label: item.label || 'Checklist Item',
          status: item.status || 'not_received',
          manual: true,
        }))
      : []

    const byNormalized = new Map()
    manualEntries.forEach((item) => {
      byNormalized.set(normalizeChecklistKey(item.key || item.label), item)
    })

    const mergedDefaults = DEFAULT_STATUS_ITEMS.map((item) => {
      const matched = byNormalized.get(normalizeChecklistKey(item.key))
        || byNormalized.get(normalizeChecklistKey(item.label))

      return new ChecklistEntry({
        key: item.key,
        label: item.label,
        status: matched?.status || 'not_received',
        manual: true,
      })
    })

    setChecklistEntries(mergedDefaults)
    setChecklistDirty(false)
  }, [latestVisaEntry, selectedCandidateId])

  useEffect(() => {
    const STATUS_STORAGE_KEY = 'candidate_status_templates_v1'
    const LEGACY_STORAGE_KEY = 'document_checklist_templates_v1'
    const STATUS_EVENT = 'statusTemplatesUpdated'
    const loadTemplates = () => {
      try {
        const raw = localStorage.getItem(STATUS_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || '[]'
        const parsed = JSON.parse(raw)
        const rows = Array.isArray(parsed) ? parsed : []
        setTemplates(rows.map((r) => ({ key: r.key || `tmpl_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, label: r.label || r })))
      } catch (err) {
        setTemplates([])
      }

      try {
        const raw = localStorage.getItem('passport_store_status_templates_v1') || '[]'
        const parsed = JSON.parse(raw)
        const rows = Array.isArray(parsed) ? parsed : []
        setPassportStoreLabels(rows.map((r) => String(r?.label || '')).filter(Boolean))
      } catch {
        setPassportStoreLabels([])
      }
    }

    loadTemplates()

    const handler = () => loadTemplates()
    window.addEventListener(STATUS_EVENT, handler)
    return () => window.removeEventListener(STATUS_EVENT, handler)
  }, [])

  const handleChecklistChange = (key, value) => {
    setChecklistEntries((prev) => prev.map((item) => (item.key === key ? { ...item, status: value } : item)))
    setChecklistDirty(true)
  }

  const handleChecklistLabelChange = (key, value) => {
    setChecklistEntries((prev) => prev.map((item) => (item.key === key ? { ...item, label: value } : item)))
    setChecklistDirty(true)
  }

  const addChecklistEntry = () => {
    const trimmed = newChecklistLabel.trim()
    if (!trimmed) return

    setChecklistEntries((prev) => [...prev, ChecklistEntry.createManual(trimmed)])
    setNewChecklistLabel('')
    setChecklistDirty(true)
  }

  const removeChecklistEntry = (key) => {
    setChecklistEntries((prev) => prev.filter((item) => item.key !== key))
    setChecklistDirty(true)
  }

  const loadTemplatesIntoChecklist = () => {
    if (!Array.isArray(templates) || templates.length === 0) return
    const entries = templates.map((t) => new ChecklistEntry({ key: t.key || `tmpl_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, label: t.label || 'Checklist Item', status: defaultChecklistStatus(t.key), manual: true }))
    setChecklistEntries(entries)
    setChecklistDirty(true)
  }

  const addAllDefaultStatusItems = () => {
    const existingKeys = new Set(checklistEntries.map((item) => String(item.key || '').toLowerCase()))
    const existingLabels = new Set(checklistEntries.map((item) => String(item.label || '').toLowerCase().trim()))

    const missing = DEFAULT_STATUS_ITEMS.filter((item) => {
      return !existingKeys.has(item.key.toLowerCase()) && !existingLabels.has(item.label.toLowerCase())
    }).map((item) => new ChecklistEntry({
      key: item.key,
      label: item.label,
      status: 'not_received',
      manual: true,
    }))

    if (missing.length === 0) {
      setInfo('All default status items are already present')
      return
    }

    setChecklistEntries((prev) => [...prev, ...missing])
    setChecklistDirty(true)
    setInfo(`Added ${missing.length} default status item${missing.length === 1 ? '' : 's'}`)
  }

  const persistChecklist = async ({ silent = false } = {}) => {
    if (!selectedCandidate) {
      setError('Please select a candidate first')
      return false
    }

    if (!silent) {
      clearMessages()
    }

    setSavingChecklist(true)
    try {
      const passportStoreChecklist = passportStoreLabels.map((label) => {
        const normalized = String(label).trim().toLowerCase()
        const item = {
          key: `passport_store_${String(label).toLowerCase().replace(/\s+/g, '_')}`,
          label,
          status: passportStoreStatus,
          manual: true,
        }

        if (normalized.includes('original passport out') || normalized.includes('passport out')) {
          item.status = 'original_passport_out'
          if (passportStoreOutBy.trim()) {
            item.remarks = passportStoreOutBy.trim()
          }
        }

        if (normalized.includes('original passport in') || normalized.includes('passport in')) {
          item.status = 'original_passport_in'
        }

        return item
      })

      const payload = {
        candidate_id: selectedCandidate.id,
        candidate_name: selectedCandidate.full_name || '',
        passport_number: selectedCandidate.passport_number || '',
        project_id: selectedProjectId || selectedCandidate.project_id || null,
        manual_checklist: [...checklistEntries.map((item) => ({ key: item.key, label: item.label, status: item.status })), ...passportStoreChecklist],
      }

      if (latestVisaEntry?.id && Number(latestVisaEntry.id) > 0) {
        await api.put(`/candidate-flown/${latestVisaEntry.id}`, {
          manual_checklist: payload.manual_checklist,
          project_id: payload.project_id,
        })
      } else {
        await api.post('/candidate-flown', payload)
        await loadVisaStatuses(selectedCandidateId)
      }

      window.dispatchEvent(new CustomEvent('visaPipelineUpdated', {
        detail: { candidateId: selectedCandidateId },
      }))

      if (!silent) {
        setInfo('Status saved successfully')
      }
      setChecklistDirty(false)
      return true
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save status')
      return false
    } finally {
      setSavingChecklist(false)
    }
  }

  const saveChecklist = async () => {
    await persistChecklist({ silent: false })
  }

  const createChecklistEntry = async () => {
    await persistChecklist({ silent: false })
  }

  useEffect(() => {
    if (!canEditChecklist || !checklistDirty || !selectedCandidateId) {
      return
    }

    if (statusAutosaveTimerRef.current) {
      clearTimeout(statusAutosaveTimerRef.current)
    }

    statusAutosaveTimerRef.current = setTimeout(() => {
      void persistChecklist({ silent: true })
    }, 900)

    return () => {
      if (statusAutosaveTimerRef.current) {
        clearTimeout(statusAutosaveTimerRef.current)
        statusAutosaveTimerRef.current = null
      }
    }
  }, [canEditChecklist, checklistDirty, checklistEntries, selectedCandidateId, selectedProjectId, latestVisaEntry?.id])

  const downloadBlob = (blobData, fileName) => {
    const blobUrl = URL.createObjectURL(blobData)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = fileName || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
  }

  const loadCandidates = async () => {
    setLoadingCandidates(true)
    try {
      const response = await api.get('/candidates', { params: { per_page: 200 } })
      const rows = Array.isArray(response?.data?.data?.candidates) ? response.data.data.candidates : []
      setCandidates(rows)

      if (!selectedCandidateId && rows.length > 0) {
        setSelectedCandidateId(String(rows[0].id))
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load candidates')
    } finally {
      setLoadingCandidates(false)
    }
  }

  const loadProjects = async () => {
    try {
      const response = await api.get('/project-settings')
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      setProjects(rows)
    } catch {
      setProjects([])
    }
  }

  const loadDocuments = async (candidateId) => {
    if (!candidateId) {
      setDocuments([])
      return
    }

    setLoadingDocuments(true)
    try {
      const response = await api.get(`/candidates/${candidateId}/documents`)
      const rows = Array.isArray(response?.data?.data?.documents) ? response.data.data.documents : []
      setDocuments(rows)
      setCurrentPage(1)
      setSelectedDocumentIds([])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents')
      setDocuments([])
      setSelectedDocumentIds([])
    } finally {
      setLoadingDocuments(false)
    }
  }

  const loadVisaStatuses = async (candidateId) => {
    if (!candidateId) {
      setVisaEntries([])
      return
    }

    setLoadingVisaStatuses(true)
    try {
      const response = await api.get(`/candidates/${candidateId}/candidate-flown`, {
        params: { per_page: 20 },
      })
      const rows = Array.isArray(response?.data?.data?.entries)
        ? response.data.data.entries
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : []
      const normalized = rows.map((row) => ({
        ...row,
        manual_checklist: Array.isArray(row.manual_checklist)
          ? row.manual_checklist
          : typeof row.manual_checklist === 'string' && row.manual_checklist.trim()
            ? JSON.parse(row.manual_checklist)
            : [],
      }))
      setVisaEntries(normalized)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load candidate status')
      setVisaEntries([])
    } finally {
      setLoadingVisaStatuses(false)
    }
  }

  useEffect(() => {
    void loadCandidates()
    void loadProjects()
  }, [])

  useEffect(() => {
    if (selectedCandidate?.project_id) {
      setSelectedProjectId(String(selectedCandidate.project_id))
    } else {
      setSelectedProjectId('')
    }
    setProjectSearch('')
  }, [selectedCandidate])

  useEffect(() => {
    void Promise.all([loadDocuments(selectedCandidateId), loadVisaStatuses(selectedCandidateId)])
  }, [selectedCandidateId])

  const handleUpload = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!selectedCandidateId) {
      setError('Please select a candidate first')
      return
    }
    if (files.length === 0) {
      setError('Please choose at least one file to upload')
      return
    }

    setSubmitting(true)
    try {
      const titleValue = title.trim()
      const results = await Promise.allSettled(
        files.map((selectedFile) => {
          const formData = new FormData()
          formData.append('file', selectedFile)
          if (titleValue) {
            formData.append('title', files.length === 1 ? titleValue : `${titleValue} - ${selectedFile.name}`)
          }
          const projectPayload = selectedProjectId || selectedCandidate?.project_id
          if (projectPayload) {
            formData.append('project_id', String(projectPayload))
          }

          return api.post(`/candidates/${selectedCandidateId}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        })
      )

      const successCount = results.filter((item) => item.status === 'fulfilled').length
      const failedCount = results.length - successCount

      if (failedCount === 0) {
        setInfo(`Uploaded ${successCount} document${successCount === 1 ? '' : 's'} successfully`)
      } else {
        setError(`Uploaded ${successCount} document${successCount === 1 ? '' : 's'}, but ${failedCount} failed`) 
      }

      setFiles([])
      setUploadInputKey((key) => key + 1)
      setTitle('')
      await loadDocuments(selectedCandidateId)
    } catch (err) {
      const apiErrors = err.response?.data?.errors
      const firstError = apiErrors
        ? Object.values(apiErrors).flat()[0]
        : err.response?.data?.message
      setError(firstError || 'Failed to upload document')
    } finally {
      setSubmitting(false)
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
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download document')
    } finally {
      setDownloadingId(null)
    }
  }

  const loadPreviewDocument = async (doc, index) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
      setPreviewMimeType('')
      setPreviewTitle('')
    }

    try {
      const response = await api.get(`/candidate-documents/${doc.id}/download`, {
        responseType: 'blob',
      })
      const blobUrl = URL.createObjectURL(response.data)
      setPreviewUrl(blobUrl)
      setPreviewTitle(`Preview (${doc.original_name || 'document'})`)
      setPreviewMimeType(response.headers?.['content-type'] || 'application/pdf')
      setPreviewIndex(index)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load preview document')
    }
  }

  const handlePreviewDocument = async (doc) => {
    clearMessages()
    setIsPreviewing(true)

    try {
      setPreviewDocuments([doc])
      await loadPreviewDocument(doc, 0)
      setInfo(`Preview loaded for ${doc.original_name || 'document'}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to preview document')
    } finally {
      setIsPreviewing(false)
    }
  }

  const handlePreviewSelected = async () => {
    if (!hasSelectedPdfs) {
      setError('Select one or more PDF documents to preview.')
      return
    }

    clearMessages()
    setIsPreviewing(true)

    try {
      setPreviewDocuments(selectedPdfDocuments)
      const firstDoc = selectedPdfDocuments[0]
      await loadPreviewDocument(firstDoc, 0)
      setInfo(`Preview loaded for ${selectedPdfDocuments.length} selected document${selectedPdfDocuments.length > 1 ? 's' : ''}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to preview selected documents')
    } finally {
      setIsPreviewing(false)
    }
  }

  const toggleDocumentSelection = (documentId) => {
    setSelectedDocumentIds((current) => {
      if (current.includes(documentId)) {
        return current.filter((id) => id !== documentId)
      }
      return [...current, documentId]
    })
  }

  const toggleSelectAllOnPage = () => {
    const pageIds = paginatedDocuments.map((doc) => doc.id)
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedDocumentIds.includes(id))

    setSelectedDocumentIds((current) => {
      if (allSelected) {
        return current.filter((id) => !pageIds.includes(id))
      }
      return Array.from(new Set([...current, ...pageIds]))
    })
  }

  const handleBulkDelete = async () => {
    if (selectedDocumentIds.length === 0) return
    if (!window.confirm(`Delete ${selectedDocumentIds.length} selected document(s)?`)) return

    clearMessages()
    setBulkDeleting(true)
    try {
      const results = await Promise.allSettled(
        selectedDocumentIds.map((documentId) => api.delete(`/candidate-documents/${documentId}`))
      )
      const successCount = results.filter((result) => result.status === 'fulfilled').length
      const failedCount = results.length - successCount

      if (failedCount === 0) {
        setInfo(`Deleted ${successCount} document${successCount === 1 ? '' : 's'} successfully`)
      } else {
        setError(`Deleted ${successCount}, but ${failedCount} failed`)
      }

      setSelectedDocumentIds([])
      await loadDocuments(selectedCandidateId)
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk delete failed')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleBatchDownload = async () => {
    if (selectedDocumentIds.length === 0) return

    clearMessages()
    setBatchDownloading(true)
    try {
      const response = await api.post(
        '/candidate-documents/batch-download',
        { document_ids: selectedDocumentIds },
        { responseType: 'blob' }
      )

      const contentDisposition = response.headers?.['content-disposition'] || ''
      const matched = /filename="?([^\";]+)"?/i.exec(contentDisposition)
      const fileName = matched?.[1] || `candidate-documents-${Date.now()}.zip`
      downloadBlob(response.data, fileName)
      setInfo(`Downloaded ${selectedDocumentIds.length} selected document${selectedDocumentIds.length === 1 ? '' : 's'}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Batch download failed')
    } finally {
      setBatchDownloading(false)
    }
  }

  const startTitleEdit = (doc) => {
    setEditingDocumentId(doc.id)
    setEditingTitle(doc.title || '')
  }

  const cancelTitleEdit = () => {
    setEditingDocumentId(null)
    setEditingTitle('')
  }

  const saveTitleEdit = async (docId) => {
    clearMessages()
    setTitleSavingId(docId)
    try {
      await api.put(`/candidate-documents/${docId}/title`, {
        title: editingTitle.trim() || null,
      })
      setInfo('Document title updated successfully')
      cancelTitleEdit()
      await loadDocuments(selectedCandidateId)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update title')
    } finally {
      setTitleSavingId(null)
    }
  }

  const allPageSelected = paginatedDocuments.length > 0
    && paginatedDocuments.every((doc) => selectedDocumentIds.includes(doc.id))

  const handleDelete = async (documentId) => {
    if (!window.confirm('Delete this document?')) return

    clearMessages()
    try {
      await api.delete(`/candidate-documents/${documentId}`)
      setInfo('Document deleted successfully')
      await loadDocuments(selectedCandidateId)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete document')
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl('')
    setPreviewTitle('')
    setPreviewMimeType('')
    setPreviewDocuments([])
    setPreviewIndex(0)
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
        <div style={styles.previewUnsupported}>
          <p>Preview is not supported for this file type.</p>
          <a href={previewUrl} target="_blank" rel="noreferrer" style={styles.previewLink}>Open in new tab</a>
        </div>
      )
    }

    return (
      <div style={styles.previewUnsupported}>
        <p>Preview is not supported for this file type.</p>
        <a href={previewUrl} target="_blank" rel="noreferrer" style={styles.previewLink}>Open in new tab</a>
      </div>
    )
  }

  console.log('DocumentController mounted', { selectedCandidateId, loadingCandidates, loadingDocuments, loadingVisaStatuses })

  return (
    <SidebarLayout
      title="Document Controller"
      headerExtra={<button style={styles.refreshBtn} onClick={() => { void loadDocuments(selectedCandidateId) }}>Refresh</button>}
    >
      <div style={styles.container}>
        <div style={styles.debug}>Document Controller mounted</div>
        {error && <div style={styles.error}>{error}<button style={styles.closeBtn} onClick={() => setError('')}>✕</button></div>}
        {info && <div style={styles.info}>{info}<button style={styles.closeBtn} onClick={() => setInfo('')}>✕</button></div>}

        <section style={styles.panel}>
          <h3 style={styles.panelTitle}>Select Candidate</h3>
          <div style={styles.selectRow}>
            <input
              style={styles.input}
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              placeholder="Search by name, passport, email"
            />
            <select
              style={styles.input}
              value={selectedCandidateId}
              onChange={(e) => setSelectedCandidateId(e.target.value)}
              disabled={loadingCandidates}
            >
              {filteredCandidates.length === 0 && <option value="">No candidate found</option>}
              {filteredCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.full_name} ({candidate.passport_number || 'No Passport'})
                </option>
              ))}
            </select>
          </div>
          {/* Candidate quick-pick list with radio buttons for explicit confirmation */}
          {candidateSearch.trim() && filteredCandidates.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ marginBottom: 6, fontSize: 13, color: '#27466f', fontWeight: 700 }}>Pick from results</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {filteredCandidates.slice(0, 8).map((cand) => (
                  <label key={cand.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f9fc', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
                    <input type="radio" name="candidatePicker" checked={String(candidatePickerId) === String(cand.id)} onChange={() => setCandidatePickerId(String(cand.id))} />
                    <span style={{ fontSize: 13 }}>{cand.full_name} {cand.passport_number ? `(${cand.passport_number})` : ''}</span>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <button type="button" style={styles.smallBtn} onClick={() => { if (candidatePickerId) setSelectedCandidateId(candidatePickerId) }} disabled={!candidatePickerId}>Confirm candidate</button>
                <button type="button" style={{ ...styles.smallBtnDanger, marginLeft: 8 }} onClick={() => setCandidatePickerId('')}>Clear</button>
              </div>
            </div>
          )}
          {selectedCandidate && (
            <>
              <div style={styles.meta}>
                Selected: <strong>{selectedCandidate.full_name}</strong> | Passport: {selectedCandidate.passport_number || '-'}
              </div>
              <div style={styles.meta}>
                Project: <strong>{selectedProject?.project_name || 'None selected'}</strong>
                {selectedProject?.trade ? ` — ${selectedProject.trade}` : ''}
              </div>
              <div style={styles.projectPickerRow}>
                <button
                  type="button"
                  style={styles.smallBtn}
                  onClick={() => setShowProjectPicker((current) => !current)}
                >
                  {showProjectPicker ? 'Hide project selector' : 'Select project'}
                </button>
                {selectedProjectId && (
                  <button
                    type="button"
                    style={styles.smallBtnDanger}
                    onClick={() => setSelectedProjectId('')}
                  >
                    Clear project
                  </button>
                )}
              </div>
              {showProjectPicker && (
                <div style={styles.projectPicker}>
                  <input
                    style={styles.input}
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search project name or trade"
                  />
                  <select
                    style={styles.input}
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">Choose a project</option>
                    {filteredProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.project_name}{project.trade ? ` — ${project.trade}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </section>

        <section style={styles.panel}>
          <h3 style={styles.panelTitle}>Upload Document</h3>
          <form onSubmit={handleUpload} style={styles.uploadForm}>
            <input
              style={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title (optional)"
            />
            <input
              key={uploadInputKey}
              style={styles.input}
              type="file"
              accept={ACCEPTED_FILES}
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            <button type="submit" style={submitting ? styles.btnDisabled : styles.btn} disabled={submitting || !selectedCandidateId}>
              {submitting ? 'Uploading...' : 'Upload'}
            </button>
          </form>
          {files.length > 0 && <div style={styles.meta}>Selected {files.length} file{files.length > 1 ? 's' : ''}</div>}
        </section>

        <section style={styles.panel}>
          <h3 style={styles.panelTitle}>Document Checklist</h3>
          {!selectedCandidateId ? (
            <div style={styles.empty}>Select a candidate first to update document checklist status.</div>
          ) : loadingVisaStatuses ? (
            <div style={styles.empty}>Loading checklist status...</div>
          ) : (
            <>
              <div style={styles.documentChecklistGrid}>
                {checklistEntries.map((item) => (
                  <div key={item.key} style={styles.documentChecklistItem}>
                    <div style={styles.documentChecklistLabel}>{item.label}</div>
                      <select
                        style={styles.documentChecklistSelect}
                        value={item.status || (item.key === 'deployment_status' ? 'not_flown' : 'not_received')}
                        onChange={(event) => handleChecklistChange(item.key, event.target.value)}
                        disabled={!canEditChecklist || savingChecklist}
                      >
                        {item.key === 'deployment_status' ? (
                          <>
                            <option value="flown">Flown</option>
                            <option value="not_flown">Not Flown</option>
                          </>
                        ) : (
                          <>
                            <option value="received">Received</option>
                            <option value="not_received">Not received</option>
                            <option value="not_applicable">Not applicable</option>
                          </>
                        )}
                      </select>
                  </div>
                ))}
              </div>

              <div style={styles.checklistButtonRow}>
                <button
                  type="button"
                  style={savingChecklist || !checklistDirty || !canEditChecklist ? styles.pageBtnDisabled : styles.smallBtn}
                  onClick={() => void saveChecklist()}
                  disabled={savingChecklist || !checklistDirty || !canEditChecklist}
                >
                  {savingChecklist ? 'Saving...' : checklistDirty ? 'Save Checklist Status' : 'Saved'}
                </button>
                <span style={styles.meta}>These statuses are linked with Candidate module and Visa Tracking.</span>
              </div>
            </>
          )}
        </section>

        <section style={styles.panel}>
          <h3 style={styles.panelTitle}>Documents</h3>
          <div style={styles.summaryRow}>
            <div style={styles.statCard}><span style={styles.statLabel}>Total</span><strong>{documentSummary.total}</strong></div>
            <div style={styles.statCard}><span style={styles.statLabel}>PDF</span><strong>{documentSummary.pdf}</strong></div>
            <div style={styles.statCard}><span style={styles.statLabel}>DOC</span><strong>{documentSummary.doc}</strong></div>
            <div style={styles.statCard}><span style={styles.statLabel}>IMAGE</span><strong>{documentSummary.image}</strong></div>
            <div style={styles.statCard}><span style={styles.statLabel}>Storage</span><strong>{formatBytes(documentSummary.totalBytes)}</strong></div>
          </div>
          <div style={styles.docsToolbar}>
            <input
              style={styles.input}
              value={documentSearch}
              onChange={(e) => {
                setDocumentSearch(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search title, file name, uploader"
            />
            <select
              style={styles.input}
              value={documentTypeFilter}
              onChange={(e) => {
                setDocumentTypeFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="all">All Types</option>
              <option value="pdf">PDF</option>
              <option value="doc">DOC</option>
              <option value="image">IMAGE</option>
              <option value="file">FILE</option>
            </select>
            <select style={styles.input} value={documentSort} onChange={(e) => setDocumentSort(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="size_desc">Largest Size</option>
              <option value="size_asc">Smallest Size</option>
            </select>
            <select
              style={styles.input}
              value={documentsPerPage}
              onChange={(e) => {
                setDocumentsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={8}>8 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
            {isAdminUser && (
              <button
                style={selectedCount === 0 || bulkDeleting ? styles.pageBtnDisabled : styles.smallBtnDanger}
                onClick={() => void handleBulkDelete()}
                disabled={selectedCount === 0 || bulkDeleting}
              >
                {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedCount})`}
              </button>
            )}
            <button
              style={selectedPdfDocuments.length === 0 || isPreviewing ? styles.pageBtnDisabled : styles.smallBtn}
              onClick={() => void handlePreviewSelected()}
              disabled={selectedPdfDocuments.length === 0 || isPreviewing}
            >
              {isPreviewing ? 'Previewing...' : `Preview Selected (${selectedPdfDocuments.length})`}
            </button>
            <button
              style={selectedCount === 0 || batchDownloading ? styles.pageBtnDisabled : styles.smallBtn}
              onClick={() => void handleBatchDownload()}
              disabled={selectedCount === 0 || batchDownloading}
            >
              {batchDownloading ? 'Preparing ZIP...' : `Download ZIP (${selectedCount})`}
            </button>
          </div>
          {loadingDocuments ? (
            <div style={styles.empty}>Loading documents...</div>
          ) : sortedDocuments.length === 0 ? (
            <div style={styles.empty}>No documents uploaded for this candidate.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAllOnPage}
                        aria-label="Select all documents on page"
                      />
                    </th>
                    <th style={styles.th}>Title</th>
                    <th style={styles.th}>Original Name</th>
                    <th style={styles.th}>Project</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Uploaded By</th>
                    <th style={styles.th}>Size</th>
                    <th style={styles.th}>Uploaded</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDocuments.map((doc) => (
                    <tr key={doc.id}>
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          checked={selectedDocumentIds.includes(doc.id)}
                          onChange={() => toggleDocumentSelection(doc.id)}
                          aria-label={`Select document ${doc.original_name}`}
                        />
                      </td>
                      <td style={styles.td}>
                        {editingDocumentId === doc.id ? (
                          <div style={styles.titleEditRow}>
                            <input
                              style={styles.inlineInput}
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              placeholder="Document title"
                            />
                            <button
                              style={styles.smallBtn}
                              onClick={() => void saveTitleEdit(doc.id)}
                              disabled={titleSavingId === doc.id}
                            >
                              {titleSavingId === doc.id ? '...' : 'Save'}
                            </button>
                            <button style={styles.pageBtn} onClick={cancelTitleEdit}>Cancel</button>
                          </div>
                        ) : (
                          <div style={styles.titleCell}>
                            <span>{doc.title || '-'}</span>
                            {isAdminUser && <button style={styles.linkBtn} onClick={() => startTitleEdit(doc)}>Edit</button>}
                          </div>
                        )}
                      </td>
                      <td style={styles.td}>{doc.original_name}</td>
                      <td style={styles.td}>{doc?.project?.project_name || 'N/A'}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...getDocumentTypeBadgeStyle(doc) }}>{getDocumentTypeLabel(doc)}</span>
                      </td>
                      <td style={styles.td}>{doc?.uploader?.full_name || doc?.uploader?.name || '-'}</td>
                      <td style={styles.td}>{formatBytes(doc.size_bytes)}</td>
                      <td style={styles.td}>{formatDate(doc.created_at)}</td>
                      <td style={styles.td}>
                        <div style={styles.actionRow}>
                          <button
                            style={styles.smallBtn}
                            onClick={() => void handlePreviewDocument(doc)}
                          >
                            Preview
                          </button>
                          <button
                            style={styles.smallBtn}
                            onClick={() => void handleDownload(doc.id, doc.original_name)}
                            disabled={downloadingId === doc.id}
                          >
                            {downloadingId === doc.id ? '...' : 'Download'}
                          </button>
                          {isAdminUser && (
                            <button style={styles.smallBtnDanger} onClick={() => void handleDelete(doc.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sortedDocuments.length > documentsPerPage && (
            <div style={styles.paginationRow}>
              <button
                style={currentPage === 1 ? styles.pageBtnDisabled : styles.pageBtn}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Prev
              </button>
              <span style={styles.pageLabel}>Page {currentPage} of {totalPages}</span>
              <button
                style={currentPage === totalPages ? styles.pageBtnDisabled : styles.pageBtn}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
              </button>
            </div>
          )}

          {previewUrl && (
            <section style={styles.panel}>
              <div style={styles.previewHeader}>
                <div>
                  <h3 style={styles.panelTitle}>Preview</h3>
                  <div style={styles.meta}>{previewTitle}</div>
                  {previewDocuments.length > 1 && (
                    <div style={styles.meta}>
                      Document {previewIndex + 1} of {previewDocuments.length}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {previewDocuments.length > 1 && (
                    <>
                      <button
                        type="button"
                        style={styles.smallBtn}
                        onClick={() => {
                          const prevIndex = Math.max(0, previewIndex - 1)
                          setPreviewIndex(prevIndex)
                          loadPreviewDocument(previewDocuments[prevIndex], prevIndex)
                        }}
                        disabled={previewIndex === 0}
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        style={styles.smallBtn}
                        onClick={() => {
                          const nextIndex = Math.min(previewDocuments.length - 1, previewIndex + 1)
                          setPreviewIndex(nextIndex)
                          loadPreviewDocument(previewDocuments[nextIndex], nextIndex)
                        }}
                        disabled={previewIndex === previewDocuments.length - 1}
                      >
                        Next
                      </button>
                    </>
                  )}
                  <button style={styles.closeBtnSmall} type="button" onClick={closePreview}>Close</button>
                </div>
              </div>
              <div style={styles.previewContainer}>{renderPreviewContent()}</div>
            </section>
          )}
        </section>
      </div>
    </SidebarLayout>
  )
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString()
}
function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const normalized = bytes / Math.pow(1024, unitIndex)
  return `${normalized.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function getDocumentTypeLabel(doc) {
  const mime = String(doc?.mime_type || '').toLowerCase()
  const filename = String(doc?.original_name || '').toLowerCase()

  if (mime.includes('pdf') || filename.endsWith('.pdf')) return 'PDF'
  if (mime.includes('word') || filename.endsWith('.doc') || filename.endsWith('.docx')) return 'DOC'
  if (mime.includes('image') || filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png')) return 'IMAGE'
  return 'FILE'
}

function getDocumentTypeBadgeStyle(doc) {
  const label = getDocumentTypeLabel(doc)
  if (label === 'PDF') return { background: '#fee2e2', color: '#9f1239', borderColor: '#fecaca' }
  if (label === 'DOC') return { background: '#e0ecff', color: '#1d4ed8', borderColor: '#bfdbfe' }
  if (label === 'IMAGE') return { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
  return { background: '#e2e8f0', color: '#334155', borderColor: '#cbd5e1' }
}

function getPipelineStatusLabel(value) {
  if (value === 'received') return 'Received'
  if (value === 'done') return 'Done'
  if (value === 'flown') return 'Flown'
  if (value === 'not_flown') return 'Not Flown'
  if (value === 'not_done') return 'Not done'
  if (value === 'not_received') return 'Not received'
  if (value === 'not_applicable') return 'Not applicable'
  return 'Unknown'
}

function getPipelineStatusBadgeStyle(value) {
  if (value === 'received' || value === 'done' || value === 'flown') {
    return { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
  }
  if (value === 'not_done') {
    return { background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }
  }
  if (value === 'not_flown') {
    return { background: '#fee2e2', color: '#9f1239', borderColor: '#fecaca' }
  }
  if (value === 'not_applicable') {
    return { background: '#e5e7eb', color: '#475569', borderColor: '#cbd5e1' }
  }
  return { background: '#fee2e2', color: '#9f1239', borderColor: '#fecaca' }
}

const styles = {
  container: { display: 'grid', gap: 14 },
  panel: {
    background: '#ffffff',
    border: '1px solid #dbe3ef',
    borderRadius: 14,
    padding: 16,
  },
  panelTitle: {
    margin: '0 0 12px',
    color: '#0f2a4f',
    fontSize: 18,
    fontWeight: 800,
  },
  selectRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  uploadForm: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr auto',
    gap: 10,
    alignItems: 'center',
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    border: '1px solid #dbe3ef',
    borderRadius: 10,
    background: '#f8fbff',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    color: '#17365c',
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#557195',
    fontWeight: 700,
  },
  docsToolbar: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 120px auto',
    gap: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  documentChecklistHeaderRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 1fr)',
    gap: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  documentChecklistHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 78,
    borderRadius: 18,
    border: '1px solid #ccdcee',
    background: 'linear-gradient(180deg, #eef5fc, #ffffff)',
    color: '#24416d',
    fontWeight: 800,
    fontSize: 24,
    lineHeight: 1.05,
    position: 'relative',
  },
  documentChecklistEntryRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 12,
  },
  documentChecklistGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
  },
  documentChecklistItem: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'grid',
    gap: 8,
  },
  documentChecklistLabel: {
    color: '#1e3a8a',
    fontSize: 13,
    fontWeight: 700,
  },
  documentChecklistSelect: {
    width: '100%',
    border: '1px solid #93c5fd',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12,
    color: '#0f172a',
    background: '#ffffff',
  },
  checklistGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
    alignItems: 'start',
  },
  checklistItem: {
    padding: 16,
    borderRadius: 16,
    background: '#f8fbff',
    border: '1px solid #dbe3ef',
    display: 'grid',
    gap: 8,
  },
  checklistLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: 700,
  },
  checklistBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    padding: '0 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  input: {
    width: '100%',
    border: '1px solid #c8d5e6',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 14,
    background: '#fff',
  },
  btn: {
    background: 'linear-gradient(135deg, #0a3772, #1c6bd0)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  btnDisabled: {
    background: '#94a3b8',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    cursor: 'not-allowed',
    fontWeight: 700,
  },
  refreshBtn: {
    background: '#e2ebf7',
    color: '#0a3772',
    border: '1px solid #bfd0ea',
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    borderBottom: '1px solid #dbe3ef',
    padding: '10px 8px',
    color: '#365275',
  },
  td: {
    borderBottom: '1px solid #eef3f9',
    padding: '10px 8px',
    color: '#18314f',
  },
  actionRow: {
    display: 'flex',
    gap: 8,
  },
  titleCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleEditRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  addChecklistRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 180px',
    gap: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  checklistButtonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  checklistEntryCard: {
    border: '1px solid #bfdbfe',
    borderRadius: 12,
    padding: 12,
    background: '#eff6ff',
    display: 'grid',
    gap: 8,
  },
  checklistEntryHeader: {
    color: '#1f3b5d',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.35,
  },
  checklistEntryMeta: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    alignItems: 'center',
    gap: 8,
    color: '#5a708a',
    fontSize: 12,
  },
  inlineInput: {
    border: '1px solid #c8d5e6',
    borderRadius: 8,
    padding: '5px 8px',
    fontSize: 12,
    minWidth: 0,
    width: '100%',
  },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: '#1d4ed8',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    padding: 0,
  },
  smallBtn: {
    background: '#e6f0ff',
    color: '#0b4aa0',
    border: '1px solid #b9d1f8',
    borderRadius: 8,
    padding: '6px 9px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  smallBtnDanger: {
    background: '#fee2e2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '6px 9px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
    border: '1px solid',
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em',
  },
  debug: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    background: '#eef2ff',
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: 700,
  },
  meta: {
    marginTop: 10,
    color: '#334e72',
    fontSize: 13,
  },
  error: {
    background: '#fee2e2',
    color: '#9f1239',
    border: '1px solid #fecaca',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    background: '#e0f2fe',
    color: '#0c4a6e',
    border: '1px solid #bae6fd',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'inherit',
    fontSize: 14,
  },
  empty: {
    padding: 14,
    color: '#64748b',
    border: '1px dashed #cbd5e1',
    borderRadius: 10,
    background: '#f8fbff',
  },
  paginationRow: {
    marginTop: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  pageLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: 600,
  },
  pageBtn: {
    border: '1px solid #bfd0ea',
    background: '#edf4ff',
    color: '#1e40af',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  pageBtnDisabled: {
    border: '1px solid #d9e2ef',
    background: '#f4f7fb',
    color: '#94a3b8',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'not-allowed',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  closeBtnSmall: {
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '8px 12px',
    color: '#0f172a',
    cursor: 'pointer',
    fontWeight: 700,
  },
  previewContainer: {
    minHeight: 260,
    border: '1px solid #dbe3ef',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#f8fbff',
  },
  previewFrame: {
    width: '100%',
    height: 460,
    border: 'none',
  },
  previewImage: {
    width: '100%',
    maxHeight: 460,
    objectFit: 'contain',
    display: 'block',
  },
  previewUnsupported: {
    padding: 24,
    textAlign: 'center',
    color: '#475569',
  },
  previewLink: {
    display: 'inline-block',
    marginTop: 12,
    color: '#1d4ed8',
    textDecoration: 'underline',
  },
}