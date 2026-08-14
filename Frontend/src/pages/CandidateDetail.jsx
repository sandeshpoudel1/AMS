import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { fetchPassportStoreStatusTemplates, fetchStatusTemplates, STATUS_EVENT } from '../utils/statusTemplates'

const requestWithFallback = async (
  primaryRoute,
  fallbackRoute,
  primaryParams = null,
  fallbackParams = null
) => {
  const primaryConfig = primaryParams ? { params: primaryParams } : undefined
  const fallbackConfig = fallbackParams ? { params: fallbackParams } : undefined

  try {
    return await api.get(primaryRoute, primaryConfig)
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get(fallbackRoute, fallbackConfig)
    }
    throw err
  }
}

export default function CandidateDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [candidate, setCandidate] = useState(null)
  const [visaEntries, setVisaEntries] = useState([])
  const [documents, setDocuments] = useState([])
  
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewMimeType, setPreviewMimeType] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewingId, setPreviewingId] = useState(null)

  const displayedVisaEntries = useMemo(() => {
    const entriesById = {}

    visaEntries.forEach((entry) => {
      if (!entry?.id) {
        return
      }

      const currentKey = String(entry.id)
      const existing = entriesById[currentKey]
      const entryTimestamp = new Date(entry.updated_at || entry.created_at || 0).getTime()
      const existingTimestamp = existing
        ? new Date(existing.updated_at || existing.created_at || 0).getTime()
        : 0

      if (!existing || entryTimestamp >= existingTimestamp) {
        entriesById[currentKey] = entry
      }
    })

    return Object.values(entriesById).sort((a, b) => {
      return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
    })
  }, [visaEntries])

  const latestVisaEntry = useMemo(() => displayedVisaEntries[0] || null, [displayedVisaEntries])

  const checklistItems = useMemo(() => {
    if (!latestVisaEntry) return []
    const manualItems = Array.isArray(latestVisaEntry.manual_checklist)
      ? latestVisaEntry.manual_checklist
      : typeof latestVisaEntry.manual_checklist === 'string' && latestVisaEntry.manual_checklist.trim()
        ? JSON.parse(latestVisaEntry.manual_checklist)
        : []

    return manualItems.map((item) => {
      const raw = item.status ?? 'not_received'
      const normalized = String(raw).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
      // handle common variants
      const status = normalized === 'notapplicable' ? 'not_applicable' : normalized

      return {
        key: item.key || `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: item.label || 'Status Entry',
        status: status || 'not_received',
        remarks: item.remarks || item.passport_store_out_by || item.out_by || '',
      }
    })
  }, [latestVisaEntry])

  const getBookingStatusStyle = (status) => {
    const normalized = (status || '').toLowerCase()
    if (normalized === 'paid') {
      return {
        ...styles.bookingPill,
        background: '#ecfdf5',
        color: '#166534',
      }
    }

    if (normalized === 'partial') {
      return {
        ...styles.bookingPill,
        background: '#fef3c7',
        color: '#92400e',
      }
    }

    return {
      ...styles.bookingPill,
      background: '#fee2e2',
      color: '#991b1b',
    }
  }
  const [downloadingId, setDownloadingId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [statusEntries, setStatusEntries] = useState([])
  const [newStatusLabel, setNewStatusLabel] = useState('')
  const [statusDirty, setStatusDirty] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [templates, setTemplates] = useState([])
  const [passportStoreLabels, setPassportStoreLabels] = useState([])

  const canEditStatus = useMemo(() => {
    const role = String(user?.role || user?.role_label || '').toLowerCase().replace(/\s+/g, '_')
    return role === 'admin' || role === 'superadmin' || role === 'super_admin'
  }, [user])

  const formatCurrency = (value) => {
    const amount = Number(value ?? 0)
    if (Number.isNaN(amount)) return '-'
    return `NPR ${amount.toLocaleString()}`
  }

  const formatDate = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toISOString().slice(0, 10)
  }

  const calculateAge = (value) => {
    if (!value) return '-'
    const birthDate = new Date(value)
    if (Number.isNaN(birthDate.getTime())) return '-'

    const today = new Date()
    let years = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      years -= 1
    }

    return years >= 0 ? String(years) : '-'
  }

  const calculatePassportExpiryRemaining = (value) => {
    if (!value) return '-'
    const expiry = new Date(value)
    if (Number.isNaN(expiry.getTime())) return '-'

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

  const getPipelineStatusLabel = (value) => {
    const v = String(value || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_')
    if (v === 'received') return 'Received'
    if (v === 'done') return 'Done'
    if (v === 'registered') return 'Registered'
    if (v === 'not_done') return 'Not done'
    if (v === 'not_received') return 'Not received'
    if (v === 'not_applicable' || v === 'notapplicable') return 'Not applicable'
    // Treat unknown/empty values as not received for status clarity
    if (v === '' || v === 'unknown' || v === 'unknown_status') return 'Not received'
    return 'Not received'
  }

  const getPipelineStatusBadgeStyle = (value) => {
    const v = String(value || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_')
    if (v === 'received' || v === 'done' || v === 'registered') {
      return { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
    }
    if (v === 'not_done') {
      return { background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }
    }
    if (v === 'not_applicable' || v === 'notapplicable') {
      return { background: '#e5e7eb', color: '#475569', borderColor: '#cbd5e1' }
    }

    // default to not received style
    return { background: '#fee2e2', color: '#9f1239', borderColor: '#fecaca' }
  }

  const getPassportStoreStatusType = (value) => {
    const normalized = String(value || '').toLowerCase().trim()
    if (/original\s*passport\s*out|passport\s*out|(^|\s)out(\s|$)/.test(normalized)) {
      return 'out'
    }
    if (/original\s*passport\s*in|passport\s*in|(^|\s)in(\s|$)/.test(normalized)) {
      return 'in'
    }
    return 'unknown'
  }

  const loadCandidateVisaEntries = async () => {
    const visaRes = await requestWithFallback(
      `/candidates/${id}/candidate-flown`,
      '/candidate-flown',
      { per_page: 300 },
      { candidate_id: id, per_page: 300 }
    )
    const visaEntriesData = visaRes.data.data?.entries || visaRes.data.data || []
    setVisaEntries(Array.isArray(visaEntriesData) ? visaEntriesData : [])
  }

  const getDefaultStatusForKey = (key) => {
    if (key === 'medical_online_status' || key === 'orientation_online_status') {
      return 'not_done'
    }
    return 'not_received'
  }

  const handleStatusChange = (key, value) => {
    setStatusEntries((prev) => prev.map((item) => (item.key === key ? { ...item, status: value } : item)))
    setStatusDirty(true)
  }

  const handleStatusLabelChange = (key, value) => {
    setStatusEntries((prev) => prev.map((item) => (item.key === key ? { ...item, label: value } : item)))
    setStatusDirty(true)
  }

  const addStatusEntry = () => {
    const trimmed = newStatusLabel.trim()
    if (!trimmed) return
    setStatusEntries((prev) => [...prev, {
      key: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: trimmed,
      status: 'not_received',
      manual: true,
    }])
    setNewStatusLabel('')
    setStatusDirty(true)
  }

  const removeStatusEntry = (key) => {
    setStatusEntries((prev) => prev.filter((item) => item.key !== key))
    setStatusDirty(true)
  }

  const loadTemplatesIntoStatus = () => {
    if (!Array.isArray(templates) || templates.length === 0) return
    const mapped = templates.map((t) => ({
      key: t.key || `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: t.label || 'Status Entry',
      status: getDefaultStatusForKey(t.key),
      manual: true,
    }))
    setStatusEntries(mapped)
    setStatusDirty(true)
  }

  const saveStatus = async () => {
    if (!candidate?.id) {
      setError('Candidate ID is missing')
      return
    }

    setSavingStatus(true)
    setError('')
    try {
      const payload = {
        manual_checklist: statusEntries.map((item) => ({ key: item.key, label: item.label, status: item.status })),
        project_id: candidate.project_id || null,
      }

      if (latestVisaEntry?.id && Number(latestVisaEntry.id) > 0) {
        await api.put(`/candidate-flown/${latestVisaEntry.id}`, payload)
      } else {
        await api.post('/candidate-flown', {
          candidate_id: candidate.id,
          candidate_name: candidate.full_name || '',
          passport_number: candidate.passport_number || '',
          project_id: candidate.project_id || null,
          manual_checklist: payload.manual_checklist,
        })
      }

      await loadCandidateVisaEntries()
      window.dispatchEvent(new CustomEvent('visaPipelineUpdated', {
        detail: { candidateId: candidate.id },
      }))
      setInfo('Status saved successfully')
      setStatusDirty(false)
      setTimeout(() => setInfo(''), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save status')
    } finally {
      setSavingStatus(false)
    }
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

  const clearMessages = () => {
    setError('')
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
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to preview document')
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
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download document')
    } finally {
      setDownloadingId(null)
    }
  }

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('Candidate ID is missing')
      return
    }

    const load = async () => {
      setLoading(true)
      setError('')

      const fetchCandidate = () => requestWithFallback(`/candidates/${id}`, `/candidate/${id}`)
      const fetchDocuments = () =>
        requestWithFallback(
          `/candidates/${id}/documents`,
          '/documents',
          { per_page: 300 },
          { candidate_id: id, per_page: 300 }
        )
      const fetchVisaEntries = () =>
        requestWithFallback(
          `/candidates/${id}/candidate-flown`,
          '/candidate-flown',
          { per_page: 300 },
          { candidate_id: id, per_page: 300 }
        )

      try {
        const [candRes, visaRes, docRes] = await Promise.all([
          fetchCandidate(),
          fetchVisaEntries(),
          fetchDocuments(),
        ])

        setCandidate(candRes.data.data?.candidate || candRes.data.data || candRes.data)

        const visaEntriesData = visaRes.data.data?.entries || visaRes.data.data || []
        setVisaEntries(Array.isArray(visaEntriesData) ? visaEntriesData : [])

        const documentsData = docRes.data.data?.documents || docRes.data.data || []
        setDocuments(Array.isArray(documentsData) ? documentsData : [])

        
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load candidate details')
      } finally {
        setLoading(false)
      }
    }

    load()

    const onVisaPipelineUpdated = async (e) => {
      try {
        const updatedCandidateId = e?.detail?.candidateId
        if (updatedCandidateId && String(updatedCandidateId) === String(id)) {
          await load()
          setInfo('Status updated')
          setTimeout(() => setInfo(''), 4000)
        }
      } catch (err) {
        // ignore
      }
    }

    window.addEventListener('visaPipelineUpdated', onVisaPipelineUpdated)

    return () => {
      window.removeEventListener('visaPipelineUpdated', onVisaPipelineUpdated)
    }
  }, [id])

  useEffect(() => {
    setStatusEntries(checklistItems)
    setStatusDirty(false)
  }, [checklistItems, id])

  useEffect(() => {
    const loadTemplates = () => {
      const fetchRows = async () => {
        try {
          const [rows, passportRows] = await Promise.all([
            fetchStatusTemplates(),
            fetchPassportStoreStatusTemplates(),
          ])

          const merged = [...rows, ...passportRows]
          setTemplates(merged.map((r) => ({
            key: r.key || `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            label: r.label || r,
          })))
          setPassportStoreLabels(passportRows.map((r) => String(r?.label || '')).filter(Boolean))
        } catch (err) {
          setTemplates([])
          setPassportStoreLabels([])
        }
      }

      void fetchRows()
    }

    loadTemplates()

    const handler = () => loadTemplates()
    window.addEventListener(STATUS_EVENT, handler)
    return () => window.removeEventListener(STATUS_EVENT, handler)
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

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

  return (
    <SidebarLayout title="Candidate Detail" headerExtra={<button style={styles.backBtn} onClick={() => navigate(-1)}>← Back</button>}>
      <div style={styles.container} className="reveal-up">
        {error && <div style={styles.error}>{error}</div>}
        {info && <div style={styles.info}>{info}<button style={styles.closeBtn} onClick={() => setInfo('')}>✕</button></div>}

        {loading ? (
          <div style={styles.loading}>Loading candidate...</div>
        ) : (
          <div style={styles.card}>
            <div style={styles.headerRow}>
              <div style={styles.headerInfo}>
                <h2 style={styles.title}>{candidate?.full_name || '—'}</h2>
                <div style={styles.subtitle}>{candidate?.email || 'No email'} • {candidate?.phone || 'No phone'}</div>
                <div style={styles.headerTags}>
                  <span style={styles.statusTag}>{candidate?.status ? candidate.status.replaceAll('_', ' ') : 'Unknown'}</span>
                  <span style={styles.projectChip}>{candidate?.project?.project_name || 'No Project'}</span>
                  <span style={styles.tradeChip}>{candidate?.project?.trade || candidate?.project?.trade_name || 'No Trade'}</span>
                </div>
              </div>
            </div>
            {/* Create Candidate Flown button removed */}
            <div style={styles.detailGrid}>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Passport Number</div>
                <div style={styles.detailValue}>{candidate?.passport_number || '—'}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Date of Birth</div>
                <div style={styles.detailValue}>{candidate?.date_of_birth ? candidate.date_of_birth.slice(0, 10) : '—'}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Age</div>
                <div style={styles.detailValue}>{calculateAge(candidate?.date_of_birth)}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Passport Date of Issue</div>
                <div style={styles.detailValue}>{candidate?.passport_issue_date ? formatDate(candidate.passport_issue_date) : '—'}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Passport Date of Expiry</div>
                <div style={styles.detailValue}>{candidate?.passport_expiry_date ? formatDate(candidate.passport_expiry_date) : '—'}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Passport Validity Remaining</div>
                <div style={styles.detailValue}>{calculatePassportExpiryRemaining(candidate?.passport_expiry_date)}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Gender</div>
                <div style={styles.detailValue}>{candidate?.gender || '—'}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Nationality</div>
                <div style={styles.detailValue}>{candidate?.nationality || '—'}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Status</div>
                <div style={styles.detailValue}>{candidate?.status || '-'}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Trade</div>
                <div style={styles.detailValue}>{candidate?.project?.trade || candidate?.project?.trade_name || '-'}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>Reference</div>
                <div style={styles.detailValue}>{candidate?.source || '—'}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div style={styles.detailLabel}>Address</div>
                <div style={styles.detailValue}>{candidate?.address || '—'}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div style={styles.detailLabel}>Notes</div>
                <div style={styles.detailValue}>{candidate?.notes || '—'}</div>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Candidate Flown History</h3>
              {displayedVisaEntries.length === 0 ? (
                <div style={styles.empty}>No Candidate Flown history found for this candidate.</div>
              ) : (
                <div style={styles.timeline}>
                  {displayedVisaEntries.map(e => (
                    <div key={e.id} style={styles.timelineItem}>
                      <div style={styles.timelineLeft}>{e.created_at?.slice(0, 10)}</div>
                      <div style={styles.timelineRight}>
                        <div style={styles.eventTitle}>{e.project_name || e.service || 'Candidate Flown Entry'}</div>
                        <div style={styles.eventMeta}>Status: {e.status || '—'} • Office: {e.office_name || e.office_rate || '-'}</div>
                        <div style={styles.eventMeta}>Amount: {e.amount ? e.amount : (e.total_amount || '-')}</div>
                        <div style={{ marginTop: 6, color: '#465e80' }}>{e.notes || ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Status</h3>
              {!latestVisaEntry ? (
                <div style={styles.empty}>No Candidate Flown record found. Add a Candidate Flown entry to enable status tracking.</div>
              ) : checklistItems.length === 0 ? (
                <div style={styles.empty}>No status entries found.</div>
              ) : (
                <div style={styles.checklistGrid}>
                  {(() => {
                    const normalizeToken = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                    const renderedTokens = new Set()
                    const candidateStatusType = getPassportStoreStatusType(candidate?.passport_store_status)

                    // If candidate has a top-level passport_store_status, mark it rendered
                    try {
                      const candStatus = String(candidate?.passport_store_status || '').trim()
                      if (candStatus) renderedTokens.add(normalizeToken(candStatus))
                    } catch (e) {
                      // ignore
                    }

                    return checklistItems.map((item) => {
                      const token = normalizeToken(item.label || item.key || '')
                      if (renderedTokens.has(token)) return null

                      const value = item.status ?? latestVisaEntry?.[item.key] ?? 'not_received'
                      const isPassportStoreItem = passportStoreLabels.some((label) => normalizeToken(label) === token)
                      const itemStatusType = getPassportStoreStatusType(item.status || item.label)

                      if (candidateStatusType === 'in' && itemStatusType === 'out') return null
                      if (candidateStatusType === 'out' && itemStatusType === 'in') return null

                      const isOutStatus = itemStatusType === 'out'
                      const outByName = String(item.remarks || '').trim()

                      return (
                        <div key={item.key} style={isPassportStoreItem ? { ...styles.checklistItem, ...styles.passportStoreChecklistItem } : styles.checklistItem}>
                          <div style={isPassportStoreItem ? { ...styles.checklistLabel, ...styles.passportStoreChecklistLabel } : styles.checklistLabel}>{item.label}</div>
                          <span style={{ ...styles.checklistBadge, ...getPipelineStatusBadgeStyle(value) }}>
                            {getPipelineStatusLabel(value)}
                          </span>
                          {isPassportStoreItem && isOutStatus && outByName && (
                            <div style={styles.passportStoreRemarkLine}>Taken by: {outByName}</div>
                          )}
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Documents</h3>
              {documents.length === 0 ? (
                <div style={styles.empty}>No documents found for this candidate.</div>
              ) : (
                <>
                  <div style={styles.documentList}>
                    {documents.map((doc) => (
                      <div key={doc.id || doc.document_id || doc.original_name} style={styles.documentItem}>
                        <div style={styles.documentInfo}>
                          <div style={styles.documentName}>{doc.title || doc.original_name || doc.document_type || 'Document'}</div>
                          <div style={styles.documentMetaSmall}>{doc.original_name && doc.title ? doc.original_name : null}</div>
                          <div style={styles.documentMetaSmall}>
                            Uploaded by {doc.uploader?.full_name || doc.uploader?.name || 'Unknown'} on {formatDate(doc.created_at)}
                          </div>
                        </div>
                        <div style={styles.documentActions}>
                          <button
                            style={styles.smallBtn}
                            type="button"
                            onClick={() => void handlePreview(doc.id, doc.original_name)}
                            disabled={previewingId === doc.id}
                          >
                            {previewingId === doc.id ? 'Loading…' : 'Preview'}
                          </button>
                          <button
                            style={styles.smallBtn}
                            type="button"
                            onClick={() => void handleDownload(doc.id, doc.original_name)}
                            disabled={downloadingId === doc.id}
                          >
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

            {/* Payment Booking section removed */}
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: { display: 'grid', gap: 14 },
  backBtn: { padding: '8px 12px', borderRadius: 10, border: 'none', background: '#eef4fc', cursor: 'pointer' },
  loading: { padding: 40, textAlign: 'center', color: '#526686' },
  error: { background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: '10px 14px', color: '#be123c' },
  card: { background: 'rgba(255,255,255,0.95)', border: '1px solid #dbe5f3', borderRadius: 14, padding: 20 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 14, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#0f2a4f' },
  subtitle: { color: '#6c84a6', fontSize: 13, marginTop: 8 },
  headerInfo: { display: 'grid', gap: 10 },
  headerActions: { marginTop: 18, display: 'flex', justifyContent: 'flex-end' },
  primaryBtn: { padding: '10px 16px', borderRadius: 8, background: '#1e3a5f', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnDisabled: { padding: '10px 16px', borderRadius: 8, background: '#cbd5e1', color: '#f8fafc', border: 'none', cursor: 'not-allowed', fontWeight: 700, fontSize: 13 },
  headerTags: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  statusTag: { padding: '6px 12px', borderRadius: 999, background: '#e7f5ff', color: '#0f4a83', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' },
  projectChip: { padding: '6px 12px', borderRadius: 999, background: '#f0f7f4', color: '#166534', fontSize: 12, fontWeight: 700 },
  tradeChip: { padding: '6px 12px', borderRadius: 999, background: '#f7f0fb', color: '#5f2783', fontSize: 12, fontWeight: 700 },
  projectBadge: { padding: '8px 12px', background: '#eef4fc', borderRadius: 12, color: '#0f2a4f', fontSize: 13, fontWeight: 700 },
  tradeBadge: { marginTop: 8, padding: '6px 10px', background: '#dbeaf8', borderRadius: 10, color: '#0f2a4f', fontSize: 12, display: 'inline-block' },
  detailGrid: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 18 },
  detailCard: { padding: 16, borderRadius: 14, background: '#f8fbff', border: '1px solid #dfe9f6' },
  detailLabel: { color: '#6b7b92', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 },
  detailValue: { color: '#12243d', fontSize: 16, fontWeight: 600 },
  section: { marginTop: 24 },
  sectionTitle: { margin: '8px 0 16px', fontSize: 18, fontWeight: 800, color: '#0f2a4f' },
  empty: { color: '#6c84a6', padding: 18, borderRadius: 14, background: '#f5f8ff' },
  timeline: { display: 'grid', gap: 16 },
  timelineItem: { display: 'grid', gap: 10, padding: 18, borderRadius: 18, background: '#fff', border: '1px solid #eef5fb', boxShadow: '0 10px 30px rgba(15, 42, 79, 0.04)' },
  timelineLeft: { color: '#30456f', fontSize: 13, fontWeight: 700 },
  timelineRight: { display: 'grid', gap: 8 },
  eventTitle: { fontWeight: 800, color: '#10253d', fontSize: 16 },
  eventMeta: { color: '#5f738c', fontSize: 13, marginTop: 4 },
  bookingCard: {
    padding: 22,
    borderRadius: 22,
    background: '#ffffff',
    border: '1px solid #e7eff9',
    boxShadow: '0 14px 40px rgba(15, 42, 79, 0.06)',
    transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
  },
  bookingCardHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 18px 60px rgba(15, 42, 79, 0.08)',
    borderColor: '#d1dce8',
  },
  previewPanel: { marginTop: 18, padding: 22, borderRadius: 20, border: '1px solid #e9eff7', background: '#ffffff' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 16 },
  panelTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#0f2a4f' },
  previewContainer: { minHeight: 180, borderRadius: 16, background: '#f6f8ff', padding: 12 },
  previewFrame: { width: '100%', minHeight: 320, border: 'none', borderRadius: 12 },
  previewImage: { maxWidth: '100%', borderRadius: 12 },
  previewFallback: { color: '#344054', fontSize: 14 },
  previewLink: { color: '#0c6cdb', textDecoration: 'none' },
  closeBtnSmall: { padding: '8px 12px', borderRadius: 10, border: '1px solid #dbe5f3', background: '#eef4fc', cursor: 'pointer' },
  documentInfo: { display: 'grid', gap: 4 },
  documentActions: { display: 'flex', gap: 10, alignItems: 'center' },
  documentMetaSmall: { color: '#6b7b92', fontSize: 12 },
  smallBtn: { padding: '8px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' },
  bookingHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 },
  bookingGrid: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' },
  bookingField: { padding: 12, borderRadius: 14, background: '#ffffff', border: '1px solid #e4ebf6' },
  bookingLabel: { color: '#667695', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 },
  bookingValue: { color: '#0f2a4f', fontSize: 16, fontWeight: 700 },
  bookingPill: { padding: '6px 12px', borderRadius: 999, background: '#eef4fc', color: '#0f2a4f', fontWeight: 700, fontSize: 12 },
  bookingHint: { marginTop: 14, color: '#556d8a', fontSize: 13 },
  bookingRow: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, color: '#12243d' },
  statusControlRow: { display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, marginBottom: 12, alignItems: 'center' },
  statusActionRow: { display: 'flex', justifyContent: 'flex-start', marginTop: 14 },
  input: { width: '100%', border: '1px solid #c8d5e6', borderRadius: 10, padding: '9px 12px', fontSize: 14, background: '#fff' },
  checklistGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 },
  checklistItem: { padding: 16, borderRadius: 16, background: '#f8fbff', border: '1px solid #dbe3ef', display: 'grid', gap: 8 },
  passportStoreChecklistItem: { background: '#eefcf7', borderColor: '#a7f3d0' },
  checklistLabel: { color: '#475569', fontSize: 13, fontWeight: 700 },
  passportStoreChecklistLabel: { color: '#065f46' },
  checklistBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 32, padding: '0 10px', borderRadius: 999, border: '1px solid', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' },
  passportStoreRemarkLine: { fontSize: 11, color: '#1e3a5f', fontWeight: 700, background: '#dcfce7', borderRadius: 8, padding: '6px 10px' },
  smallBtnDanger: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  documentList: { display: 'grid', gap: 10 },
  documentItem: { padding: 12, borderRadius: 12, background: '#fff', border: '1px solid #dbe5f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  documentName: { color: '#0f2a4f', fontWeight: 700 },
  documentLink: { color: '#0c6cdb', textDecoration: 'none' },
  documentMeta: { color: '#6c84a6' },
  referenceTableWrapper: { overflowX: 'auto', borderRadius: 14, border: '1px solid #dfe3ea', background: '#f8fbff' },
  referenceTable: { width: '100%', borderCollapse: 'collapse', minWidth: 760 },
  referenceTableHeader: { textAlign: 'left', padding: '14px 16px', background: '#eef4ff', color: '#1e3a5f', fontSize: 13, fontWeight: 700, borderBottom: '1px solid #dbe5f3' },
  referenceTableCell: { padding: '14px 16px', borderBottom: '1px solid #e9eff7', color: '#30456f', fontSize: 14 },
}
