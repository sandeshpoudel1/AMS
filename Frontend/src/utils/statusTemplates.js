import api from '../api'

export const STATUS_STORAGE_KEY = 'candidate_status_templates_v1'
export const LEGACY_STATUS_STORAGE_KEY = 'document_checklist_templates_v1'
export const PASSPORT_STORE_STATUS_STORAGE_KEY = 'passport_store_status_templates_v1'
export const STATUS_EVENT = 'statusTemplatesUpdated'

export function normalizeStatusTemplateEntries(rows) {
  if (!Array.isArray(rows)) return []

  return rows
    .map((row, index) => {
      if (typeof row === 'string') {
        return {
          key: `tmpl_${index}_${row.trim().toLowerCase().replace(/\s+/g, '_')}`,
          label: row.trim(),
          status: 'not_received',
          manual: true,
        }
      }

      const label = String(row?.label || '').trim()
      if (!label) return null

      return {
        key: row?.key || `tmpl_${index}_${label.toLowerCase().replace(/\s+/g, '_')}`,
        label,
        status: row?.status || 'not_received',
        manual: row?.manual ?? true,
      }
    })
    .filter(Boolean)
}

export function readCachedStatusTemplates() {
  try {
    const raw = localStorage.getItem(STATUS_STORAGE_KEY) || localStorage.getItem(LEGACY_STATUS_STORAGE_KEY) || '[]'
    return normalizeStatusTemplateEntries(JSON.parse(raw))
  } catch {
    return []
  }
}

export function normalizePassportStoreStatusEntries(rows) {
  if (!Array.isArray(rows)) return []

  return rows
    .map((row, index) => {
      if (typeof row === 'string') {
        return {
          key: `passport_store_${index}_${row.trim().toLowerCase().replace(/\s+/g, '_')}`,
          label: row.trim(),
          status: 'not_received',
          manual: true,
        }
      }

      const label = String(row?.label || '').trim()
      if (!label) return null

      return {
        key: row?.key || `passport_store_${index}_${label.toLowerCase().replace(/\s+/g, '_')}`,
        label,
        status: row?.status || 'not_received',
        manual: row?.manual ?? true,
      }
    })
    .filter(Boolean)
}

export function readCachedPassportStoreStatusTemplates() {
  try {
    const raw = localStorage.getItem(PASSPORT_STORE_STATUS_STORAGE_KEY) || '[]'
    return normalizePassportStoreStatusEntries(JSON.parse(raw))
  } catch {
    return []
  }
}

export function writeCachedPassportStoreStatusTemplates(entries) {
  const normalized = normalizePassportStoreStatusEntries(entries)
  localStorage.setItem(PASSPORT_STORE_STATUS_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function defaultPassportStoreStatusTemplates() {
  return normalizePassportStoreStatusEntries([
    { label: 'Original Passport In' },
    { label: 'Original Passport Out' },
  ])
}

export function fetchPassportStoreStatusTemplates() {
  const cached = readCachedPassportStoreStatusTemplates()
  if (cached.length > 0) return cached

  const defaults = defaultPassportStoreStatusTemplates()
  writeCachedPassportStoreStatusTemplates(defaults)
  return defaults
}

export function savePassportStoreStatusTemplates(entries) {
  const normalized = normalizePassportStoreStatusEntries(entries)
  writeCachedPassportStoreStatusTemplates(normalized)
  return normalized
}

export function writeCachedStatusTemplates(entries) {
  const normalized = normalizeStatusTemplateEntries(entries)
  localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export async function fetchStatusTemplates() {
  try {
    const response = await api.get('/settings/status-templates')
    const storageMode = String(response?.data?.meta?.storage || '').toLowerCase()

    // When backend is in fallback mode (table missing), preserve local cached status.
    if (storageMode === 'fallback') {
      return readCachedStatusTemplates()
    }

    const rows = normalizeStatusTemplateEntries(response?.data?.data?.entries)
    writeCachedStatusTemplates(rows)
    return rows
  } catch (error) {
    const statusCode = error?.response?.status
    const errorCode = error?.response?.data?.error_code
    const message = String(error?.response?.data?.message || '').toLowerCase()
    const missingTable = message.includes('status storage table is missing')
      || message.includes('app_settings table is missing')

    if (statusCode === 404 || (statusCode === 503 && (errorCode === 'APP_SETTINGS_TABLE_MISSING' || missingTable))) {
      return readCachedStatusTemplates()
    }
    throw error
  }
}

export async function saveStatusTemplates(entries) {
  const normalized = normalizeStatusTemplateEntries(entries)

  try {
    const response = await api.post('/settings/status-templates', { entries: normalized })
    const saved = normalizeStatusTemplateEntries(response?.data?.data?.entries)
    writeCachedStatusTemplates(saved)
    return saved
  } catch (error) {
    const statusCode = error?.response?.status
    const errorCode = error?.response?.data?.error_code
    const message = String(error?.response?.data?.message || '').toLowerCase()
    const missingTable = message.includes('status storage table is missing')
      || message.includes('app_settings table is missing')

    if (statusCode === 404 || (statusCode === 503 && (errorCode === 'APP_SETTINGS_TABLE_MISSING' || missingTable))) {
      writeCachedStatusTemplates(normalized)
      return normalized
    }
    throw error
  }
}

export function notifyStatusTemplatesUpdated() {
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: {} }))
}