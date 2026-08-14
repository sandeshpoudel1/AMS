import { useEffect, useMemo, useRef, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'
import { CANDIDATE_STATUSES } from '../constants/statuses'
import { fetchPassportStoreStatusTemplates } from '../utils/statusTemplates'

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

export default function VisaDetails() {
  const [candidatesByProject, setCandidatesByProject] = useState({})
  const [latestVisaEntryByCandidate, setLatestVisaEntryByCandidate] = useState({})
  const [projectMap, setProjectMap] = useState({})
  const [projectDemandByName, setProjectDemandByName] = useState({})
  const [projectDemandById, setProjectDemandById] = useState({})
  const [selectedProject, setSelectedProject] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [projectSearchTerms, setProjectSearchTerms] = useState({})
  const [selectedStatus, setSelectedStatus] = useState('')
  const [expandedProjects, setExpandedProjects] = useState({})
  const [hideEmptyStatusColumns, setHideEmptyStatusColumns] = useState(true)
  const [hiddenColumns, setHiddenColumns] = useState([])
  const [columnOrder, setColumnOrder] = useState(() => getDefaultColumnOrder())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trackingStatusLabels, setTrackingStatusLabels] = useState(() => TRACKING_STATUS_LABELS)
  const [passportStoreLabels, setPassportStoreLabels] = useState([])
  const dragStateRef = useRef({ active: false, startX: 0, scrollLeft: 0, element: null, pointerId: null })
  const columnDragRef = useRef({ sourceLabel: '' })

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await api.get('/project-settings')
        const projects = Array.isArray(res?.data?.data) ? res.data.data : []
        const map = {}

        projects.forEach((project, index) => {
          const id = String(project.id || project.project_id || '')
          const name = formatProjectName(project.project_name || project.name || '')
          const normalizedName = normalizeProjectKey(name)
          const demandValue = Number(project.total_demand ?? project.number_of_requirements ?? 0)
          const key = id || normalizedName || `unnamed-project-${index}`

          if (!map[key]) {
            map[key] = {
              id: id || key,
              name,
              total_demand: 0,
            }
          }

          if (name && !map[key].name) {
            map[key].name = name
          }

          if (Number.isFinite(demandValue) && demandValue >= 0) {
            map[key].total_demand += demandValue
          }
        })

        return map
      } catch {
        return {}
      }
    }

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [projectMapResult, candidateRes, visaRes, passportStoreRows] = await Promise.all([
          loadProjects(),
          api.get('/candidates', { params: { per_page: 500 } }),
          api.get('/candidate-flown', { params: { per_page: 1000 } }).catch(() => ({ data: { data: { entries: [] } } })),
          fetchPassportStoreStatusTemplates(),
        ])

        const loadedPassportStoreLabels = Array.isArray(passportStoreRows)
          ? passportStoreRows.map((r) => String(r?.label || '')).filter(Boolean)
          : []

        setPassportStoreLabels(loadedPassportStoreLabels)

        setTrackingStatusLabels((current) => {
          const names = new Set(current)
          loadedPassportStoreLabels.forEach((label) => names.add(label))
          return [...current, ...loadedPassportStoreLabels.filter((label) => !current.includes(label))]
        })

        setColumnOrder((current) => {
          const next = [...current]
          loadedPassportStoreLabels.forEach((label) => {
            if (!next.includes(label)) {
              next.push(label)
            }
          })
          return next
        })

        setProjectMap(projectMapResult)

        const resolvedProjectDemandByName = Object.values(projectMapResult).reduce((acc, project) => {
          const displayName = formatProjectName(project?.name || project?.project_name || '')
          const normalizedName = normalizeProjectKey(displayName)
          const demandValue = Number(project?.total_demand ?? project?.number_of_requirements ?? 0)

          if (normalizedName && Number.isFinite(demandValue) && demandValue >= 0) {
            acc[normalizedName] = (acc[normalizedName] || 0) + demandValue
          }

          return acc
        }, {})

        const resolvedProjectDemandById = Object.keys(projectMapResult).reduce((acc, id) => {
          const project = projectMapResult[id]
          const demandValue = Number(project?.total_demand ?? project?.number_of_requirements ?? 0)
          if (Number.isFinite(demandValue) && demandValue >= 0) {
            acc[id] = demandValue
          }
          return acc
        }, {})

        setProjectDemandByName(resolvedProjectDemandByName)
        setProjectDemandById(resolvedProjectDemandById)

        const list = Array.isArray(candidateRes?.data?.data?.candidates)
          ? candidateRes.data.data.candidates
          : Array.isArray(candidateRes?.data?.data)
            ? candidateRes.data.data
            : []

        const visaEntries = Array.isArray(visaRes?.data?.data?.entries)
          ? visaRes.data.data.entries
          : Array.isArray(visaRes?.data?.data)
            ? visaRes.data.data
            : []

        const latestByCandidate = visaEntries.reduce((acc, row) => {
          const candidateId = String(row?.candidate_id || '')
          if (!candidateId) return acc

          const current = acc[candidateId]
          const currentTs = new Date(current?.updated_at || current?.created_at || 0).getTime()
          const rowTs = new Date(row?.updated_at || row?.created_at || 0).getTime()

          if (!current || rowTs >= currentTs) {
            let manualChecklist = []
            if (Array.isArray(row?.manual_checklist)) {
              manualChecklist = row.manual_checklist
            } else if (typeof row?.manual_checklist === 'string' && row.manual_checklist.trim()) {
              try {
                const parsed = JSON.parse(row.manual_checklist)
                manualChecklist = Array.isArray(parsed) ? parsed : []
              } catch {
                manualChecklist = []
              }
            }

            acc[candidateId] = {
              ...row,
              manual_checklist: manualChecklist,
            }
          }

          return acc
        }, {})

        setLatestVisaEntryByCandidate(latestByCandidate)

        const grouped = list.reduce((acc, c) => {
          const projectName = getProjectDisplayName(c, projectMapResult)
          const projectId = String(c.project_id || c.project?.id || '')
          const demandKey = normalizeProjectKey(projectName)
          const projectDemand = resolvedProjectDemandById[projectId] ?? resolvedProjectDemandByName[demandKey] ?? null

          if (!acc[projectName]) acc[projectName] = []
          acc[projectName].push({ ...c, projectKey: projectName, projectDemand })
          return acc
        }, {})

        Object.keys(grouped).forEach((projectKey) => {
          grouped[projectKey].sort((a, b) =>
            getCandidateDisplayName(a).localeCompare(getCandidateDisplayName(b))
          )
        })

        setCandidatesByProject(grouped)
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load candidates')
        setCandidatesByProject({})
        setLatestVisaEntryByCandidate({})
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const projectKeys = Object.keys(candidatesByProject).sort((a, b) => a.localeCompare(b))
  const totalCandidates = Object.values(candidatesByProject).reduce((sum, rows) => sum + rows.length, 0)
  const totalDemand = Object.values(projectDemandByName).reduce((sum, value) => sum + (Number(value) || 0), 0)
  const filteredKeys = selectedProject ? [selectedProject] : projectKeys

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const candidatesForDisplay = filteredKeys.reduce((acc, projectKey) => {
    const projectSearch = (projectSearchTerms[projectKey] || '').trim().toLowerCase()
    const rows = candidatesByProject[projectKey].filter((candidate) => {
      if (selectedStatus && String(candidate.status || '').toLowerCase() !== selectedStatus.toLowerCase()) {
        return false
      }

      const candidateName = String(candidate.full_name || candidate.candidate_name || candidate.name || '').toLowerCase()
      const passport = String(candidate.passport_number || candidate.passport || '').toLowerCase()
      const projectName = String(candidate.projectKey || '').toLowerCase()
      const trade = String(candidate.project_trade || candidate.trade || candidate.project?.trade || candidate.project?.trade_name || '').toLowerCase()
      const referenceName = String(
        candidate.reference_name ||
        candidate.source ||
        candidate.reference?.reference_name ||
        candidate.reference?.name ||
        candidate.referred_by_name ||
        ''
      ).toLowerCase()

      const globalMatch = !normalizedSearch
        ? true
        : (
            candidateName.includes(normalizedSearch) ||
            passport.includes(normalizedSearch) ||
            projectName.includes(normalizedSearch) ||
            trade.includes(normalizedSearch) ||
            referenceName.includes(normalizedSearch)
          )

      const projectMatch = !projectSearch
        ? true
        : (
            candidateName.includes(projectSearch) ||
            passport.includes(projectSearch) ||
            trade.includes(projectSearch) ||
            referenceName.includes(projectSearch)
          )

      return globalMatch && projectMatch
    })

    if (rows.length > 0) {
      acc[projectKey] = rows
    }
    return acc
  }, {})

  const displayKeys = Object.keys(candidatesForDisplay).sort((a, b) => a.localeCompare(b))

  const toggleProject = (projectKey) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectKey]: !prev[projectKey],
    }))
  }

  const isColumnHidden = (label) => hiddenColumns.includes(label)

  const toggleColumnVisibility = (label) => {
    setHiddenColumns((current) => (
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    ))
  }

  const clearHiddenColumns = () => setHiddenColumns([])

  const resetColumnOrder = () => setColumnOrder(getDefaultColumnOrder())

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
    columnDragRef.current = { sourceLabel: label }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', label)
  }

  const handleColumnDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleColumnDrop = (label, event) => {
    event.preventDefault()
    const sourceLabel = columnDragRef.current.sourceLabel || event.dataTransfer.getData('text/plain')
    moveColumn(sourceLabel, label)
    columnDragRef.current = { sourceLabel: '' }
  }

  const handleDragStart = (event) => {
    if (event.button !== undefined && event.button !== 0) return

    const element = event.currentTarget
    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: element.scrollLeft,
      element,
      pointerId: event.pointerId ?? null,
    }
    element.style.cursor = 'grabbing'
    element.style.userSelect = 'none'

    if (typeof element.setPointerCapture === 'function' && event.pointerId != null) {
      element.setPointerCapture(event.pointerId)
    }
  }

  const handleDragMove = (event) => {
    const state = dragStateRef.current
    if (!state.active || !state.element) return

    const delta = event.clientX - state.startX
    state.element.scrollLeft = state.scrollLeft - delta
  }

  const stopDrag = () => {
    const state = dragStateRef.current
    if (state.element) {
      state.element.style.cursor = ''
      state.element.style.userSelect = ''
    }
    dragStateRef.current = { active: false, startX: 0, scrollLeft: 0, element: null }
  }

  const handleDragEnd = (event) => {
    if (event?.pointerId != null && dragStateRef.current.element?.releasePointerCapture) {
      try {
        dragStateRef.current.element.releasePointerCapture(event.pointerId)
      } catch {
        // ignore pointer capture release issues
      }
    }

    stopDrag()
  }

  return (
    <SidebarLayout title="Visa Tracking">
      <div style={pageShellStyle}>
        <div style={heroCardStyle}>
          <div>
            <div style={eyebrowStyle}>Visa Tracking</div>
            <div style={heroTitleStyle}>Visa Tracking</div>
            <div style={heroMetaStyle}>{projectKeys.length} projects • {totalCandidates} candidates</div>
          </div>
          <div style={heroSummaryStyle}>
            <div>
              <div style={heroSummaryValueStyle}>{displayKeys.length}</div>
              <div style={heroSummaryLabelStyle}>Visible groups</div>
            </div>
          </div>
        </div>

        {error && <div style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</div>}
        {loading && <div style={loadingTextStyle}>Loading candidates…</div>}

        {!loading && projectKeys.length > 0 && (
          <>
          <div style={filterBarStyle}>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Filter by project:</label>
              <select
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
                style={selectStyle}
              >
                <option value="">All projects</option>
                {projectKeys.map((projectKey) => (
                  <option key={projectKey} value={projectKey}>{projectKey}</option>
                ))}
              </select>
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Status:</label>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                style={selectStyle}
              >
                <option value="">All statuses</option>
                {CANDIDATE_STATUSES.map((status) => (
                  <option key={status} value={status}>{status.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Search:</label>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Name, passport, or project"
                style={searchInputStyle}
              />
            </div>

            <div style={filterGroupStyle}>
              <button
                type="button"
                onClick={() => setHideEmptyStatusColumns((prev) => !prev)}
                style={buttonStyle}
              >
                {hideEmptyStatusColumns ? 'Show Empty Status Columns' : 'Hide Empty Status Columns'}
              </button>
            </div>

            <div style={filterGroupStyle}>
              <button
                type="button"
                onClick={clearHiddenColumns}
                style={buttonStyle}
              >
                Reset Columns
              </button>
            </div>
          </div>

          </>
        )}

        {!loading && displayKeys.length === 0 && (
          <div style={emptyStateStyle}>No candidates found.</div>
        )}

        {!loading && displayKeys.length > 0 && (
          <div style={{ display: 'grid', gap: 18 }}>
            {displayKeys.map((projectKey) => {
              const rows = candidatesForDisplay[projectKey] || []
              const visibleStatusLabels = getVisibleStatusLabelsForProject(
                rows,
                latestVisaEntryByCandidate,
                hideEmptyStatusColumns,
                trackingStatusLabels
              )
              const projectVisibleColumns = columnOrder.filter((label) => {
                if (hiddenColumns.includes(label)) return false
                if (trackingStatusLabels.includes(label)) {
                  return visibleStatusLabels.includes(label)
                }
                return true
              })

              const totalProjectDemand = Number(rows[0]?.projectDemand ?? 0)
              const projectDeployedCount = rows.filter((candidate) => String(candidate.status || '').toLowerCase() === 'deployed').length
              const projectRemainingDemand = Math.max(totalProjectDemand - projectDeployedCount, 0)

              return (
              <div key={projectKey} style={projectCardStyle}>
                <div style={projectCardHeaderStyle}>
                  <div>
                    <div style={projectTitleStyle}>{projectKey}</div>
                    <div style={{ ...projectMetaStyle, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span>{rows.length} enrolled candidates</span>
                      {rows[0]?.projectDemand != null && (
                        <>
                          <span>{totalProjectDemand} total demand</span>
                          <span style={demandRemainingStyle}>
                            {projectRemainingDemand} remaining demand
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <input
                      value={projectSearchTerms[projectKey] || ''}
                      onChange={(event) =>
                        setProjectSearchTerms((prev) => ({
                          ...prev,
                          [projectKey]: event.target.value,
                        }))
                      }
                      placeholder="Search this project"
                      style={projectSearchInputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => toggleProject(projectKey)}
                      style={buttonStyle}
                    >
                      {expandedProjects[projectKey] ? 'Hide details' : 'Show details'}
                    </button>
                  </div>
                </div>

                <div style={summaryRowStyle}>
                  <div style={summaryCardStyle}>
                    <div style={summaryCardLabelStyle}>Total Demand</div>
                    <div style={summaryCardValueStyle}>{totalProjectDemand}</div>
                  </div>
                  <div style={summaryCardStyle}>
                    <div style={summaryCardLabelStyle}>Enrolled</div>
                    <div style={summaryCardValueStyle}>{rows.length}</div>
                  </div>
                  <div style={summaryCardStyle}>
                    <div style={summaryCardLabelStyle}>Deployed</div>
                    <div style={summaryCardValueStyle}>{projectDeployedCount}</div>
                  </div>
                  <div style={summaryCardStyle}>
                    <div style={summaryCardLabelStyle}>Remaining Demand</div>
                    <div style={summaryCardValueStyle}>{projectRemainingDemand}</div>
                  </div>
                </div>

                {expandedProjects[projectKey] && (
                  <div style={tableWrapStyle}>
                    <div style={dragHintStyle}>Drag headers left or right to reorder columns</div>
                    {hiddenColumns.length > 0 && (
                      <div style={hiddenColumnBarStyle}>
                        <span style={hiddenColumnBarLabelStyle}>Hidden columns:</span>
                        {hiddenColumns.map((label) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => toggleColumnVisibility(label)}
                            style={unhideColumnButtonStyle}
                          >
                            Unhide {label}
                          </button>
                        ))}
                      </div>
                    )}
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {projectVisibleColumns.map((label) => {
                            const isPassportStoreColumn = passportStoreLabels.includes(label)
                            return (
                            <th
                              key={label}
                              draggable
                              onDragStart={(event) => handleColumnDragStart(label, event)}
                              onDragOver={handleColumnDragOver}
                              onDrop={(event) => handleColumnDrop(label, event)}
                              style={{
                                ...thStyle,
                                padding: '10px 8px',
                                cursor: 'grab',
                                ...(STATUS_COLUMN_STYLE_BY_LABEL[label] || DEFAULT_STATUS_COLUMN_STYLE),
                                ...(isPassportStoreColumn ? PASSPORT_STORE_COLUMN_STYLE_BY_LABEL[label] || PASSPORT_STORE_DEFAULT_STATUS_COLUMN_STYLE : null),
                                ...(label === 'Trade' ? tradeHeaderStyle : null),
                                ...(label === 'Name' ? { minWidth: 160 } : null),
                                ...(label === 'Passport No' ? { minWidth: 120 } : null),
                                ...(label === 'Reference Name' ? { minWidth: 150 } : null),
                                ...(label === 'Candidate Status' ? { minWidth: 130 } : null),
                              }}
                            >
                              <div style={headerCellInnerStyle}>
                                <span>{label}</span>
                                <button
                                  type="button"
                                  title={`Hide ${label}`}
                                  aria-label={`Hide ${label}`}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    toggleColumnVisibility(label)
                                  }}
                                  style={hideColumnButtonStyle}
                                >
                                  ×
                                </button>
                              </div>
                            </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((candidate, rowIndex) => (
                          <CandidateRow
                            key={candidate.id}
                            candidate={candidate}
                            visaEntry={latestVisaEntryByCandidate[String(candidate.id)] || null}
                            visibleColumns={projectVisibleColumns}
                            rowIndex={rowIndex}
                            trackingLabels={trackingStatusLabels}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}

const pageShellStyle = {
  padding: 8,
  background: 'linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)',
  minHeight: '100%',
}

const heroCardStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 18,
  padding: '20px 22px',
  borderRadius: 20,
  background: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)',
  border: '1px solid #bfdbfe',
  boxShadow: '0 12px 30px rgba(37, 99, 235, 0.08)',
}

const eyebrowStyle = {
  color: '#1d4ed8',
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const heroTitleStyle = {
  color: '#0f172a',
  fontSize: 28,
  fontWeight: 800,
  marginTop: 4,
}

const heroMetaStyle = {
  color: '#475569',
  fontSize: 13,
  marginTop: 4,
}

const heroSummaryStyle = {
  minWidth: 130,
  padding: '12px 16px',
  borderRadius: 16,
  background: '#ffffff',
  border: '1px solid #bfdbfe',
  textAlign: 'center',
}

const heroSummaryValueStyle = {
  color: '#1d4ed8',
  fontSize: 24,
  fontWeight: 800,
}

const heroSummaryLabelStyle = {
  color: '#64748b',
  fontSize: 12,
}

const loadingTextStyle = {
  color: '#475569',
  fontWeight: 600,
  marginBottom: 12,
}

const filterBarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
  marginBottom: 18,
  padding: 16,
  borderRadius: 16,
  background: '#ffffff',
  border: '1px solid #dbeafe',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
}

const summaryRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 14,
  marginBottom: 18,
}

const summaryCardStyle = {
  padding: '16px 18px',
  borderRadius: 16,
  background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
  border: '1px solid #bfdbfe',
  boxShadow: '0 8px 18px rgba(59, 130, 246, 0.08)',
}

const summaryCardLabelStyle = {
  color: '#475569',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const summaryCardValueStyle = {
  marginTop: 8,
  fontSize: 26,
  fontWeight: 800,
  color: '#0f172a',
}

const filterGroupStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const filterLabelStyle = {
  fontWeight: 700,
  color: '#334155',
}

const selectStyle = {
  minWidth: 220,
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '9px 12px',
  color: '#0f172a',
  background: '#ffffff',
  boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
}

const searchInputStyle = {
  minWidth: 280,
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '9px 12px',
  color: '#0f172a',
  background: '#ffffff',
  boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
}

const projectSearchInputStyle = {
  minWidth: 260,
  border: '1px solid #93c5fd',
  borderRadius: 10,
  padding: '9px 12px',
  color: '#0f172a',
  background: '#ffffff',
  boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
}

const emptyStateStyle = {
  padding: '18px 20px',
  borderRadius: 14,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  color: '#475569',
  fontWeight: 600,
}

const projectCardStyle = {
  border: '1px solid #dbeafe',
  borderRadius: 18,
  overflow: 'hidden',
  background: '#ffffff',
  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.06)',
}

const projectCardHeaderStyle = {
  padding: 18,
  background: 'linear-gradient(135deg, #f8fbff 0%, #f1f5f9 100%)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
}

const projectTitleStyle = {
  fontSize: 18,
  fontWeight: 800,
  color: '#1f2937',
}

const projectMetaStyle = {
  fontSize: 13,
  color: '#475569',
  marginTop: 4,
}

const demandRemainingStyle = {
  padding: '4px 8px',
  borderRadius: 999,
  background: '#ecfdf5',
  color: '#065f46',
  fontSize: 11,
  fontWeight: 800,
}

const tableWrapStyle = {
  padding: 16,
  background: '#ffffff',
  overflowX: 'auto',
  position: 'relative',
  cursor: 'grab',
  userSelect: 'none',
  touchAction: 'pan-y',
}

const dragHintStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  marginBottom: 10,
  padding: '4px 10px',
  borderRadius: 999,
  background: '#eff6ff',
  color: '#2563eb',
  border: '1px solid #bfdbfe',
  fontSize: 11,
  fontWeight: 700,
}

const hiddenColumnBarStyle = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 10,
  marginBottom: 12,
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid #bfdbfe',
  background: '#eff6ff',
}

const hiddenColumnBarLabelStyle = {
  color: '#1d4ed8',
  fontWeight: 800,
  fontSize: 12,
}

const unhideColumnButtonStyle = {
  border: '1px solid #93c5fd',
  background: '#ffffff',
  color: '#1d4ed8',
  padding: '6px 10px',
  borderRadius: 999,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
}

const headerCellInnerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

const hideColumnButtonStyle = {
  border: '1px solid #bfdbfe',
  background: '#ffffff',
  color: '#2563eb',
  width: 22,
  height: 22,
  borderRadius: 999,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  lineHeight: 1,
  fontWeight: 800,
  flex: '0 0 auto',
}

function normalizeProjectKey(value) {
  if (!value || typeof value !== 'string') return ''
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/\s*\d+$/, '').trim()
}

function formatProjectName(projectName) {
  if (!projectName || typeof projectName !== 'string') return ''
  return projectName.replace(/\s*\d+$/, '').trim()
}

function getProjectDisplayName(candidate, projectMap) {
  const id = String(candidate.project_id || candidate.project?.id || candidate.project_id || '')

  if (id && projectMap[id]?.name) {
    return formatProjectName(projectMap[id].name)
  }

  const candidateProjectCandidates = [
    candidate.project_name,
    candidate.project?.project_name,
    candidate.project_number,
    candidate.project?.project_number,
    candidate.project?.name,
  ]

  for (const value of candidateProjectCandidates) {
    const formatted = formatProjectName(String(value || ''))
    if (!formatted) continue

    const normalized = normalizeProjectKey(formatted)
    const matchingProject = Object.values(projectMap).find((project) => {
      const projectName = formatProjectName(project?.name || project?.project_name || '')
      return normalizeProjectKey(projectName) === normalized
    })

    if (matchingProject) {
      return formatProjectName(matchingProject.name || matchingProject.project_name || formatted)
    }

    if (!/^\d+$/.test(formatted)) {
      return formatted
    }
  }

  return 'Unassigned'
}

function getCandidateDisplayName(candidate) {
  return String(candidate.candidate_name || candidate.name || candidate.full_name || 'Unnamed')
}

function getCandidateTrade(candidate) {
  return String(
    candidate.project_trade ||
    candidate.trade ||
    candidate.project?.trade ||
    candidate.project?.trade_name ||
    candidate.project?.project_trade ||
    ''
  ).trim()
}

function getReferenceName(candidate) {
  return String(
    candidate.reference_name ||
    candidate.source ||
    candidate.reference?.reference_name ||
    candidate.reference?.name ||
    candidate.referred_by_name ||
    ''
  ).trim()
}

function normalizeStatusKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[_-]/g, '')
}

function getChecklistStatus(visaEntry, label) {
  const rows = Array.isArray(visaEntry?.manual_checklist) ? visaEntry.manual_checklist : []
  const wanted = normalizeStatusKey(label)
  const matched = rows.find((item) => {
    const byLabel = normalizeStatusKey(item?.label)
    const byKey = normalizeStatusKey(item?.key)
    return byLabel === wanted || byKey === wanted
  })
  return matched?.status || ''
}

function resolveTrackingStatus(visaEntry, label) {
  const fromChecklist = getChecklistStatus(visaEntry, label)
  return fromChecklist || ''
}

function statusColumnsForRow(visaEntry, labels = TRACKING_STATUS_LABELS) {
  return labels.map((label) => ({
    label,
    value: resolveTrackingStatus(visaEntry, label),
  }))
}

function getVisibleStatusLabelsForProject(rows, latestByCandidate, hideEmpty, labels = TRACKING_STATUS_LABELS) {
  if (!hideEmpty) return labels

  return labels.filter((label) => {
    return rows.some((candidate) => {
      const entry = latestByCandidate[String(candidate?.id)] || null
      return Boolean(resolveTrackingStatus(entry, label))
    })
  })
}

function CandidateRow({ candidate, visaEntry, visibleColumns, rowIndex = 0, trackingLabels = TRACKING_STATUS_LABELS }) {
  const statusColumns = statusColumnsForRow(visaEntry, trackingLabels).reduce((acc, column) => {
    acc[column.label] = column.value
    return acc
  }, {})
  const isEven = rowIndex % 2 === 0

  return (
    <tr style={isEven ? rowEvenStyle : rowOddStyle}>
      {visibleColumns.map((label) => {
        if (label === 'Name') {
          return <td key={label} style={tdStyle}>{getCandidateDisplayName(candidate)}</td>
        }

        if (label === 'Passport No') {
          return <td key={label} style={tdStyle}>{candidate.passport_number || candidate.passport || '—'}</td>
        }

        if (label === 'Trade') {
          return <td key={label} style={{ ...tdStyle, ...tradeCellStyle }}>{getCandidateTrade(candidate) || '—'}</td>
        }

        if (label === 'Reference Name') {
          return (
            <td key={label} style={tdStyle}>
              <span style={referenceTagStyle} title={getReferenceName(candidate) || ''}>
                {getReferenceName(candidate) || '—'}
              </span>
            </td>
          )
        }

        if (label === 'Candidate Status') {
          return (
            <td key={label} style={tdStyle}>
              <span style={{ ...statusPillStyle, ...getPipelineStatusBadgeStyle(candidate.status) }}>
                {humanStatus(candidate.status)}
              </span>
            </td>
          )
        }

        const value = statusColumns[label] || ''
        return (
          <td key={label} style={{ ...tdStyle, ...(value ? statusCellFilledStyle : statusCellEmptyStyle) }}>
            {value ? (
              <span style={{ ...statusPillStyle, ...getPipelineStatusBadgeStyle(value) }}>
                {humanStatus(value)}
              </span>
            ) : '—'}
          </td>
        )
      })}
    </tr>
  )
}


function humanStatus(s) {
  const v = String(s || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_')
  if (v === 'registered') return 'Registered'
  if (v === 'deployed') return 'Deployed'
  if (v === 'training') return 'Training'
  if (v === 'processing') return 'Processing'
  if (v === 'shortlisted') return 'Shortlisted'
  if (v === 'received' || v === 'done') return 'Received'
  if (v === 'not_applicable' || v === 'notapplicable' || v === 'na') return 'Not applicable'
  if (v === 'not_done') return 'Not done'
  if (v === '' || v === 'unknown' || v === 'unknown_status') return 'Not received'
  return String(s).trim()
}

function getPipelineStatusBadgeStyle(value) {
  const v = String(value || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_')
  if (v === 'registered') {
    return { background: '#ecfdf5', color: '#065f46', borderColor: '#d1fae5' }
  }

  if (v === 'deployed') {
    return { background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }
  }

  if (v === 'training') {
    return { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }
  }

  if (v === 'processing') {
    return { background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }
  }

  if (v === 'shortlisted') {
    return { background: '#e0f2fe', color: '#035388', borderColor: '#bae6fd' }
  }

  if (v === 'received' || v === 'done') {
    return { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
  }

  if (v === 'not_done') {
    return { background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }
  }

  if (v === 'not_applicable' || v === 'notapplicable') {
    return { background: '#e5e7eb', color: '#475569', borderColor: '#cbd5e1' }
  }

  return { background: '#fee2e2', color: '#9f1239', borderColor: '#fecaca' }
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 10px',
  fontSize: 12,
  lineHeight: 1.25,
  color: '#1e3a5f',
  background: 'linear-gradient(180deg, #f3f8ff 0%, #e7f0ff 100%)',
  borderBottom: '2px solid #e2e8f0',
}

const tdStyle = {
  padding: '10px 10px',
  verticalAlign: 'top',
  fontSize: 12,
  lineHeight: 1.35,
  color: '#1f2937',
  borderBottom: '1px solid #e7eef8',
}

const rowEvenStyle = {
  background: '#ffffff',
}

const rowOddStyle = {
  background: '#f9fbff',
}

const statusCellFilledStyle = {
  background: 'rgba(239, 246, 255, 0.55)',
}

const statusCellEmptyStyle = {
  background: 'rgba(248, 250, 252, 0.9)',
  color: '#94a3b8',
}

const tradeHeaderStyle = {
  minWidth: 320,
}

const tradeCellStyle = {
  minWidth: 320,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  lineHeight: 1.45,
}

const TRACKING_STATUS_LABELS = [
  'Passport',
  'Photo',
  'Medical',
  'PCC',
  'VFS',
  'MOL',
  'Labour Card',
  'VISA',
  'Medical Online',
  'FLA',
  'Ticket',
  'Deployment Status',
  'MOFA',
  'Biometric',
  'SVP',
  'QVC',
]

function getDefaultColumnOrder() {
  return [
    'Name',
    'Passport No',
    'Trade',
    'Reference Name',
    'Candidate Status',
    ...TRACKING_STATUS_LABELS,
  ]
}

const DEFAULT_STATUS_COLUMN_STYLE = { minWidth: 95 }
const PASSPORT_STORE_DEFAULT_STATUS_COLUMN_STYLE = {
  minWidth: 130,
  background: 'linear-gradient(180deg, #e8fff7 0%, #d3f7e7 100%)',
  color: '#065f46',
  borderBottom: '2px solid #86efac',
}

const PASSORT_STORE_LABEL_STYLE = {
  background: '#d1fae5',
  color: '#065f46',
}

const STATUS_COLUMN_STYLE_BY_LABEL = {
  Passport: { minWidth: 105 },
  Photo: { minWidth: 95 },
  Medical: { minWidth: 105 },
  PCC: { minWidth: 90 },
  VFS: { minWidth: 90 },
  MOL: { minWidth: 90 },
  'Labour Card': { minWidth: 125 },
  VISA: { minWidth: 90 },
  'Medical Online': { minWidth: 130 },
  FLA: { minWidth: 90 },
  Ticket: { minWidth: 90 },
  'Deployment Status': { minWidth: 140 },
  MOFA: { minWidth: 95 },
  Biometric: { minWidth: 110 },
  SVP: { minWidth: 90 },
  QVC: { minWidth: 90 },
}

const PASSPORT_STORE_COLUMN_STYLE_BY_LABEL = {
  'Passport In': {
    background: 'linear-gradient(180deg, #ecfdf5 0%, #bbf7d0 100%)',
    color: '#065f46',
    borderBottom: '2px solid #34d399',
  },
  'Passport Out': {
    background: 'linear-gradient(180deg, #f0fdf4 0%, #a7f3d0 100%)',
    color: '#14532d',
    borderBottom: '2px solid #22c55e',
  },
}

const buttonStyle = {
  background: 'linear-gradient(135deg, #eef2ff 0%, #dbeafe 100%)',
  border: '1px solid #93c5fd',
  color: '#1d4ed8',
  padding: '8px 12px',
  borderRadius: 10,
  cursor: 'pointer',
  fontWeight: 700,
  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.12)',
}

const statusPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 8px',
  borderRadius: 9999,
  border: '1px solid transparent',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const referenceTagStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: 180,
  padding: '4px 8px',
  borderRadius: 9999,
  background: '#eff6ff',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
  fontSize: 11,
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  cursor: 'default',
}

const candidateCardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: 18,
  background: '#ffffff',
}
const candidateCardHeaderStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
}

const candidateCardRowStyle = {
  display: 'grid',
  gridTemplateColumns: '180px 1fr',
  gap: 12,
  paddingTop: 6,
  paddingBottom: 6,
  borderBottom: '1px solid #f1f5f9',
}

const candidateCardLabelStyle = {
  color: '#475569',
  fontSize: 13,
  fontWeight: 600,
}
