import { useEffect, useMemo, useRef, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import { useAuth } from '../context/AuthContext'
import api from '../api'

const currency = (value) =>
  Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

const normalizeSearchValue = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[^a-z0-9]/g, '')

const DAYBOOK_RECEIPT_DRAFT_KEY = 'daybook_receipt_draft'
const DAYBOOK_PAYMENT_DRAFT_KEY = 'daybook_payment_draft'

const createDaybookForm = (draft = {}) => ({
  company_name: '',
  particulars: '',
  transaction_type: 'cash',
  sub_passport_number: '',
  linked_module: '',
  linked_record_id: '',
  linked_record_name: '',
  amount: '',
  ssf_amount: '',
  welfare_amount: '',
  insurance_amount: '',
  description: '',
  reference_number: '',
  ...draft,
})

const readDraft = (storageKey) => {
  if (typeof window === 'undefined') return null

  try {
    const rawValue = localStorage.getItem(storageKey)
    return rawValue ? JSON.parse(rawValue) : null
  } catch {
    return null
  }
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
    alignItems: 'flex-start',
    padding: '22px 24px',
    borderRadius: '20px',
    color: '#fff',
    background: 'linear-gradient(135deg, #0f2742 0%, #17375c 45%, #1e4b70 100%)',
    boxShadow: '0 18px 40px rgba(15, 39, 66, 0.22)',
  },
  heroCopy: {
    maxWidth: '760px',
  },
  eyebrow: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    opacity: 0.8,
    marginBottom: '8px',
    fontWeight: 700,
  },
  heroTitle: {
    margin: 0,
    fontSize: '28px',
    lineHeight: 1.1,
    fontWeight: 800,
  },
  heroText: {
    margin: '10px 0 0',
    fontSize: '14px',
    lineHeight: 1.6,
    color: 'rgba(255,255,255,0.85)',
  },
  heroStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minWidth: '260px',
    alignItems: 'flex-end',
  },
  heroChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    borderRadius: '999px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.12)',
    color: '#e8f3ff',
    fontSize: '12px',
    fontWeight: 600,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '14px',
  },
  summaryCard: {
    background: 'linear-gradient(165deg, rgba(255,255,255,0.94), rgba(250,253,255,0.88))',
    border: '1px solid #dde6f3',
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 14px 24px rgba(17, 34, 64, 0.08)',
  },
  summaryTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  summaryLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    fontWeight: 700,
  },
  summaryValue: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#0f2742',
    lineHeight: 1.1,
  },
  summaryIconWrap: {
    display: 'grid',
    placeItems: 'center',
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    border: '1px solid rgba(15,77,157,0.12)',
    fontSize: '18px',
  },
  summaryAccentSuccess: {
    color: '#1f7a3f',
  },
  summaryAccentDanger: {
    color: '#c0392b',
  },
  panel: {
    background: '#fff',
    border: '1px solid #dfe7ef',
    borderRadius: '20px',
    boxShadow: '0 12px 28px rgba(15, 39, 66, 0.06)',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '18px 20px 0',
  },
  panelHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  panelTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 800,
    color: '#0f2742',
  },
  panelSubtitle: {
    margin: '6px 0 0',
    fontSize: '13px',
    color: '#64748b',
    lineHeight: 1.5,
  },
  pillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  pill: {
    borderRadius: '999px',
    padding: '8px 12px',
    background: '#eff6ff',
    color: '#12406a',
    fontSize: '12px',
    fontWeight: 700,
  },
  content: {
    padding: '0 20px 20px',
  },
  entrySplitGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
    gap: '16px',
    alignItems: 'start',
  },
  entryColumn: {
    border: '1px solid #dbe5f0',
    borderRadius: '18px',
    background: '#fff',
    boxShadow: '0 8px 20px rgba(15, 39, 66, 0.04)',
    overflow: 'hidden',
  },
  entryColumnHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #e5ecf3',
    background: '#f8fbff',
  },
  entryColumnTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 800,
    color: '#0f2742',
  },
  entryColumnSubTitle: {
    margin: '4px 0 0',
    fontSize: '11px',
    color: '#64748b',
  },
  entryModeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  entryModeCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  entryModeTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 800,
    color: '#0f2742',
  },
  entryModeSubtitle: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b',
    lineHeight: 1.5,
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '14px',
    marginBottom: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    fontWeight: 700,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '12px',
    border: '1px solid #cdd9e5',
    padding: '11px 12px',
    fontSize: '13px',
    color: '#0f172a',
    background: '#fff',
    outline: 'none',
  },
  entityBox: {
    border: '1px solid #dfe7ef',
    borderRadius: '14px',
    padding: '12px',
    background: '#f9fbff',
    marginTop: '12px',
  },
  entityDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  entityMeta: {
    fontSize: '12px',
    color: '#475569',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '12px',
    border: '1px solid #cdd9e5',
    padding: '11px 12px',
    fontSize: '13px',
    color: '#0f172a',
    background: '#fff',
    resize: 'vertical',
    minHeight: '86px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  select: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '12px',
    border: '1px solid #cdd9e5',
    padding: '11px 12px',
    fontSize: '14px',
    color: '#0f172a',
    background: '#fff',
    outline: 'none',
  },
  buttonRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: '6px',
  },
  primaryButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '11px 16px',
    background: '#0f2742',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '11px 16px',
    background: '#fff',
    color: '#0f2742',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    padding: '0 20px',
    borderBottom: '1px solid #e5ecf3',
  },
  tabButton: {
    border: 'none',
    background: 'transparent',
    padding: '14px 2px 12px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#64748b',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
  },
  tabButtonActive: {
    color: '#0f2742',
    borderBottomColor: '#0f2742',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '14px',
    padding: '18px 20px 20px',
  },
  formFull: {
    gridColumn: '1 / -1',
  },
  entryCard: {
    border: '1px solid #dbe5f0',
    borderRadius: '18px',
    background: '#fdfefe',
    padding: '18px 18px 14px',
    boxShadow: '0 8px 20px rgba(15, 39, 66, 0.04)',
  },
  typeSwitch: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  typeSwitchButton: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f2742',
    borderRadius: '999px',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  typeSwitchButtonActive: {
    background: '#0f2742',
    color: '#fff',
    borderColor: '#0f2742',
  },
  quickFillRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  quickFillButton: {
    border: '1px solid #bfdbfe',
    borderRadius: '999px',
    padding: '5px 10px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  quickFillMeta: {
    fontSize: '11px',
    color: '#475569',
    fontWeight: 600,
  },
  alert: {
    padding: '13px 16px',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: 600,
  },
  error: {
    background: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
  },
  success: {
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
  },
  sheetWrap: {
    background: '#fff',
    borderRadius: '20px',
    overflow: 'hidden',
    border: '1px solid #dfe7ef',
    boxShadow: '0 12px 28px rgba(15, 39, 66, 0.06)',
  },
  sheetHeader: {
    padding: '18px 20px',
    borderBottom: '1px solid #e5ecf3',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sheetTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#0f2742',
  },
  sheetMeta: {
    fontSize: '13px',
    color: '#64748b',
  },
  tableScroll: {
    overflowX: 'auto',
  },
  splitLedgerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '16px',
    padding: '16px',
    background: '#f8fbff',
  },
  splitLedgerHalf: {
    background: '#fff',
    border: '1px solid #dfe7ef',
    borderRadius: '16px',
    overflow: 'hidden',
  },
  splitLedgerTitle: {
    padding: '12px 14px',
    fontSize: '13px',
    fontWeight: 800,
    color: '#0f2742',
    borderBottom: '1px solid #e5ecf3',
    background: '#f8fbff',
  },
  table: {
    width: '100%',
    minWidth: '780px',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
    background: '#f8fbff',
    borderBottom: '1px solid #e5ecf3',
    padding: '14px 12px',
    whiteSpace: 'nowrap',
  },
  td: {
    borderBottom: '1px solid #edf2f7',
    padding: '10px',
    fontSize: '13px',
    color: '#0f172a',
    verticalAlign: 'top',
  },
  muted: {
    color: '#64748b',
    fontSize: '12px',
    marginTop: '4px',
    lineHeight: 1.45,
  },
  matchPreview: {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px 10px',
    marginTop: '8px',
    borderRadius: '14px',
    background: '#f1f5f9',
    color: '#334155',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  previewList: {
    margin: 0,
    paddingLeft: '16px',
    color: '#475569',
  },
  previewListItem: {
    marginBottom: '8px',
  },
  previewButton: {
    border: 'none',
    background: 'transparent',
    padding: '8px 10px',
    margin: '0 -10px',
    textAlign: 'left',
    cursor: 'pointer',
    color: 'inherit',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    width: '100%',
    display: 'block',
    borderRadius: '12px',
  },
  previewMeta: {
    color: '#64748b',
    fontSize: '11px',
    marginTop: '2px',
  },
  amountCell: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  receipt: {
    color: '#1f7a3f',
    fontWeight: 800,
  },
  payment: {
    color: '#c0392b',
    fontWeight: 800,
  },
  balance: {
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  receiptBadge: {
    background: '#e7f8ee',
    color: '#1f7a3f',
  },
  paymentBadge: {
    background: '#fdeceb',
    color: '#c0392b',
  },
  emptyState: {
    padding: '42px 20px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
  },
  footerRow: {
    background: '#f8fbff',
    fontWeight: 800,
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    padding: '16px 20px 20px',
    borderTop: '1px solid #e5ecf3',
    flexWrap: 'wrap',
  },
  pagerGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  pagerButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '9px 12px',
    background: '#fff',
    color: '#0f2742',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  rowEditButton: {
    border: '1px solid #93c5fd',
    borderRadius: '8px',
    padding: '6px 10px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  rowEditButtonLocked: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '6px 10px',
    background: '#f3f4f6',
    color: '#6b7280',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'not-allowed',
  },
  trainingPaymentWrap: {
    margin: '16px 20px 20px',
    border: '1px solid #dbe5f0',
    borderRadius: '16px',
    padding: '14px',
    background: '#f8fbff',
  },
  trainingPaymentTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#0f2742',
    marginBottom: '10px',
  },
  trainingFilterRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
    gap: '10px',
    marginBottom: '12px',
  },
  trainingGrid: {
    display: 'grid',
    gridTemplateColumns: '1.9fr 1fr',
    gap: '12px',
    alignItems: 'start',
  },
  trainingPaymentPanel: {
    background: '#fff',
    border: '1px solid #dbe5f0',
    borderRadius: '12px',
    padding: '12px',
  },
  trainingFormGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '8px',
    margin: '8px 0 12px',
  },
  trainingSelectedRow: {
    background: '#ecfeff',
  },
}

export default function Daybook() {
  const [paymentTarget, setPaymentTarget] = useState('company')
  const [receiptTarget, setReceiptTarget] = useState('candidate')
  const [agencies, setAgencies] = useState([])
  const [staff, setStaff] = useState([])
  const [candidates, setCandidates] = useState([])
  const [references, setReferences] = useState([])
  const [bdEntries, setBdEntries] = useState([])
  const [visaEntries, setVisaEntries] = useState([])
  const [trainingEnrollments, setTrainingEnrollments] = useState([])
  const [trainingCompanies, setTrainingCompanies] = useState([])
  const [trades, setTrades] = useState([])
  const [projects, setProjects] = useState([])
  const [subHeads, setSubHeads] = useState([])
  const [subHeadCandidateLinks, setSubHeadCandidateLinks] = useState([])
  const [entries, setEntries] = useState([])
  const [pagination, setPagination] = useState({})
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [highlightEntryId, setHighlightEntryId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [daybookDate, setDaybookDate] = useState(new Date().toISOString().split('T')[0])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [filterType, setFilterType] = useState('')
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const previousFilterDateRef = useRef(filterDate)
  const [trainingPaymentLoading, setTrainingPaymentLoading] = useState(false)
  const [trainingPaymentSearch, setTrainingPaymentSearch] = useState('')
  const [trainingPaymentStatus, setTrainingPaymentStatus] = useState('')
  const [trainingPaymentStartDate, setTrainingPaymentStartDate] = useState('')
  const [trainingPaymentEndDate, setTrainingPaymentEndDate] = useState('')
  const [trainingPaymentPage, setTrainingPaymentPage] = useState(1)
  const [trainingPaymentRows, setTrainingPaymentRows] = useState([])
  const [trainingPaymentPagination, setTrainingPaymentPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [selectedTrainingPaymentId, setSelectedTrainingPaymentId] = useState('')
  const [trainingPaymentSaving, setTrainingPaymentSaving] = useState(false)
  const [trainingPaymentForm, setTrainingPaymentForm] = useState({
    advance_payment_1: '',
    advance_payment_2: '',
    advance_payment_3: '',
    discount_amount: '',
    paid_amount: '',
    payment_reference: '',
  })
  const [receiptForm, setReceiptForm] = useState(() => createDaybookForm(readDraft(DAYBOOK_RECEIPT_DRAFT_KEY) || {}))
  const [paymentForm, setPaymentForm] = useState(() => createDaybookForm(readDraft(DAYBOOK_PAYMENT_DRAFT_KEY) || {}))

  // Auto-calculate opening balance as closing of all non-pending entries before selected filter date
  const { user } = useAuth()
  const isAdminUser = useMemo(() => {
    const role = String(user?.role || user?.role_label || '').toLowerCase().replace(/\s+/g, '_')
    return role === 'admin' || role === 'superadmin' || role === 'super_admin'
  }, [user])
  const roleLower = String(user?.role || user?.role_label || '').toLowerCase().replace(/\s+/g, '_')
  const isSuperAdminUser = roleLower === 'superadmin' || roleLower === 'super_admin'
  const isRestrictedUser = !(roleLower === 'admin' || roleLower === 'superadmin' || roleLower === 'super_admin')

  const computeOpeningBalance = async (forDate) => {
    if (!forDate) return
    try {
      const d = new Date(forDate)
      d.setDate(d.getDate() - 1)
      const prevDate = d.toISOString().split('T')[0]

      // fetch entries up to prevDate
      const res = await api.get('/daybook', { params: { per_page: 1000, start_date: '1900-01-01', end_date: prevDate } })
      const items = Array.isArray(res?.data?.data?.entries) ? res.data.data.entries : []

      // Approval status is informational only; opening balance should reflect all ledger entries
      // regardless of pending/approved/rejected state.
      const included = items.filter((it) => {
        const status = String(it.approval_status || 'approved').toLowerCase()
        return status !== 'rejected'
      })

      const closing = included.reduce((sum, it) => {
        const amt = Number(it.amount || 0)
        return sum + (it.type === 'receipt' ? amt : -amt)
      }, 0)

      setOpeningBalance(closing)
    } catch (err) {
      console.error('computeOpening failed', err)
    }
  }

  useEffect(() => {
    void computeOpeningBalance(filterDate)
  }, [filterDate])

  const getEntryNetEffect = (entry) => {
    if (!entry || !entry.type) return 0
    const amount = Number(entry.amount || 0)
    return entry.type === 'receipt' ? amount : -amount
  }
  const [receiptEditingEntryId, setReceiptEditingEntryId] = useState(null)
  const [paymentEditingEntryId, setPaymentEditingEntryId] = useState(null)
  const [receiptSelectedSubHeadCandidateId, setReceiptSelectedSubHeadCandidateId] = useState('')
  const [receiptSubHeadCandidateSearch, setReceiptSubHeadCandidateSearch] = useState('')
  const [receiptCompanyEntityType, setReceiptCompanyEntityType] = useState('agency')
  const [receiptCompanySearch, setReceiptCompanySearch] = useState('')
  const [receiptSelectedCompanyEntityId, setReceiptSelectedCompanyEntityId] = useState('')
  const [paymentSelectedStaffId, setPaymentSelectedStaffId] = useState('')
  const [paymentCompanyEntityType, setPaymentCompanyEntityType] = useState('agency')
  const [paymentCompanySearch, setPaymentCompanySearch] = useState('')
  const [paymentSelectedCompanyEntityId, setPaymentSelectedCompanyEntityId] = useState('')
  const [paymentSelectedSubHeadCandidateId, setPaymentSelectedSubHeadCandidateId] = useState('')
  const [paymentSubHeadCandidateSearch, setPaymentSubHeadCandidateSearch] = useState('')
  const selectedStaffId = paymentSelectedStaffId

  const loadAgencies = async () => {
    try {
      const response = await api.get('/agencies')
      const nextAgencies = Array.isArray(response?.data?.data) ? response.data.data : []
      setAgencies(nextAgencies)
    } catch {
      setAgencies([])
    }
  }

  const loadStaff = async () => {
    try {
      const response = await api.get('/staff')
      setStaff(response.data.data || [])
    } catch {
      setStaff([])
    }
  }

  const loadCandidates = async () => {
    try {
      const response = await api.get('/candidates', { params: { per_page: 100 } })
      const rows = Array.isArray(response?.data?.data?.candidates) ? response.data.data.candidates : []
      setCandidates(rows)
    } catch {
      setCandidates([])
    }
  }

  const getLinkedLabel = (entry) => {
    if (!entry) return '-'
    if (entry.linked_module === 'candidates') {
      const id = String(entry.linked_record_id || '')
      if (id) {
        const matched = candidates.find((c) => String(c.id) === id)
        if (matched) return matched.full_name || matched.name || matched.display_name || `Candidate #${id}`
        return `Candidate #${id}`
      }
    }

    if (entry.linked_module === 'sub_head') {
      const ref = String(entry.sub_passport_number || entry.linked_record_id || '')
      if (ref.startsWith('candidate:')) {
        const id = String(ref.replace('candidate:', ''))
        const matched = candidates.find((c) => String(c.id) === id)
        if (matched) return matched.full_name || matched.name || `Candidate #${id}`
        return `Candidate #${id}`
      }
      if (ref.startsWith('subhead_link:')) {
        const linkId = String(ref.replace('subhead_link:', ''))
        const link = subHeadCandidateLinks.find((l) => String(l.id) === linkId)
        const cand = link ? candidates.find((c) => String(c.id) === String(link.candidate_id || link.candidate?.id || '')) : null
        if (cand) return cand.full_name || cand.name || `Candidate #${cand.id}`
        return `Sub head link #${linkId}`
      }
      // try match by passport or raw value
      if (ref) {
        const byPassport = candidates.find((c) => String(c.passport_number || c.passport || '') === ref || String(c.id) === ref)
        if (byPassport) return byPassport.full_name || byPassport.name || `Candidate #${byPassport.id}`
      }
    }
    return entry.linked_record_name || entry.company_name || '-'
  }

  const loadTrainingCompanies = async () => {
    try {
      const response = await api.get('/training-companies')
      setTrainingCompanies(Array.isArray(response?.data?.data) ? response.data.data : [])
    } catch {
      setTrainingCompanies([])
    }
  }

  const loadTrainingEnrollments = async () => {
    try {
      const response = await api.get('/training-enrollments', { params: { per_page: 200 } })
      const rows = Array.isArray(response?.data?.data?.enrollments) ? response.data.data.enrollments : []
      setTrainingEnrollments(rows)
    } catch {
      setTrainingEnrollments([])
    }
  }

  const loadTrades = async () => {
    try {
      const response = await api.get('/trainings')
      setTrades(Array.isArray(response?.data?.data) ? response.data.data : [])
    } catch {
      setTrades([])
    }
  }

  const loadProjects = async () => {
    try {
      const response = await api.get('/project-settings')
      setProjects(Array.isArray(response?.data?.data) ? response.data.data : [])
    } catch {
      setProjects([])
    }
  }

  const loadSubHeads = async () => {
    try {
      const response = await api.get('/expense-heads', { params: { is_active: true } })
      setSubHeads(Array.isArray(response?.data?.data) ? response.data.data : [])
    } catch {
      setSubHeads([])
    }
  }

  const loadSubHeadCandidateLinks = async () => {
    try {
      const response = await api.get('/sub-head-candidate-charges', { params: { is_active: true } })
      setSubHeadCandidateLinks(Array.isArray(response?.data?.data) ? response.data.data : [])
    } catch {
      setSubHeadCandidateLinks([])
    }
  }

  const loadReferenceAndBd = async () => {
    try {
      const [referenceResponse, bdResponse] = await Promise.all([
        api.get('/reference-sources'),
        api.get('/bd-sources'),
      ])

      const referenceRows = Array.isArray(referenceResponse?.data?.data) ? referenceResponse.data.data : []
      const bdRows = Array.isArray(bdResponse?.data?.data) ? bdResponse.data.data : []

      setReferences(referenceRows)
      setBdEntries(bdRows)
    } catch {
      setReferences([])
      setBdEntries([])
    }
  }

  const loadVisaEntries = async () => {
    try {
      const response = await api.get('/candidate-flown', { params: { per_page: 300 } })
      const rows = Array.isArray(response?.data?.data?.entries) ? response.data.data.entries : []
      setVisaEntries(rows)
      return rows
    } catch {
      setVisaEntries([])
      return []
    }
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const loadTrainingPaymentRows = async (page = trainingPaymentPage) => {
    setTrainingPaymentLoading(true)
    try {
      const params = {
        page,
        per_page: 20,
      }

      if (trainingPaymentSearch.trim()) params.search = trainingPaymentSearch.trim()
      if (trainingPaymentStatus) params.payment_status = trainingPaymentStatus
      if (trainingPaymentStartDate && trainingPaymentEndDate) {
        params.start_date = trainingPaymentStartDate
        params.end_date = trainingPaymentEndDate
      }

      const response = await api.get('/finance/training-enrollments', { params })
      setTrainingPaymentRows(response.data?.data?.enrollments || [])
      setTrainingPaymentPagination(response.data?.pagination || { current_page: 1, last_page: 1, total: 0 })
      setTrainingPaymentPage(page)
    } catch {
      setTrainingPaymentRows([])
      setTrainingPaymentPagination({ current_page: 1, last_page: 1, total: 0 })
    } finally {
      setTrainingPaymentLoading(false)
    }
  }

  const handleTrainingPaymentSelect = (id) => {
    setSelectedTrainingPaymentId(id)
    const selected = trainingPaymentRows.find((item) => String(item.id) === String(id)) || null
    setTrainingPaymentForm({
      advance_payment_1: selected?.advance_payment_1 ? String(selected.advance_payment_1) : '',
      advance_payment_2: selected?.advance_payment_2 ? String(selected.advance_payment_2) : '',
      advance_payment_3: selected?.advance_payment_3 ? String(selected.advance_payment_3) : '',
      discount_amount: selected?.discount_amount ? String(selected.discount_amount) : '',
      paid_amount: selected?.paid_amount ? String(selected.paid_amount) : '',
      payment_reference: selected?.payment_reference || '',
    })
  }

  const saveTrainingPayment = async () => {
    if (!selectedTrainingPaymentId) {
      setError('Please select a training enrollment to update payment')
      return
    }

    setTrainingPaymentSaving(true)
    clearMessages()
    try {
      const payload = {
        advance_payment_1: Number(trainingPaymentForm.advance_payment_1 || 0),
        advance_payment_2: Number(trainingPaymentForm.advance_payment_2 || 0),
        advance_payment_3: Number(trainingPaymentForm.advance_payment_3 || 0),
        discount_amount: Number(trainingPaymentForm.discount_amount || 0),
        paid_amount: Number(trainingPaymentForm.paid_amount || 0),
        payment_reference: trainingPaymentForm.payment_reference || null,
      }

      const response = await api.put(`/finance/training-enrollments/${selectedTrainingPaymentId}/payment`, payload)
      if (response.data?.success) {
        setSuccess('Training payment updated successfully')
        await loadTrainingPaymentRows(trainingPaymentPage)
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update training payment')
    } finally {
      setTrainingPaymentSaving(false)
    }
  }

  const loadEntries = async (page = 1) => {
    setLoading(true)
    clearMessages()

    try {
      const params = {
        page,
        per_page: 20,
      }

      if (filterType) params.type = filterType
      if (filterDate) {
        params.date = filterDate
      } else if (filterStartDate && filterEndDate) {
        params.start_date = filterStartDate
        params.end_date = filterEndDate
      }
      if (filterSearch) params.search = filterSearch

      const res = await api.get('/daybook', { params })
      console.debug('Daybook list response:', res?.data?.data?.entries?.slice(0, 5))
      setEntries(res.data.data?.entries || [])
      setSummary(res.data.data?.summary || null)
      setPagination(res.data.pagination || {})
      setCurrentPage(page)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load daybook entries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAgencies()
    void loadStaff()
    void loadCandidates()
    void loadTrainingEnrollments()
    void loadTrainingCompanies()
    void loadTrades()
    void loadProjects()
    void loadSubHeads()
    void loadSubHeadCandidateLinks()
    void loadReferenceAndBd()
    void loadVisaEntries()
    void loadEntries(1)
    // Listen for cross-tab/page daybook updates triggered by approvals
    const onStorage = (e) => {
      if (!e) return
      if (e.key === 'daybook_updated_at') {
        // reload current page entries
        void loadEntries(currentPage)
      }
      if (e.key === 'daybook_focus_entry') {
        setHighlightEntryId(e.newValue || null)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterDate, filterStartDate, filterEndDate, filterSearch])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(DAYBOOK_RECEIPT_DRAFT_KEY, JSON.stringify(receiptForm))
  }, [receiptForm])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(DAYBOOK_PAYMENT_DRAFT_KEY, JSON.stringify(paymentForm))
  }, [paymentForm])

  useEffect(() => {
    void loadTrainingPaymentRows(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const autoPaid = Number(trainingPaymentForm.advance_payment_1 || 0)
      + Number(trainingPaymentForm.advance_payment_2 || 0)
      + Number(trainingPaymentForm.advance_payment_3 || 0)
      + Number(trainingPaymentForm.discount_amount || 0)

    const nextValue = String(autoPaid)
    setTrainingPaymentForm((prev) => {
      if (prev.paid_amount === nextValue) return prev
      return {
        ...prev,
        paid_amount: nextValue,
      }
    })
  }, [
    trainingPaymentForm.advance_payment_1,
    trainingPaymentForm.advance_payment_2,
    trainingPaymentForm.advance_payment_3,
    trainingPaymentForm.discount_amount,
  ])

  useEffect(() => {
    const syncStores = () => {
      void loadReferenceAndBd()
      void loadAgencies()
    }
    window.addEventListener('storage', syncStores)
    return () => window.removeEventListener('storage', syncStores)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!highlightEntryId) return
    const el = document.getElementById(`daybook-entry-${highlightEntryId}`)
    if (el) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch (e) {}
      const prev = el.style.boxShadow
      el.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.18)'
      setTimeout(() => { el.style.boxShadow = prev }, 3000)
    }
    try { localStorage.removeItem('daybook_focus_entry') } catch (e) {}
    setHighlightEntryId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, highlightEntryId])

  useEffect(() => {
    if (receiptForm.linked_module !== 'sub_head' || !receiptForm.linked_record_id || !receiptForm.sub_passport_number) {
      setReceiptSelectedSubHeadCandidateId('')
      return
    }

    const linkTokenPrefix = 'subhead_link:'
    const candidateTokenPrefix = 'candidate:'
    const value = String(receiptForm.sub_passport_number)

    if (value.startsWith(linkTokenPrefix) || value.startsWith(candidateTokenPrefix)) {
      setReceiptSelectedSubHeadCandidateId(value)
      return
    }

    const matched = subHeadCandidateLinks.find(
      (link) =>
        String(link.expense_head_id) === String(receiptForm.linked_record_id)
        && (
          String(link.agency_id || '') === value
          || String(link.candidate_id || '') === value
          || String(link.candidate?.passport_number || '') === value
        )
    )

    setReceiptSelectedSubHeadCandidateId(matched ? `subhead_link:${matched.id}` : '')
  }, [receiptForm.linked_module, receiptForm.linked_record_id, receiptForm.sub_passport_number, subHeadCandidateLinks])

  useEffect(() => {
    if (paymentForm.linked_module !== 'sub_head' || !paymentForm.linked_record_id || !paymentForm.sub_passport_number) {
      setPaymentSelectedSubHeadCandidateId('')
      return
    }

    const linkTokenPrefix = 'subhead_link:'
    const candidateTokenPrefix = 'candidate:'
    const value = String(paymentForm.sub_passport_number)

    if (value.startsWith(linkTokenPrefix) || value.startsWith(candidateTokenPrefix)) {
      setPaymentSelectedSubHeadCandidateId(value)
      return
    }

    const matched = subHeadCandidateLinks.find(
      (link) =>
        String(link.expense_head_id) === String(paymentForm.linked_record_id)
        && (
          String(link.agency_id || '') === value
          || String(link.candidate_id || '') === value
          || String(link.candidate?.passport_number || '') === value
        )
    )

    setPaymentSelectedSubHeadCandidateId(matched ? `subhead_link:${matched.id}` : '')
  }, [paymentForm.linked_module, paymentForm.linked_record_id, paymentForm.sub_passport_number, subHeadCandidateLinks])

  const buildSubHeadCandidateOptions = (currentForm) => {
    if (currentForm.linked_module !== 'sub_head' || !currentForm.linked_record_id) {
      return []
    }

    const selectedHeadId = String(currentForm.linked_record_id)
    const headLinks = subHeadCandidateLinks.filter((link) => String(link.expense_head_id) === selectedHeadId)
    const linkedCandidates = headLinks.map((link) => {
      const candidateName = [
        link.candidate?.full_name || null,
        link.candidate?.passport_number ? `Passport ${link.candidate.passport_number}` : null,
        link.candidate?.project?.project_name ? `Project ${link.candidate.project.project_name}` : null,
        link.agency?.company_name ? `Client ${link.agency.company_name}` : null,
      ].filter(Boolean).join(' | ') || 'Candidate / Client'

      const candidateLabel = link.candidate?.full_name
        || link.agency?.company_name
        || 'Candidate / Client'

      const previewSegments = [
        link.candidate?.passport_number ? `Passport ${link.candidate.passport_number}` : null,
        link.candidate?.project?.project_name ? `Project ${link.candidate.project.project_name}` : null,
        link.agency?.company_name ? `Client ${link.agency.company_name}` : null,
        link.amount != null ? `Charge ${currency(link.amount)}` : null,
      ].filter(Boolean)

      const searchText = [
        candidateName,
        candidateLabel,
        link.candidate?.full_name,
        link.candidate?.passport_number,
        link.candidate?.project?.project_name,
        link.agency?.company_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return {
        id: `subhead_link:${link.id}`,
        reference: `subhead_link:${link.id}`,
        linkType: 'subhead',
        candidateName,
        candidateLabel,
        previewSegments,
        passport: link.candidate?.passport_number || '',
        project: link.candidate?.project?.project_name || '',
        client: link.agency?.company_name || '',
        amount: Number(link.amount || 0),
        searchText,
        normalizedSearchText: normalizeSearchValue(searchText),
      }
    })

    const existingCandidateIds = new Set(headLinks
      .filter((link) => link.candidate_id != null)
      .map((link) => String(link.candidate_id))
    )

    const directCandidates = candidates
      .filter((candidate) => !existingCandidateIds.has(String(candidate.id)))
      .map((candidate) => {
        const candidateName = [
          candidate.full_name || null,
          candidate.passport_number ? `Passport ${candidate.passport_number}` : null,
          candidate.project?.project_name ? `Project ${candidate.project.project_name}` : null,
        ].filter(Boolean).join(' | ') || 'Candidate'

        const searchText = [
          candidateName,
          candidate.full_name,
          candidate.passport_number,
          candidate.project?.project_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return {
          id: `candidate:${candidate.id}`,
          reference: `candidate:${candidate.id}`,
          linkType: 'candidate',
          candidateName,
          candidateLabel: candidate.full_name || 'Candidate',
          previewSegments: [
            candidate.passport_number ? `Passport ${candidate.passport_number}` : null,
            candidate.project?.project_name ? `Project ${candidate.project.project_name}` : null,
          ].filter(Boolean),
          passport: candidate.passport_number || '',
          project: candidate.project?.project_name || '',
          client: '',
          amount: 0,
          searchText,
          normalizedSearchText: normalizeSearchValue(searchText),
        }
      })

    return [...linkedCandidates, ...directCandidates]
  }

  const receiptSubHeadCandidateOptions = useMemo(
    () => buildSubHeadCandidateOptions(receiptForm),
    [receiptForm, subHeadCandidateLinks]
  )

  const paymentSubHeadCandidateOptions = useMemo(
    () => buildSubHeadCandidateOptions(paymentForm),
    [paymentForm, subHeadCandidateLinks]
  )

  const receiptFilteredSubHeadCandidateOptions = useMemo(() => {
    const search = receiptSubHeadCandidateSearch.trim().toLowerCase()
    const normalizedSearch = normalizeSearchValue(search)
    return receiptSubHeadCandidateOptions.filter((item) => {
      if (receiptTarget === 'company' && !item.client) return false
      if (!search) return true
      return item.searchText.includes(search)
        || item.normalizedSearchText.includes(normalizedSearch)
        || item.candidateLabel.toLowerCase().includes(search)
    })
  }, [receiptSubHeadCandidateOptions, receiptSubHeadCandidateSearch, receiptTarget])

  const paymentFilteredSubHeadCandidateOptions = useMemo(() => {
    const search = paymentSubHeadCandidateSearch.trim().toLowerCase()
    const normalizedSearch = normalizeSearchValue(search)
    return paymentSubHeadCandidateOptions.filter((item) => {
      if (!search) return true
      return item.searchText.includes(search)
        || item.normalizedSearchText.includes(normalizedSearch)
        || item.candidateLabel.toLowerCase().includes(search)
    })
  }, [paymentSubHeadCandidateOptions, paymentSubHeadCandidateSearch])

  const highlightSearchMatches = (text, query) => {
    if (!query) return text
    const escapedQuery = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escapedQuery})`, 'gi')
    const parts = String(text).split(regex)

    return parts.map((part, index) =>
      regex.test(part) ? (
        <strong key={index} style={{ fontWeight: 700, color: '#0f2742' }}>
          {part}
        </strong>
      ) : (
        <span key={index}>{part}</span>
      )
    )
  }

  const receiptSearchResults = useMemo(
    () => receiptFilteredSubHeadCandidateOptions,
    [receiptFilteredSubHeadCandidateOptions]
  )

  const receiptCompanyOptions = useMemo(() => {
    const searchEntities = {
      agency: agencies,
      project: projects,
      reference: references,
    }[receiptCompanyEntityType] || []

    return searchEntities.map((entity) => {
      if (receiptCompanyEntityType === 'project') {
        const label = entity.project_name || 'Project'
        const searchText = [
          label,
          entity.agency_name,
          entity.project_reference_code,
          entity.bd,
        ].filter(Boolean).join(' ').toLowerCase()

        return {
          id: `project:${entity.id}`,
          reference: `project:${entity.id}`,
          entityType: 'project',
          candidateLabel: label,
          previewSegments: [
            entity.agency_name ? `Client ${entity.agency_name}` : null,
            entity.project_reference_code ? `Ref ${entity.project_reference_code}` : null,
            entity.bd ? `BD ${entity.bd}` : null,
          ].filter(Boolean),
          company: entity.agency_name || '',
          project: entity.project_name || '',
          client: entity.agency_name || '',
          reference: entity.project_reference_code || '',
          amount: 0,
          entityData: entity,
          searchText,
          normalizedSearchText: normalizeSearchValue(searchText),
        }
      }

      if (receiptCompanyEntityType === 'reference') {
        const label = entity.reference_name || 'Reference'
        const searchText = [
          label,
          entity.source_company,
          entity.contact_number,
          entity.email,
        ].filter(Boolean).join(' ').toLowerCase()

        return {
          id: `reference:${entity.id}`,
          reference: `reference:${entity.id}`,
          entityType: 'reference',
          candidateLabel: label,
          previewSegments: [
            entity.source_company ? `Company ${entity.source_company}` : null,
            entity.contact_number ? `Phone ${entity.contact_number}` : null,
            entity.email ? `Email ${entity.email}` : null,
          ].filter(Boolean),
          company: entity.source_company || '',
          project: '',
          client: entity.source_company || '',
          reference: entity.reference_name || '',
          amount: 0,
          entityData: entity,
          searchText,
          normalizedSearchText: normalizeSearchValue(searchText),
        }
      }

      const label = entity.company_name || 'Client'
      const searchText = [
        label,
        entity.contact_person,
        entity.phone,
        entity.email,
      ].filter(Boolean).join(' ').toLowerCase()

      return {
        id: `agency:${entity.id}`,
        reference: `agency:${entity.id}`,
        entityType: 'agency',
        candidateLabel: label,
        previewSegments: [
          entity.contact_person ? `Contact ${entity.contact_person}` : null,
          entity.phone ? `Phone ${entity.phone}` : null,
          entity.email ? `Email ${entity.email}` : null,
        ].filter(Boolean),
        company: entity.company_name || '',
        project: '',
        client: entity.company_name || '',
        reference: '',
        amount: 0,
        entityData: entity,
        searchText,
        normalizedSearchText: normalizeSearchValue(searchText),
      }
    })
  }, [receiptCompanyEntityType, agencies, projects, references])

  const receiptCompanySearchResults = useMemo(() => {
    const search = receiptCompanySearch.trim().toLowerCase()
    const normalizedSearch = normalizeSearchValue(search)

    return receiptCompanyOptions.filter((item) => {
      if (!search) return true
      return item.searchText.includes(search) || item.normalizedSearchText.includes(normalizedSearch)
    })
  }, [receiptCompanyOptions, receiptCompanySearch])

  const selectedReceiptCompanyEntity = useMemo(
    () => receiptCompanyOptions.find((item) => item.id === receiptSelectedCompanyEntityId) || null,
    [receiptCompanyOptions, receiptSelectedCompanyEntityId]
  )

  const paymentSearchResults = useMemo(
    () => paymentFilteredSubHeadCandidateOptions,
    [paymentFilteredSubHeadCandidateOptions]
  )

  const selectedReceiptSubHeadCandidate = useMemo(
    () => receiptSubHeadCandidateOptions.find((item) => item.id === receiptSelectedSubHeadCandidateId) || null,
    [receiptSubHeadCandidateOptions, receiptSelectedSubHeadCandidateId, receiptTarget]
  )

  const paymentCompanyOptions = useMemo(() => {
    const searchEntities = {
      agency: agencies,
      project: projects,
      reference: references,
    }[paymentCompanyEntityType] || []

    return searchEntities.map((entity) => {
      if (paymentCompanyEntityType === 'project') {
        const label = entity.project_name || 'Project'
        const searchText = [
          label,
          entity.agency_name,
          entity.project_reference_code,
          entity.bd,
        ].filter(Boolean).join(' ').toLowerCase()

        return {
          id: `project:${entity.id}`,
          reference: `project:${entity.id}`,
          entityType: 'project',
          candidateLabel: label,
          previewSegments: [
            entity.agency_name ? `Client ${entity.agency_name}` : null,
            entity.project_reference_code ? `Ref ${entity.project_reference_code}` : null,
            entity.bd ? `BD ${entity.bd}` : null,
          ].filter(Boolean),
          company: entity.agency_name || '',
          project: entity.project_name || '',
          client: entity.agency_name || '',
          reference: entity.project_reference_code || '',
          amount: 0,
          entityData: entity,
          searchText,
          normalizedSearchText: normalizeSearchValue(searchText),
        }
      }

      if (paymentCompanyEntityType === 'reference') {
        const label = entity.reference_name || 'Reference'
        const searchText = [
          label,
          entity.source_company,
          entity.contact_number,
          entity.email,
        ].filter(Boolean).join(' ').toLowerCase()

        return {
          id: `reference:${entity.id}`,
          reference: `reference:${entity.id}`,
          entityType: 'reference',
          candidateLabel: label,
          previewSegments: [
            entity.source_company ? `Company ${entity.source_company}` : null,
            entity.contact_number ? `Phone ${entity.contact_number}` : null,
            entity.email ? `Email ${entity.email}` : null,
          ].filter(Boolean),
          company: entity.source_company || '',
          project: '',
          client: entity.source_company || '',
          reference: entity.reference_name || '',
          amount: 0,
          entityData: entity,
          searchText,
          normalizedSearchText: normalizeSearchValue(searchText),
        }
      }

      const label = entity.company_name || 'Salary'
      const searchText = [
        label,
        entity.contact_person,
        entity.phone,
        entity.email,
      ].filter(Boolean).join(' ').toLowerCase()

      return {
        id: `agency:${entity.id}`,
        reference: `agency:${entity.id}`,
        entityType: 'agency',
        candidateLabel: label,
        previewSegments: [
          entity.contact_person ? `Contact ${entity.contact_person}` : null,
          entity.phone ? `Phone ${entity.phone}` : null,
          entity.email ? `Email ${entity.email}` : null,
        ].filter(Boolean),
        company: entity.company_name || '',
        project: '',
        client: entity.company_name || '',
        reference: '',
        amount: 0,
        entityData: entity,
        searchText,
        normalizedSearchText: normalizeSearchValue(searchText),
      }
    })
  }, [paymentCompanyEntityType, agencies, projects, references])

  const paymentCompanySearchResults = useMemo(() => {
    const search = paymentCompanySearch.trim().toLowerCase()
    const normalizedSearch = normalizeSearchValue(search)

    return paymentCompanyOptions.filter((item) => {
      if (!search) return true
      return item.searchText.includes(search) || item.normalizedSearchText.includes(normalizedSearch)
    })
  }, [paymentCompanyOptions, paymentCompanySearch])

  const selectedPaymentCompanyEntity = useMemo(
    () => paymentCompanyOptions.find((item) => item.id === paymentSelectedCompanyEntityId) || null,
    [paymentCompanyOptions, paymentSelectedCompanyEntityId]
  )

  const selectedPaymentSubHead = useMemo(
    () => subHeads.find((item) => String(item.id) === String(paymentForm.linked_record_id)) || null,
    [subHeads, paymentForm.linked_record_id]
  )

  const selectedPaymentSubHeadCandidate = useMemo(
    () => paymentSubHeadCandidateOptions.find((item) => item.id === paymentSelectedSubHeadCandidateId) || null,
    [paymentSubHeadCandidateOptions, paymentSelectedSubHeadCandidateId]
  )

  const handleSubHeadCandidateChange = (entryType, candidateId) => {
    const isReceipt = entryType === 'receipt'
    const selectedCandidate = (isReceipt ? receiptSubHeadCandidateOptions : paymentSubHeadCandidateOptions)
      .find((item) => item.id === candidateId)
    const selectedHead = subHeads.find((item) => String(item.id) === (isReceipt ? receiptForm.linked_record_id : paymentForm.linked_record_id))

    if (isReceipt) {
      setReceiptSelectedSubHeadCandidateId(candidateId)
      setReceiptSubHeadCandidateSearch('')
      setReceiptForm((current) => ({
        ...current,
        linked_module: 'sub_head',
        linked_record_id: current.linked_record_id || String(selectedHead?.id || ''),
        sub_passport_number: selectedCandidate?.reference || '',
        amount: current.amount || (selectedCandidate ? String(selectedCandidate.amount) : ''),
        linked_record_name: selectedHead && selectedCandidate
          ? `${selectedHead.name} - ${selectedCandidate.candidateName}`
          : (selectedHead?.name || current.linked_record_name),
        description: current.description || (selectedCandidate
          ? `Sub head charge for ${selectedCandidate.candidateName}`
          : current.description),
      }))
      return
    }

    setPaymentSelectedSubHeadCandidateId(candidateId)
    setPaymentForm((current) => ({
      ...current,
      linked_module: 'sub_head',
      linked_record_id: current.linked_record_id || String(selectedHead?.id || ''),
      sub_passport_number: selectedCandidate?.reference || '',
      amount: current.amount || (selectedCandidate ? String(selectedCandidate.amount) : ''),
      linked_record_name: selectedHead && selectedCandidate
        ? `${selectedHead.name} - ${selectedCandidate.candidateName}`
        : (selectedHead?.name || current.linked_record_name),
      description: current.description || (selectedCandidate
        ? `Sub head charge for ${selectedCandidate.candidateName}`
        : current.description),
    }))
  }

  const resetForm = (entryType) => {
    const defaultAgency = agencies[0]?.company_name || ''
    const defaultStaff = staff[0] || null
    if (entryType === 'receipt') {
      setReceiptEditingEntryId(null)
      setReceiptForm(createDaybookForm({
        company_name: defaultAgency,
        particulars: '',
        transaction_type: 'cash',
        sub_passport_number: '',
        linked_module: '',
        linked_record_id: '',
        linked_record_name: '',
        amount: '',
        description: '',
        reference_number: '',
      }))
      setReceiptSelectedSubHeadCandidateId('')
      return
    }

    setPaymentEditingEntryId(null)
    setPaymentForm(createDaybookForm({
      company_name: paymentTarget === 'staff'
        ? (defaultStaff?.full_name || defaultAgency)
        : defaultAgency,
      particulars: '',
      transaction_type: 'cash',
      sub_passport_number: '',
      linked_module: '',
      linked_record_id: '',
      linked_record_name: '',
      amount: paymentTarget === 'staff' ? (defaultStaff?.base_salary || '') : '',
      description: '',
      reference_number: '',
    }))
    setPaymentSelectedStaffId(paymentTarget === 'staff' && defaultStaff ? String(defaultStaff.id) : '')
    setPaymentSelectedSubHeadCandidateId('')
    setPaymentCompanyEntityType('agency')
    setPaymentCompanySearch('')
    setPaymentSelectedCompanyEntityId('')
  }

  const submitEntry = async (entryType, currentForm, currentEditingEntryId) => {
    clearMessages()

    if (!currentForm.particulars || !String(currentForm.particulars).trim()) {
      setError('Particulars is required')
      return
    }

    if (!currentForm.amount) {
      setError('Amount is required')
      return
    }

    if (currentForm.linked_module === 'sub_head' && (!currentForm.linked_record_id || !currentForm.sub_passport_number)) {
      setError('Select a sub-head and candidate/reference before saving.')
      return
    }

    setSaving(true)
    // Prevent finance officer from updating entries past the edit window
    if (currentEditingEntryId) {
      const existing = entries.find((it) => Number(it.id) === Number(currentEditingEntryId))
      if (existing?.approval_status === 'approved' && !isSuperAdminUser) {
        setError('Approved daybook entries can only be edited by superadmin.')
        return
      }
      if (existing && isEntryPastEditWindow(existing) && isRestrictedUser) {
        setError('This ledger entry is locked for editing after 72 hours.')
        return
      }
    }

    try {
      const payload = {
        entry_date: daybookDate,
        type: entryType,
        expense_head_id: currentForm.linked_module === 'sub_head' && currentForm.linked_record_id
          ? Number(currentForm.linked_record_id)
          : null,
        linked_module: currentForm.linked_module || null,
        linked_record_id: currentForm.linked_record_id || null,
        linked_record_name: currentForm.linked_record_name || null,
        company_name: currentForm.company_name,
        particulars: currentForm.particulars,
        transaction_type: currentForm.transaction_type,
        sub_passport_number: currentForm.sub_passport_number,
        amount: Number(currentForm.amount),
        description: currentForm.description,
        reference_number: currentForm.reference_number,
      }

      // include SSF/Welfare/Insurance for payment entries so they persist and display on ledger
      if (entryType === 'payment') {
        payload.ssf_amount = Number(currentForm.ssf_amount || 0)
        payload.welfare_amount = Number(currentForm.welfare_amount || 0)
        payload.insurance_amount = Number(currentForm.insurance_amount || 0)
      }

      if (currentEditingEntryId) {
        const resp = await api.put(`/daybook/${currentEditingEntryId}`, payload)
        console.debug('Daybook update response:', resp?.data)
        setSuccess('Daybook entry updated successfully')
      } else {
        const resp = await api.post('/daybook', payload)
        console.debug('Daybook create response:', resp?.data)
        setSuccess(`${entryType === 'receipt' ? 'Receipt' : 'Payment'} added successfully`)
      }

      // If this daybook entry is linked to a visa pipeline entry, refresh visa entries
      if (payload.linked_module === 'visa_pipeline' && payload.linked_record_id) {
        const rows = await loadVisaEntries()
        const updated = rows.find((e) => String(e.id) === String(payload.linked_record_id)) || null
        if (updated) {
          window.dispatchEvent(new CustomEvent('visaPipelineUpdated', { detail: { candidateId: updated.candidate_id } }))
        } else {
          window.dispatchEvent(new CustomEvent('visaPipelineUpdated', { detail: {} }))
        }
      }

      // If this daybook entry is linked to a sub-head, try to resolve the candidate and notify listeners
      if (payload.linked_module === 'sub_head') {
        let candidateId = null

        const ref = String(payload.sub_passport_number || '')
        // ref may be like 'subhead_link:<id>' or 'candidate:<id>' or a passport number
        if (ref.startsWith('subhead_link:')) {
          const linkId = String(ref.replace('subhead_link:', ''))
          const matched = (subHeadCandidateLinks || []).find((l) => String(l.id) === linkId)
          if (matched) candidateId = matched.candidate_id || matched.candidate?.id || null
        } else if (ref.startsWith('candidate:')) {
          candidateId = String(ref.replace('candidate:', ''))
        } else if (ref) {
          const byPassport = (candidates || []).find((c) => String(c.passport_number || c.passport || '') === ref || String(c.id) === ref)
          if (byPassport) candidateId = byPassport.id
        }

        if (candidateId) {
          window.dispatchEvent(new CustomEvent('visaPipelineUpdated', { detail: { candidateId } }))
        } else {
          // fallback notify so views can decide to reload broadly
          window.dispatchEvent(new CustomEvent('visaPipelineUpdated', { detail: {} }))
        }
      }

      resetForm(entryType)
      loadEntries(currentPage)
      // recompute opening balance after edit/create to keep running totals correct
      void computeOpeningBalance(filterDate)
    } catch (e) {
      setError(e.response?.data?.message || (currentEditingEntryId ? 'Failed to update daybook entry' : `Failed to add ${entryType}`))
    } finally {
      setSaving(false)
    }
  }

  const handleReceiptSubmit = async (e) => {
    e.preventDefault()
    // Confirm for both create and update to prevent accidental changes
    {
      const action = receiptEditingEntryId ? 'update this receipt' : 'add this receipt'
      const confirmed = window.confirm(`Are you sure you want to ${action} ${receiptForm.particulars || ''}?`)
      if (!confirmed) return
    }
    await submitEntry('receipt', receiptForm, receiptEditingEntryId)
  }

  const handlePaymentSubmit = async (e) => {
    e.preventDefault()
    // Confirm for both create and update to prevent accidental changes
    {
      const action = paymentEditingEntryId ? 'update this payment' : 'add this payment'
      const confirmed = window.confirm(`Are you sure you want to ${action} ${paymentForm.particulars || ''}?`)
      if (!confirmed) return
    }
    await submitEntry('payment', paymentForm, paymentEditingEntryId)
  }

  const isEntryPastEditWindow = (entry) => {
    const dateValue = entry?.entry_date || entry?.created_at
    if (!dateValue) return false
    const entryDate = new Date(dateValue)
    if (Number.isNaN(entryDate.getTime())) return false
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60))
    return diffHours > 72
  }

  const isEntryLockedForEdit = (entry) => {
    if (!entry) return false
    if (entry.approval_status === 'approved' && !isSuperAdminUser) return true
    return isEntryPastEditWindow(entry) && isRestrictedUser
  }

  const handleEditEntry = (entry) => {
    // Approved entries may only be edited by superadmin; other users remain locked.
    if (entry?.approval_status === 'approved' && !isSuperAdminUser) {
      setError('Approved daybook entries can only be edited by superadmin.')
      return
    }

    if (isEntryPastEditWindow(entry) && isRestrictedUser) {
      setError('This ledger entry is locked for editing after 72 hours.')
      return
    }

    setDaybookDate(String(entry.entry_date || daybookDate).slice(0, 10))

    const linkedId = entry.linked_record_id == null ? '' : String(entry.linked_record_id)
    const matchedStaff = entry.type === 'payment' && staff.find((member) => String(member.id) === String(entry.sub_passport_number || ''))

    if (entry.type === 'payment') {
      setPaymentEditingEntryId(entry.id)
      setPaymentTarget(matchedStaff ? 'staff' : 'company')
      setPaymentSelectedStaffId(matchedStaff ? String(matchedStaff.id) : '')
      setPaymentForm({
        company_name: entry.company_name || '',
        particulars: entry.particulars || '',
        transaction_type: entry.transaction_type || 'cash',
        sub_passport_number: entry.sub_passport_number || '',
        linked_module: entry.linked_module || '',
        linked_record_id: linkedId,
        linked_record_name: entry.linked_record_name || '',
        amount: entry.amount == null ? '' : String(entry.amount),
        ssf_amount: entry.ssf_amount == null ? (entry.ssf == null ? '' : String(entry.ssf)) : String(entry.ssf_amount),
        welfare_amount: entry.welfare_amount == null ? (entry.welfare == null ? '' : String(entry.welfare)) : String(entry.welfare_amount),
        insurance_amount: entry.insurance_amount == null ? (entry.insurance == null ? '' : String(entry.insurance)) : String(entry.insurance_amount),
        description: entry.description || '',
        reference_number: entry.reference_number || '',
      })

      if (!matchedStaff && ['agencies', 'project', 'reference'].includes(entry.linked_module)) {
        const entityType = entry.linked_module === 'agencies' ? 'agency' : entry.linked_module
        setPaymentCompanyEntityType(entityType)
        setPaymentSelectedCompanyEntityId(`${entityType}:${linkedId}`)
        setPaymentCompanySearch('')
      } else if (!matchedStaff && entry.linked_module === 'sub_head') {
        setPaymentCompanyEntityType('candidate')
        setPaymentSelectedCompanyEntityId('')
        setPaymentCompanySearch('')
      } else {
        setPaymentCompanyEntityType('agency')
        setPaymentSelectedCompanyEntityId('')
        setPaymentCompanySearch('')
      }

      return
    }

    setReceiptEditingEntryId(entry.id)
    setReceiptForm({
      company_name: entry.company_name || '',
      particulars: entry.particulars || '',
      transaction_type: entry.transaction_type || 'cash',
      sub_passport_number: entry.sub_passport_number || '',
      linked_module: entry.linked_module || '',
      linked_record_id: linkedId,
      linked_record_name: entry.linked_record_name || '',
      amount: entry.amount == null ? '' : String(entry.amount),
      ssf_amount: entry.ssf_amount == null ? (entry.ssf == null ? '' : String(entry.ssf)) : String(entry.ssf_amount),
      welfare_amount: entry.welfare_amount == null ? (entry.welfare == null ? '' : String(entry.welfare)) : String(entry.welfare_amount),
      insurance_amount: entry.insurance_amount == null ? (entry.insurance == null ? '' : String(entry.insurance)) : String(entry.insurance_amount),
      description: entry.description || '',
      reference_number: entry.reference_number || '',
    })

    if (['agencies', 'project', 'reference'].includes(entry.linked_module)) {
      setReceiptTarget('company')
      setReceiptCompanyEntityType(entry.linked_module === 'agencies' ? 'agency' : entry.linked_module)
      setReceiptSelectedCompanyEntityId(`${entry.linked_module === 'agencies' ? 'agency' : entry.linked_module}:${linkedId}`)
    } else {
      setReceiptTarget('candidate')
      setReceiptSelectedCompanyEntityId('')
    }
  }

  const handleStaffChange = (e) => {
    const nextStaffId = e.target.value
    setPaymentSelectedStaffId(nextStaffId)

    const nextStaff = staff.find((member) => String(member.id) === nextStaffId) || null

    setPaymentForm((current) => ({
      ...current,
      company_name: nextStaff?.full_name || '',
      amount: nextStaff?.base_salary || current.amount,
      description: nextStaff
        ? `${nextStaff.position || 'Staff'} salary payment${nextStaff.department ? ` - ${nextStaff.department}` : ''}`
        : current.description,
      sub_passport_number: nextStaff?.id ? String(nextStaff.id) : current.sub_passport_number,
      linked_module: nextStaff ? 'staff' : current.linked_module,
      linked_record_id: nextStaff ? String(nextStaff.id) : current.linked_record_id,
      linked_record_name: nextStaff ? nextStaff.full_name : current.linked_record_name,
    }))
  }

  const handleSubHeadChange = (e) => {
    const nextSubHeadId = e.target.value
    const selectedSubHead = subHeads.find((item) => String(item.id) === nextSubHeadId) || null

    setReceiptForm((current) => ({
      ...current,
      company_name: selectedSubHead?.name || '',
      linked_module: nextSubHeadId ? 'sub_head' : '',
      linked_record_id: nextSubHeadId,
      linked_record_name: selectedSubHead?.name || '',
    }))
    setReceiptSelectedSubHeadCandidateId('')
    setReceiptSubHeadCandidateSearch('')
  }

  const handleReceiptCompanyTypeChange = (type) => {
    setReceiptCompanyEntityType(type)
    setReceiptCompanySearch('')
    setReceiptSelectedCompanyEntityId('')
    setReceiptForm((current) => ({
      ...current,
      linked_module: '',
      linked_record_id: '',
      linked_record_name: '',
      sub_passport_number: '',
    }))
  }

  const handleReceiptCompanyEntitySelect = (entityId) => {
    const selectedEntity = receiptCompanyOptions.find((item) => item.id === entityId) || null
    if (!selectedEntity) return

    const linkedModule = selectedEntity.entityType === 'agency'
      ? 'agencies'
      : selectedEntity.entityType === 'project'
        ? 'project'
        : 'reference'

    setReceiptSelectedCompanyEntityId(entityId)
    setReceiptCompanySearch('')
    setReceiptForm((current) => ({
      ...current,
      linked_module: linkedModule,
      linked_record_id: String(selectedEntity.entityData.id),
      linked_record_name: selectedEntity.candidateLabel,
      company_name: selectedEntity.company || selectedEntity.project || selectedEntity.reference || current.company_name,
      sub_passport_number: '',
      description: current.description || `Receipt for ${selectedEntity.candidateLabel}`,
    }))
  }

  const handlePaymentCompanyTypeChange = (type) => {
    setPaymentCompanyEntityType(type)
    setPaymentCompanySearch('')
    setPaymentSelectedCompanyEntityId('')
    setPaymentSelectedSubHeadCandidateId('')
    setPaymentSubHeadCandidateSearch('')
    setPaymentForm((current) => ({
      ...current,
      linked_module: '',
      linked_record_id: '',
      linked_record_name: '',
      sub_passport_number: '',
    }))
  }

  const handlePaymentCompanyEntitySelect = (entityId) => {
    const selectedEntity = paymentCompanyOptions.find((item) => item.id === entityId) || null
    if (!selectedEntity) return

    const linkedModule = selectedEntity.entityType === 'agency'
      ? 'agencies'
      : selectedEntity.entityType === 'project'
        ? 'project'
        : 'reference'

    setPaymentSelectedCompanyEntityId(entityId)
    setPaymentCompanySearch('')
    setPaymentForm((current) => ({
      ...current,
      linked_module: linkedModule,
      linked_record_id: String(selectedEntity.entityData.id),
      linked_record_name: selectedEntity.candidateLabel,
      company_name: selectedEntity.company || selectedEntity.project || selectedEntity.reference || current.company_name,
      sub_passport_number: '',
      description: current.description || `Payment for ${selectedEntity.candidateLabel}`,
    }))
  }

  const handlePaymentSubHeadChange = (e) => {
    const nextSubHeadId = e.target.value
    const selectedSubHead = subHeads.find((item) => String(item.id) === nextSubHeadId) || null

    setPaymentForm((current) => ({
      ...current,
      company_name: paymentTarget === 'others' ? '' : (selectedSubHead?.name || ''),
      linked_module: nextSubHeadId ? 'sub_head' : '',
      linked_record_id: nextSubHeadId,
      linked_record_name: selectedSubHead?.name || '',
      sub_passport_number: paymentTarget === 'others' ? '' : current.sub_passport_number,
    }))
    setPaymentSelectedSubHeadCandidateId('')
    setPaymentSubHeadCandidateSearch('')
  }

  const handlePaymentCompanyChange = (e) => {
    const nextCompanyName = e.target.value
    setPaymentForm((current) => ({
      ...current,
      company_name: nextCompanyName,
      description: current.description || 'Company payment entry',
      amount: current.amount,
      sub_passport_number: '',
      reference_number: current.reference_number,
    }))
  }

  const getVisaFinancialSnapshot = (entry = null) => {
    if (!entry) {
      return { totalFee: 0, received: 0, due: 0 }
    }

    const totalFee = Number(entry.total_fee || 0)
    const received = Number(entry.advance_1 || 0) + Number(entry.advance_2 || 0) + Number(entry.advance_3 || 0)
    const due = Math.max(totalFee - received, 0)

    return { totalFee, received, due }
  }

  const selectedReceiptVisaEntry = useMemo(() => {
    if (receiptForm.linked_module !== 'visa_pipeline' || !receiptForm.linked_record_id) return null
    return visaEntries.find((entry) => String(entry.id) === String(receiptForm.linked_record_id)) || null
  }, [receiptForm.linked_module, receiptForm.linked_record_id, visaEntries])

  const selectedPaymentVisaEntry = useMemo(() => {
    if (paymentForm.linked_module !== 'visa_pipeline' || !paymentForm.linked_record_id) return null
    return visaEntries.find((entry) => String(entry.id) === String(paymentForm.linked_record_id)) || null
  }, [paymentForm.linked_module, paymentForm.linked_record_id, visaEntries])

  const receiptVisaSnapshot = useMemo(
    () => getVisaFinancialSnapshot(selectedReceiptVisaEntry),
    [selectedReceiptVisaEntry]
  )

  const paymentVisaSnapshot = useMemo(
    () => getVisaFinancialSnapshot(selectedPaymentVisaEntry),
    [selectedPaymentVisaEntry]
  )

  const applyVisaAmountQuickFill = (entryType, amountType) => {
    const isReceipt = entryType === 'receipt'
    const selectedVisa = isReceipt ? selectedReceiptVisaEntry : selectedPaymentVisaEntry

    if (!selectedVisa) return

    const snapshot = getVisaFinancialSnapshot(selectedVisa)
    const amountValue = amountType === 'due' ? snapshot.due : snapshot.received

    if (isReceipt) {
      setReceiptForm((current) => ({
        ...current,
        amount: String(amountValue),
      }))
      return
    }

    setPaymentForm((current) => ({
      ...current,
      amount: String(amountValue),
    }))
  }

  const applyVisaBreakdownQuickFill = () => {
    const selectedVisa = selectedPaymentVisaEntry
    if (!selectedVisa) return

    const ssfKeys = ['ssf', 'ssf_amount', 'ssf_fee', 'ssfFee', 'fee_ssf']
    const welfareKeys = ['welfare', 'welfare_amount', 'welfare_fee', 'welfareFee', 'fee_welfare']
    const insuranceKeys = ['insurance', 'insurance_amount', 'insurance_fee', 'insuranceFee', 'fee_insurance']

    const findVal = (keys) => {
      for (const k of keys) {
        if (typeof selectedVisa[k] !== 'undefined' && selectedVisa[k] !== null) return Number(selectedVisa[k])
      }
      return null
    }

    const ssf = findVal(ssfKeys)
    const welfare = findVal(welfareKeys)
    const insurance = findVal(insuranceKeys)

    if (ssf === null && welfare === null && insurance === null) {
      setError('Selected visa has no SSF/Welfare/Insurance breakdown fields')
      return
    }

    setPaymentForm((current) => ({
      ...current,
      ssf_amount: ssf !== null ? String(ssf) : current.ssf_amount,
      welfare_amount: welfare !== null ? String(welfare) : current.welfare_amount,
      insurance_amount: insurance !== null ? String(insurance) : current.insurance_amount,
    }))

    setSuccess('Breakdown populated from selected visa')
  }

  const resolveCandidateIdFromSubHeadSelection = () => {
    const sel = paymentSelectedSubHeadCandidateId || String(paymentForm.sub_passport_number || '')
    if (!sel) return null

    if (String(sel).startsWith('candidate:')) return String(sel).replace('candidate:', '')
    if (String(sel).startsWith('subhead_link:')) {
      const linkId = String(sel).replace('subhead_link:', '')
      const matched = (subHeadCandidateLinks || []).find((l) => String(l.id) === linkId)
      if (matched) return matched.candidate_id || matched.candidate?.id || null
    }

    // try passport or numeric id match
    const byPassport = (candidates || []).find((c) => String(c.passport_number || c.passport || '') === String(sel) || String(c.id) === String(sel))
    if (byPassport) return byPassport.id

    return null
  }

  const applyVisaBreakdownForSelectedSubHeadCandidate = () => {
    const candidateId = resolveCandidateIdFromSubHeadSelection()
    if (!candidateId) {
      setError('No candidate selected for this sub-head')
      return
    }

    const matchedVisa = (visaEntries || []).find((v) => String(v.candidate_id) === String(candidateId)) || null
    if (!matchedVisa) {
      setError('No visa entry found for selected candidate')
      return
    }

    // reuse same key probing as visa quick fill
    const ssfKeys = ['ssf', 'ssf_amount', 'ssf_fee', 'ssfFee', 'fee_ssf']
    const welfareKeys = ['welfare', 'welfare_amount', 'welfare_fee', 'welfareFee', 'fee_welfare']
    const insuranceKeys = ['insurance', 'insurance_amount', 'insurance_fee', 'insuranceFee', 'fee_insurance']

    const findVal = (keys) => {
      for (const k of keys) {
        if (typeof matchedVisa[k] !== 'undefined' && matchedVisa[k] !== null) return Number(matchedVisa[k])
      }
      return null
    }

    const ssf = findVal(ssfKeys)
    const welfare = findVal(welfareKeys)
    const insurance = findVal(insuranceKeys)

    setPaymentForm((current) => ({
      ...current,
      ssf_amount: ssf !== null ? String(ssf) : current.ssf_amount,
      welfare_amount: welfare !== null ? String(welfare) : current.welfare_amount,
      insurance_amount: insurance !== null ? String(insurance) : current.insurance_amount,
    }))

    setSuccess('Breakdown populated from candidate visa')
  }

  // Auto-calc FLA from SSF, Welfare and Insurance when linked to a visa entry or when FLA sub-head is selected
  useEffect(() => {
    const isFLASubHead = paymentForm.linked_module === 'sub_head' && selectedPaymentSubHead && String(selectedPaymentSubHead.name || '').toLowerCase() === 'fla'
    if (!(paymentForm.linked_module === 'visa_pipeline' || isFLASubHead)) return

    const ssf = Number(paymentForm.ssf_amount || 0)
    const welfare = Number(paymentForm.welfare_amount || 0)
    const insurance = Number(paymentForm.insurance_amount || 0)
    const fla = ssf + welfare + insurance

    setPaymentForm((current) => ({
      ...current,
      amount: String(Number.isNaN(fla) ? '' : fla),
    }))
  }, [paymentForm.ssf_amount, paymentForm.welfare_amount, paymentForm.insurance_amount, paymentForm.linked_module, selectedPaymentSubHead && selectedPaymentSubHead.name])

  const ledgerRows = useMemo(() => {
    const sorted = [...entries].sort((left, right) => {
      const leftDate = String(left.entry_date || '')
      const rightDate = String(right.entry_date || '')

      if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate)
      }

      return Number(left.id || 0) - Number(right.id || 0)
    })

    let runningBalance = Number(openingBalance) || 0

    return sorted
      .filter((entry) => {
        const status = String(entry.approval_status || 'approved').toLowerCase()
        return status !== 'rejected'
      })
      .map((entry, index) => {
        const amount = Number(entry.amount || 0)
        const receiptAmount = entry.type === 'receipt' ? amount : 0
        const paymentAmount = entry.type === 'payment' ? amount : 0

        // Do not show SSF/Welfare/Insurance for receipt rows on the ledger
        const ssfAmount = entry.type === 'receipt' ? 0 : Number(entry.ssf_amount ?? entry.ssf ?? entry.ssf_fee ?? entry.fee_ssf ?? 0)
        const welfareAmount = entry.type === 'receipt' ? 0 : Number(entry.welfare_amount ?? entry.welfare ?? entry.welfare_fee ?? entry.fee_welfare ?? 0)
        const insuranceAmount = entry.type === 'receipt' ? 0 : Number(entry.insurance_amount ?? entry.insurance ?? entry.insurance_fee ?? entry.fee_insurance ?? 0)

        runningBalance += getEntryNetEffect(entry)

        return {
          ...entry,
          rowNumber: index + 1,
          receiptAmount,
          paymentAmount,
          ssfAmount,
          welfareAmount,
          insuranceAmount,
          runningBalance,
        }
      })
  }, [entries, openingBalance])

  const receiptLedgerRows = useMemo(() => ledgerRows.filter((entry) => entry.type === 'receipt'), [ledgerRows])
  const paymentLedgerRows = useMemo(() => ledgerRows.filter((entry) => entry.type === 'payment'), [ledgerRows])

  const visibleTotals = useMemo(() => {
    return ledgerRows.reduce(
      (totals, row) => ({
        receipts: totals.receipts + row.receiptAmount,
        payments: totals.payments + row.paymentAmount,
        ssf: totals.ssf + (Number(row.ssfAmount || 0) || 0),
        welfare: totals.welfare + (Number(row.welfareAmount || 0) || 0),
        insurance: totals.insurance + (Number(row.insuranceAmount || 0) || 0),
        closing: row.runningBalance,
      }),
      { receipts: 0, payments: 0, ssf: 0, welfare: 0, insurance: 0, closing: Number(openingBalance) || 0 }
    )
  }, [ledgerRows, openingBalance])

  const selectedTrainingPayment = useMemo(
    () => trainingPaymentRows.find((item) => String(item.id) === String(selectedTrainingPaymentId)) || null,
    [selectedTrainingPaymentId, trainingPaymentRows]
  )

  const todaySummary = summary || {}
  const totalPages = pagination.last_page || 1
  return (
    <SidebarLayout title="Daily Daybook Ledger">
      <div style={styles.page}>
        {error && <div style={{ ...styles.alert, ...styles.error }}>{error}</div>}
        {success && <div style={{ ...styles.alert, ...styles.success }}>{success}</div>}

        <section style={styles.hero}>
          <div style={styles.heroCopy}>
            <div style={styles.eyebrow}>Spreadsheet format</div>
            <h2 style={styles.heroTitle}>Daybook</h2>
            <p style={styles.heroText}>
              Record receipts and payments in a ledger view with a running balance, filters, and an Excel-style sheet layout.
            </p>
          </div>
          <div style={styles.heroStats}>
            <div style={styles.heroChip}>Page {pagination.current_page || currentPage} of {totalPages}</div>
            <div style={styles.heroChip}>Visible rows {ledgerRows.length}</div>
            <div style={styles.heroChip}>Today net {currency(todaySummary.net_balance_today || 0)}</div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <div style={{ ...styles.summaryCard, borderTop: '4px solid #0f4d9d' }}>
            <div style={styles.summaryTopRow}>
              <div style={styles.summaryLabel}>Opening Balance</div>
              <div style={{ ...styles.summaryIconWrap, background: '#e8f0fb', color: '#0f4d9d' }}>🏁</div>
            </div>
            <div style={styles.summaryValue}>{currency(openingBalance)}</div>
          </div>
          <div style={{ ...styles.summaryCard, borderTop: '4px solid #059669' }}>
            <div style={styles.summaryTopRow}>
              <div style={styles.summaryLabel}>Today's Receipt</div>
              <div style={{ ...styles.summaryIconWrap, background: '#dcfce7', color: '#059669' }}>↗</div>
            </div>
            <div style={{ ...styles.summaryValue, ...styles.summaryAccentSuccess }}>{currency(visibleTotals.receipts)}</div>
          </div>
          <div style={{ ...styles.summaryCard, borderTop: '4px solid #c0392b' }}>
            <div style={styles.summaryTopRow}>
              <div style={styles.summaryLabel}>Today's Payment</div>
              <div style={{ ...styles.summaryIconWrap, background: '#fee2e2', color: '#c0392b' }}>↘</div>
            </div>
            <div style={{ ...styles.summaryValue, ...styles.summaryAccentDanger }}>{currency(visibleTotals.payments)}</div>
          </div>
          <div style={{ ...styles.summaryCard, borderTop: `4px solid ${visibleTotals.closing >= 0 ? '#059669' : '#c0392b'}` }}>
            <div style={styles.summaryTopRow}>
              <div style={styles.summaryLabel}>Closing Balance</div>
              <div style={{ ...styles.summaryIconWrap, background: visibleTotals.closing >= 0 ? '#dcfce7' : '#fee2e2', color: visibleTotals.closing >= 0 ? '#059669' : '#c0392b' }}>
                {visibleTotals.closing >= 0 ? '✓' : '!'}
              </div>
            </div>
            <div
              style={{
                ...styles.summaryValue,
                ...(visibleTotals.closing >= 0 ? styles.summaryAccentSuccess : styles.summaryAccentDanger),
              }}
            >
              {currency(visibleTotals.closing)}
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelHeaderRow}>
              <div>
                <h3 style={styles.panelTitle}>Filters and balance</h3>
                <p style={styles.panelSubtitle}>
                  Use these controls to shape the sheet view. The opening balance affects the running balance shown below.
                </p>
              </div>
              <div style={styles.pillRow}>
                <div style={styles.pill}>Today receipts {currency(todaySummary.total_receipts_today || 0)}</div>
                <div style={styles.pill}>Today payments {currency(todaySummary.total_payments_today || 0)}</div>
              </div>
            </div>
          </div>

          <div style={styles.content}>
            <div style={styles.filterGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Daybook date</span>
                <input
                  type="date"
                  style={styles.input}
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Opening balance</span>
                <input
                  type="number"
                  step="0.01"
                  style={styles.input}
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Type filter</span>
                <select style={styles.select} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All</option>
                  <option value="receipt">Receipt</option>
                  <option value="payment">Payment</option>
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Search</span>
                <input
                  type="text"
                  style={styles.input}
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Company, particulars, passport, ref"
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Start date</span>
                <input
                  type="date"
                  style={styles.input}
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>End date</span>
                <input
                  type="date"
                  style={styles.input}
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </label>
            </div>

            <div style={styles.buttonRow}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setFilterType('')
                  setFilterDate(new Date().toISOString().split('T')[0])
                  setFilterStartDate('')
                  setFilterEndDate('')
                  setFilterSearch('')
                }}
              >
                Reset filters
              </button>
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelHeaderRow}>
              <div>
                <h3 style={styles.panelTitle}>Entry workspace</h3>
                <p style={styles.panelSubtitle}>
                  Receipt and payment entries are shown together in split format for same-screen posting.
                </p>
              </div>
            </div>
          </div>

          <div style={styles.content}>
            <div style={styles.entrySplitGrid}>
              <div style={styles.entryColumn}>
                <div style={styles.entryColumnHeader}>
                  <h4 style={styles.entryColumnTitle}>Receipt Entry</h4>
                  <p style={styles.entryColumnSubTitle}>Record incoming receipts in a dedicated form.</p>
                </div>
                <div style={styles.entryCard}>
                  <form onSubmit={handleReceiptSubmit}>
                    <div style={styles.formGrid}>
                {receiptTarget === 'candidate' ? (
                  <label style={styles.field}>
                    <span style={styles.label}>Sub Head</span>
                    <select
                      style={styles.input}
                      value={receiptForm.linked_record_id}
                      onChange={handleSubHeadChange}
                    >
                      <option value="">Select sub head</option>
                      {subHeads.map((subHead) => (
                        <option key={subHead.id} value={subHead.id}>
                          {subHead.name || 'Sub head'}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label style={styles.field}>
                    <span style={styles.label}>Link to</span>
                    <div style={styles.typeSwitch}>
                      <button
                        type="button"
                        style={{
                          ...styles.typeSwitchButton,
                          ...(receiptCompanyEntityType === 'agency' ? styles.typeSwitchButtonActive : {}),
                        }}
                        onClick={() => handleReceiptCompanyTypeChange('agency')}
                      >
                        Client
                      </button>
                      <button
                        type="button"
                        style={{
                          ...styles.typeSwitchButton,
                          ...(receiptCompanyEntityType === 'project' ? styles.typeSwitchButtonActive : {}),
                        }}
                        onClick={() => handleReceiptCompanyTypeChange('project')}
                      >
                        Project
                      </button>
                      <button
                        type="button"
                        style={{
                          ...styles.typeSwitchButton,
                          ...(receiptCompanyEntityType === 'reference' ? styles.typeSwitchButtonActive : {}),
                        }}
                        onClick={() => handleReceiptCompanyTypeChange('reference')}
                      >
                        Reference
                      </button>
                    </div>
                  </label>
                )}

                <label style={styles.field}>
                  <span style={styles.label}>Particulars <span style={{ color: '#be123c' }}>*</span></span>
                  <input
                    type="text"
                    style={styles.input}
                    value={receiptForm.particulars}
                    onChange={(e) => setReceiptForm({ ...receiptForm, particulars: e.target.value })}
                    placeholder="Short description"
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Transaction type</span>
                  <div style={styles.typeSwitch}>
                    <button
                      type="button"
                      style={{
                        ...styles.typeSwitchButton,
                        ...(receiptForm.transaction_type === 'cash' ? styles.typeSwitchButtonActive : {}),
                      }}
                      onClick={() => setReceiptForm({ ...receiptForm, transaction_type: 'cash' })}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      style={{
                        ...styles.typeSwitchButton,
                        ...(receiptForm.transaction_type === 'online' ? styles.typeSwitchButtonActive : {}),
                      }}
                      onClick={() => setReceiptForm({ ...receiptForm, transaction_type: 'online' })}
                    >
                      Online
                    </button>
                  </div>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Reference number</span>
                  <input
                    type="text"
                    style={styles.input}
                    value={receiptForm.reference_number}
                    onChange={(e) => setReceiptForm({ ...receiptForm, reference_number: e.target.value })}
                    placeholder="Receipt or voucher no."
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Receipt Target</span>
                  <div style={styles.typeSwitch}>
                    <button
                      type="button"
                      style={{
                        ...styles.typeSwitchButton,
                        ...(receiptTarget === 'candidate' ? styles.typeSwitchButtonActive : {}),
                      }}
                      onClick={() => {
                        setReceiptTarget('candidate')
                        setReceiptSubHeadCandidateSearch('')
                      }}
                    >
                      Candidate
                    </button>
                    <button
                      type="button"
                      style={{
                        ...styles.typeSwitchButton,
                        ...(receiptTarget === 'company' ? styles.typeSwitchButtonActive : {}),
                      }}
                      onClick={() => {
                        setReceiptTarget('company')
        setReceiptSubHeadCandidateSearch('')
        setReceiptSelectedSubHeadCandidateId('')
      }}
                    >
                      Company
                    </button>
                  </div>
                </label>

                {receiptTarget === 'candidate' ? (
                  receiptForm.linked_module === 'sub_head' ? (
                    <>
                      <label style={styles.field}>
                        <span style={styles.label}>Search candidate</span>
                        <input
                          type="text"
                          style={styles.input}
                          value={receiptSubHeadCandidateSearch}
                          onChange={(e) => setReceiptSubHeadCandidateSearch(e.target.value)}
                          placeholder="Search name, passport or project"
                        />
                        <div style={styles.matchPreview}>
                          {receiptSubHeadCandidateSearch.trim() ? (
                            receiptSearchResults.length > 0 ? (
                              <>
                                {`Search results (${receiptSearchResults.length})`}
                                <ul style={styles.previewList}>
                                  {receiptSearchResults.map((candidate) => (
                                    <li key={candidate.id} style={styles.previewListItem}>
                                      <button
                                        type="button"
                                        style={styles.previewButton}
                                        onClick={() => handleSubHeadCandidateChange('receipt', candidate.id)}
                                      >
                                        <div>{highlightSearchMatches(candidate.candidateLabel, receiptSubHeadCandidateSearch)}</div>
                                        {candidate.previewSegments.length > 0 ? (
                                          <div style={styles.previewMeta}>{candidate.previewSegments.join(' • ')}</div>
                                        ) : null}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            ) : (
                              <div>No matching candidates found</div>
                            )
                          ) : (
                            <div>Type to search candidates</div>
                          )}
                        </div>
                      </label>
                      {selectedReceiptSubHeadCandidate ? (
                        <div style={styles.muted}>Selected: {selectedReceiptSubHeadCandidate.candidateName}</div>
                      ) : null}
                    </>
                  ) : null
                ) : (
                  <>
                    <label style={styles.field}>
                      <span style={styles.label}>{`Search ${receiptCompanyEntityType === 'agency' ? 'client' : receiptCompanyEntityType}`}</span>
                      <input
                        type="text"
                        style={styles.input}
                        value={receiptCompanySearch}
                        onChange={(e) => setReceiptCompanySearch(e.target.value)}
                        placeholder={
                          receiptCompanyEntityType === 'agency'
                            ? 'Search client name, contact or email'
                            : receiptCompanyEntityType === 'project'
                              ? 'Search project, client or reference'
                              : 'Search reference, company or contact'
                        }
                      />
                      <div style={styles.matchPreview}>
                        {receiptCompanySearch.trim() ? (
                          receiptCompanySearchResults.length > 0 ? (
                            <>
                              {`Search results (${receiptCompanySearchResults.length})`}
                              <ul style={styles.previewList}>
                                {receiptCompanySearchResults.map((item) => (
                                  <li key={item.id} style={styles.previewListItem}>
                                    <button
                                      type="button"
                                      style={styles.previewButton}
                                      onClick={() => handleReceiptCompanyEntitySelect(item.id)}
                                    >
                                      <div>{highlightSearchMatches(item.candidateLabel, receiptCompanySearch)}</div>
                                      {item.previewSegments.length > 0 ? (
                                        <div style={styles.previewMeta}>{item.previewSegments.join(' • ')}</div>
                                      ) : null}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : (
                            <div>{`No matching ${receiptCompanyEntityType === 'agency' ? 'clients' : receiptCompanyEntityType === 'project' ? 'projects' : 'references'} found`}</div>
                          )
                        ) : (
                          <div>{`Type to search ${receiptCompanyEntityType === 'agency' ? 'clients' : receiptCompanyEntityType === 'project' ? 'projects' : 'references'}`}</div>
                        )}
                      </div>
                    </label>
                    {selectedReceiptCompanyEntity ? (
                      <div style={styles.entityBox}>
                        <div style={styles.label}>Linked entity</div>
                        <div style={styles.entityDetails}>
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedReceiptCompanyEntity.candidateLabel}</div>
                          {selectedReceiptCompanyEntity.previewSegments.map((segment) => (
                            <div key={segment} style={styles.entityMeta}>{segment}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                <label style={styles.field}>
                  <span style={styles.label}>Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    style={styles.input}
                    value={receiptForm.amount}
                    onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                    placeholder="0.00"
                  />
                  {receiptForm.linked_module === 'visa_pipeline' && selectedReceiptVisaEntry ? (
                    <div style={styles.quickFillRow}>
                      <button
                        type="button"
                        style={styles.quickFillButton}
                        onClick={() => applyVisaAmountQuickFill('receipt', 'due')}
                      >
                        Use Visa Due {currency(receiptVisaSnapshot.due)}
                      </button>
                      <button
                        type="button"
                        style={styles.quickFillButton}
                        onClick={() => applyVisaAmountQuickFill('receipt', 'received')}
                      >
                        Use Visa Received {currency(receiptVisaSnapshot.received)}
                      </button>
                      <span style={styles.quickFillMeta}>Total fee {currency(receiptVisaSnapshot.totalFee)}</span>
                    </div>
                  ) : null}
                </label>

                <label style={{ ...styles.field, ...styles.formFull }}>
                  <span style={styles.label}>Description</span>
                  <textarea
                    style={styles.textarea}
                    value={receiptForm.description}
                    onChange={(e) => setReceiptForm({ ...receiptForm, description: e.target.value })}
                    placeholder="Optional notes for the ledger row"
                  />
                </label>
              </div>

                <div style={{ ...styles.content, padding: '0', marginTop: '2px' }}>
                  <div style={styles.buttonRow}>
                    <button type="button" style={styles.secondaryButton} onClick={() => resetForm('receipt')}>
                      {receiptEditingEntryId ? 'Cancel edit' : 'Clear form'}
                    </button>
                    <button type="submit" style={styles.primaryButton} disabled={saving}>
                      {saving ? 'Saving...' : (receiptEditingEntryId ? 'Update Receipt' : 'Add Receipt')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
            </div>

              <div style={styles.entryColumn}>
                <div style={styles.entryColumnHeader}>
                  <h4 style={styles.entryColumnTitle}>Payment Entry</h4>
                  <p style={styles.entryColumnSubTitle}>Record company payments in a dedicated form.</p>
                </div>
                <div style={styles.entryCard}>
                  <form onSubmit={handlePaymentSubmit}>
                    <div style={styles.formGrid}>
                      <label style={styles.field}>
                        <span style={styles.label}>Payment Target</span>
                        <div style={styles.typeSwitch}>
                          <button
                            type="button"
                            style={{
                              ...styles.typeSwitchButton,
                              ...(paymentTarget === 'company' ? styles.typeSwitchButtonActive : {}),
                            }}
                            onClick={() => {
                              setPaymentTarget('company')
                              setPaymentSelectedStaffId('')
                              setPaymentCompanyEntityType('agency')
                              setPaymentCompanySearch('')
                              setPaymentSelectedCompanyEntityId('')
                              setPaymentForm((current) => ({
                                ...current,
                                company_name: agencies[0]?.company_name || '',
                                amount: '',
                                description: current.description || 'Company payment entry',
                                sub_passport_number: '',
                                reference_number: '',
                                linked_module: '',
                                linked_record_id: '',
                                linked_record_name: '',
                              }))
                            }}
                          >
                            Company
                          </button>
                          <button
                            type="button"
                            style={{
                              ...styles.typeSwitchButton,
                              ...(paymentTarget === 'others' ? styles.typeSwitchButtonActive : {}),
                            }}
                            onClick={() => {
                              setPaymentTarget('others')
                              setPaymentSelectedStaffId('')
                              setPaymentCompanyEntityType('agency')
                              setPaymentCompanySearch('')
                              setPaymentSelectedCompanyEntityId('')
                              setPaymentForm((current) => ({
                                ...current,
                                company_name: '',
                                amount: '',
                                description: current.description || 'Other payment entry',
                                sub_passport_number: '',
                                reference_number: '',
                                linked_module: '',
                                linked_record_id: '',
                                linked_record_name: '',
                              }))
                            }}
                          >
                            Others
                          </button>
                        </div>
                      </label>

                      {paymentTarget === 'others' ? (
                        <>
                          <label style={styles.field}>
                            <span style={styles.label}>Others account name</span>
                            <input
                              type="text"
                              style={styles.input}
                              value={paymentForm.company_name || ''}
                              onChange={(e) => setPaymentForm((current) => ({
                                ...current,
                                company_name: e.target.value,
                                sub_passport_number: current.linked_module === 'sub_head' ? e.target.value : current.sub_passport_number,
                              }))}
                              placeholder="Enter account name"
                            />
                          </label>

                          <label style={styles.field}>
                            <span style={styles.label}>Amount <span style={{ color: '#be123c' }}>*</span></span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              style={styles.input}
                              value={paymentForm.amount}
                              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                              placeholder="0.00"
                            />
                          </label>

                          <label style={styles.field}>
                            <span style={styles.label}>Sub Head</span>
                            <select
                              style={styles.input}
                              value={paymentForm.linked_record_id}
                              onChange={handlePaymentSubHeadChange}
                            >
                              <option value="">Select sub head</option>
                              {subHeads.map((subHead) => (
                                <option key={subHead.id} value={subHead.id}>
                                  {subHead.name || 'Sub head'}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      ) : null}

                      <label style={styles.field}>
                        <span style={styles.label}>Payment Particulars <span style={{ color: '#be123c' }}>*</span></span>
                        <input
                          type="text"
                          style={styles.input}
                          value={paymentForm.particulars}
                          onChange={(e) => setPaymentForm({ ...paymentForm, particulars: e.target.value })}
                          placeholder={paymentTarget === 'staff' ? 'Salary payment details' : paymentTarget === 'others' ? 'Other payment details' : 'Company payment details'}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Transaction type</span>
                        <div style={styles.typeSwitch}>
                          <button
                            type="button"
                            style={{
                              ...styles.typeSwitchButton,
                              ...(paymentForm.transaction_type === 'cash' ? styles.typeSwitchButtonActive : {}),
                            }}
                            onClick={() => setPaymentForm({ ...paymentForm, transaction_type: 'cash' })}
                          >
                            Cash
                          </button>
                          <button
                            type="button"
                            style={{
                              ...styles.typeSwitchButton,
                              ...(paymentForm.transaction_type === 'online' ? styles.typeSwitchButtonActive : {}),
                            }}
                            onClick={() => setPaymentForm({ ...paymentForm, transaction_type: 'online' })}
                          >
                            Online
                          </button>
                        </div>
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>{paymentTarget === 'staff' ? 'Salary reference' : 'Company reference'}</span>
                        <input
                          type="text"
                          style={styles.input}
                          value={paymentForm.reference_number}
                          onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                          placeholder={paymentTarget === 'staff' ? 'Salary voucher no.' : 'Company voucher no.'}
                        />
                      </label>

                      {paymentTarget === 'staff' ? (
                        <>
                          <label style={styles.field}>
                            <span style={styles.label}>Staff</span>
                            <select
                              style={styles.input}
                              value={paymentSelectedStaffId}
                              onChange={handleStaffChange}
                            >
                              <option value="">Select staff</option>
                              {staff.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.full_name || 'Staff'}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label style={styles.field}>
                            <span style={styles.label}>Salary Amount</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              style={styles.input}
                              value={paymentForm.amount}
                              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                              placeholder="Auto-filled from salary"
                            />
                          </label>
                        </>
                      ) : paymentTarget === 'company' ? (
                        <>
                          <label style={styles.field}>
                            <span style={styles.label}>Link to</span>
                            <div style={styles.typeSwitch}>
                              <button
                                type="button"
                                style={{
                                  ...styles.typeSwitchButton,
                                  ...(paymentCompanyEntityType === 'agency' ? styles.typeSwitchButtonActive : {}),
                                }}
                                onClick={() => handlePaymentCompanyTypeChange('agency')}
                              >
                                Salary
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...styles.typeSwitchButton,
                                  ...(paymentCompanyEntityType === 'project' ? styles.typeSwitchButtonActive : {}),
                                }}
                                onClick={() => handlePaymentCompanyTypeChange('project')}
                              >
                                Project
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...styles.typeSwitchButton,
                                  ...(paymentCompanyEntityType === 'reference' ? styles.typeSwitchButtonActive : {}),
                                }}
                                onClick={() => handlePaymentCompanyTypeChange('reference')}
                              >
                                Reference
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...styles.typeSwitchButton,
                                  ...(paymentCompanyEntityType === 'candidate' ? styles.typeSwitchButtonActive : {}),
                                }}
                                onClick={() => handlePaymentCompanyTypeChange('candidate')}
                              >
                                Candidate
                              </button>
                            </div>
                          </label>

                          {paymentCompanyEntityType !== 'candidate' ? (
                            <>
                              <label style={styles.field}>
                                <span style={styles.label}>{`Search ${paymentCompanyEntityType === 'agency' ? 'salary' : paymentCompanyEntityType}`}</span>
                                <input
                                  type="text"
                                  style={styles.input}
                                  value={paymentCompanySearch}
                                  onChange={(e) => setPaymentCompanySearch(e.target.value)}
                                  placeholder={
                                    paymentCompanyEntityType === 'agency'
                                      ? 'Search salary name, contact or email'
                                      : paymentCompanyEntityType === 'project'
                                        ? 'Search project, salary or reference'
                                        : 'Search reference, company or contact'
                                  }
                                />
                                <div style={styles.matchPreview}>
                                  {paymentCompanySearch.trim() ? (
                                    paymentCompanySearchResults.length > 0 ? (
                                      <>
                                        {`Search results (${paymentCompanySearchResults.length})`}
                                        <ul style={styles.previewList}>
                                          {paymentCompanySearchResults.map((item) => (
                                            <li key={item.id} style={styles.previewListItem}>
                                              <button
                                                type="button"
                                                style={styles.previewButton}
                                                onClick={() => handlePaymentCompanyEntitySelect(item.id)}
                                              >
                                                <div>{highlightSearchMatches(item.candidateLabel, paymentCompanySearch)}</div>
                                                {item.previewSegments.length > 0 ? (
                                                  <div style={styles.previewMeta}>{item.previewSegments.join(' • ')}</div>
                                                ) : null}
                                              </button>
                                            </li>
                                          ))}
                                        </ul>
                                      </>
                                    ) : (
                                      <div>{`No matching ${paymentCompanyEntityType === 'agency' ? 'salaries' : paymentCompanyEntityType === 'project' ? 'projects' : 'references'} found`}</div>
                                    )
                                  ) : (
                                    <div>{`Type to search ${paymentCompanyEntityType === 'agency' ? 'salaries' : paymentCompanyEntityType === 'project' ? 'projects' : 'references'}`}</div>
                                  )}
                                </div>
                              </label>
                              {selectedPaymentCompanyEntity ? (
                                <div style={styles.entityBox}>
                                  <div style={styles.label}>Linked entity</div>
                                  <div style={styles.entityDetails}>
                                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedPaymentCompanyEntity.candidateLabel}</div>
                                    {selectedPaymentCompanyEntity.previewSegments.map((segment) => (
                                      <div key={segment} style={styles.entityMeta}>{segment}</div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <label style={styles.field}>
                              <span style={styles.label}>Candidate Sub Head</span>
                              <select
                                style={styles.input}
                                value={paymentForm.linked_record_id}
                                onChange={handlePaymentSubHeadChange}
                              >
                                <option value="">Select sub head</option>
                                {subHeads.map((subHead) => (
                                  <option key={subHead.id} value={subHead.id}>
                                    {subHead.name || 'Sub head'}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          {(paymentForm.linked_module === 'visa_pipeline' && selectedPaymentVisaEntry) || (paymentForm.linked_module === 'sub_head' && selectedPaymentSubHead && String(selectedPaymentSubHead.name || '').toLowerCase() === 'fla') ? (
                            <>
                              <div style={styles.quickFillRow}>
                                <button
                                  type="button"
                                  style={styles.quickFillButton}
                                  onClick={() => {
                                    if (paymentForm.linked_module === 'visa_pipeline') applyVisaBreakdownQuickFill()
                                    else applyVisaBreakdownForSelectedSubHeadCandidate()
                                  }}
                                >
                                  {paymentForm.linked_module === 'visa_pipeline' ? 'Quick-fill breakdown from visa' : 'Quick-fill breakdown from candidate visa'}
                                </button>
                              </div>
                              <label style={styles.field}>
                                <span style={styles.label}>SSF amount</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  style={styles.input}
                                  value={paymentForm.ssf_amount}
                                  onChange={(e) => setPaymentForm({ ...paymentForm, ssf_amount: e.target.value })}
                                  placeholder="0.00"
                                />
                              </label>

                              <label style={styles.field}>
                                <span style={styles.label}>Welfare amount</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  style={styles.input}
                                  value={paymentForm.welfare_amount}
                                  onChange={(e) => setPaymentForm({ ...paymentForm, welfare_amount: e.target.value })}
                                  placeholder="0.00"
                                />
                              </label>

                              <label style={styles.field}>
                                <span style={styles.label}>Insurance amount</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  style={styles.input}
                                  value={paymentForm.insurance_amount}
                                  onChange={(e) => setPaymentForm({ ...paymentForm, insurance_amount: e.target.value })}
                                  placeholder="0.00"
                                />
                              </label>

                              <label style={styles.field}>
                                <span style={styles.label}>FLA total</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  style={{ ...styles.input, background: '#f3f4f6' }}
                                  value={paymentForm.amount}
                                  readOnly
                                />
                              </label>
                            </>
                          ) : null}

                          <label style={styles.field}>
                            <span style={styles.label}>Company Payment Amount</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              style={styles.input}
                              value={paymentForm.amount}
                              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                              placeholder="0.00"
                            />
                          </label>
                        </>
                      ) : null}

                      {paymentTarget === 'staff' ? null : (
                        paymentCompanyEntityType === 'candidate' && paymentForm.linked_module === 'sub_head' ? (
                          <>
                            <label style={styles.field}>
                              <span style={styles.label}>Search candidate</span>
                              <input
                                type="text"
                                style={styles.input}
                                value={paymentSubHeadCandidateSearch}
                                onChange={(e) => setPaymentSubHeadCandidateSearch(e.target.value)}
                                placeholder="Search name, passport or project"
                              />
                              <div style={styles.matchPreview}>
                                {paymentSubHeadCandidateSearch.trim() ? (
                                  paymentSearchResults.length > 0 ? (
                                    <>
                                      {`Search results (${paymentSearchResults.length})`}
                                      <ul style={styles.previewList}>
                                        {paymentSearchResults.map((candidate) => (
                                          <li key={candidate.id} style={styles.previewListItem}>
                                            <button
                                              type="button"
                                              style={styles.previewButton}
                                              onClick={() => handleSubHeadCandidateChange('payment', candidate.id)}
                                            >
                                              <div>{highlightSearchMatches(candidate.candidateLabel, paymentSubHeadCandidateSearch)}</div>
                                              {candidate.previewSegments.length > 0 ? (
                                                <div style={styles.previewMeta}>{candidate.previewSegments.join(' • ')}</div>
                                              ) : null}
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    </>
                                  ) : (
                                    <div>No matching candidates found</div>
                                  )
                                ) : (
                                  <div>Type to search candidates</div>
                                )}
                              </div>
                            </label>

                            {selectedPaymentSubHeadCandidate ? (
                              <div style={styles.muted}>Selected: {selectedPaymentSubHeadCandidate.candidateName}</div>
                            ) : null}
                          </>
                        ) : null
                      )}

                      <label style={{ ...styles.field, ...styles.formFull }}>
                        <span style={styles.label}>{paymentTarget === 'staff' ? 'Salary Note' : 'Company Note'}</span>
                        <textarea
                          style={styles.textarea}
                          value={paymentForm.description}
                          onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                          placeholder={paymentTarget === 'staff' ? 'Salary payment note' : 'Company payment note'}
                        />
                      </label>
                    </div>

                    <div style={{ ...styles.content, padding: '0', marginTop: '2px' }}>
                      <div style={styles.buttonRow}>
                        <button type="button" style={styles.secondaryButton} onClick={() => resetForm('payment')}>
                          {paymentEditingEntryId ? 'Cancel edit' : 'Clear form'}
                        </button>
                        <button type="submit" style={styles.primaryButton} disabled={saving}>
                          {saving ? 'Saving...' : (paymentEditingEntryId ? 'Update Payment' : 'Add Payment')}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={styles.sheetWrap}>
          <div style={styles.sheetHeader}>
            <div>
              <div style={styles.sheetTitle}>Ledger sheet</div>
              <div style={styles.sheetMeta}>Running balance is calculated from the opening balance and the visible rows.</div>
            </div>
            <div style={styles.pillRow}>
              <div style={styles.pill}>Receipts {currency(visibleTotals.receipts)}</div>
              <div style={styles.pill}>Payments {currency(visibleTotals.payments)}</div>
              <div style={styles.pill}>Balance {currency(visibleTotals.closing)}</div>
            </div>
          </div>

          <div style={styles.splitLedgerGrid}>
            <div style={styles.splitLedgerHalf}>
              <div style={styles.splitLedgerTitle}>Receipt part</div>
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Company</th>
                      <th style={styles.th}>Particulars</th>
                      <th style={styles.th}>Ref / Passport</th>
                      <th style={styles.th}>Linked Source</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Receipt</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Balance</th>
                      <th style={styles.th}>Approval</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={10} style={styles.emptyState}>
                          Loading ledger...
                        </td>
                      </tr>
                    ) : receiptLedgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={styles.emptyState}>
                          No receipt entries found for the current filters.
                        </td>
                      </tr>
                    ) : (
                      receiptLedgerRows.map((entry) => (
                        <tr key={entry.id} id={`daybook-entry-${entry.id}`}>
                          <td style={styles.td}>{entry.rowNumber}</td>
                          <td style={styles.td}>{formatDate(entry.entry_date)}</td>
                          <td style={styles.td}>{entry.company_name || '-'}</td>
                          <td style={styles.td}>
                            <div>{entry.particulars || '-'}</div>
                            {entry.description ? <div style={styles.muted}>{entry.description}</div> : null}
                          </td>
                          <td style={styles.td}>{entry.reference_number || entry.sub_passport_number || '-'}</td>
                          <td style={styles.td}>
                            {entry.linked_module ? (
                              <>
                                <div>{getLinkedLabel(entry)}</div>
                                <div style={styles.muted}>{entry.linked_module.replaceAll('_', ' ')}</div>
                              </>
                            ) : '-'}
                          </td>
                          <td style={{ ...styles.td, ...styles.amountCell, ...styles.receipt }}>
                            {entry.receiptAmount ? currency(entry.receiptAmount) : '—'}
                          </td>
                          <td style={{ ...styles.td, ...styles.amountCell, ...styles.balance }}>
                            {currency(entry.runningBalance)}
                          </td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              onClick={() => {
                                try { localStorage.setItem('daybook_focus_entry', String(entry.id)) } catch (e) {}
                                window.location.href = '/daybook-approval'
                              }}
                              style={{
                                ...styles.badge,
                                cursor: 'pointer',
                                background: entry.approval_status === 'approved' ? '#ecfdf5' : entry.approval_status === 'rejected' ? '#fee2e2' : '#fffbeb',
                                color: entry.approval_status === 'approved' ? '#047857' : entry.approval_status === 'rejected' ? '#b91c1c' : '#92400e',
                                border: 'none',
                                padding: '6px 10px',
                                fontWeight: 800,
                              }}
                            >
                              {entry.approval_status ? (entry.approval_status.charAt(0).toUpperCase() + entry.approval_status.slice(1)) : 'Approved'}
                            </button>
                          </td>
                          <td style={styles.td}>
                            {isEntryPastEditWindow(entry) && isRestrictedUser ? (
                              <button type="button" style={styles.rowEditButtonLocked} disabled>
                                Locked
                              </button>
                            ) : (
                              <button type="button" style={styles.rowEditButton} onClick={() => handleEditEntry(entry)}>
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {receiptLedgerRows.length > 0 && (
                    <tfoot>
                      <tr style={styles.footerRow}>
                        <td style={styles.td} colSpan={6}>Totals</td>
                        <td style={{ ...styles.td, ...styles.amountCell, ...styles.receipt }}>{currency(visibleTotals.receipts)}</td>
                        <td style={{ ...styles.td, ...styles.amountCell, ...styles.balance }}>{currency(visibleTotals.closing)}</td>
                        <td style={styles.td}></td>
                        <td style={styles.td}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div style={styles.splitLedgerHalf}>
              <div style={styles.splitLedgerTitle}>Payment part</div>
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Company</th>
                      <th style={styles.th}>Particulars</th>
                      <th style={styles.th}>Ref / Passport</th>
                      <th style={styles.th}>Linked Source</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Payment</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>SSF</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Welfare</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Insurance</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Balance</th>
                      <th style={styles.th}>Approval</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={13} style={styles.emptyState}>
                          Loading ledger...
                        </td>
                      </tr>
                    ) : paymentLedgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={13} style={styles.emptyState}>
                          No payment entries found for the current filters.
                        </td>
                      </tr>
                    ) : (
                      paymentLedgerRows.map((entry) => (
                        <tr key={entry.id} id={`daybook-entry-${entry.id}`}>
                          <td style={styles.td}>{entry.rowNumber}</td>
                          <td style={styles.td}>{formatDate(entry.entry_date)}</td>
                          <td style={styles.td}>{entry.company_name || '-'}</td>
                          <td style={styles.td}>
                            <div>{entry.particulars || '-'}</div>
                            {entry.description ? <div style={styles.muted}>{entry.description}</div> : null}
                          </td>
                          <td style={styles.td}>{entry.reference_number || entry.sub_passport_number || '-'}</td>
                          <td style={styles.td}>
                            {entry.linked_module ? (
                              <>
                                <div>{getLinkedLabel(entry)}</div>
                                <div style={styles.muted}>{entry.linked_module.replaceAll('_', ' ')}</div>
                              </>
                            ) : '-'}
                          </td>
                          <td style={{ ...styles.td, ...styles.amountCell, ...styles.payment }}>
                            {entry.paymentAmount ? currency(entry.paymentAmount) : '—'}
                          </td>
                          <td style={{ ...styles.td, ...styles.amountCell }}>
                            {entry.ssfAmount != null && entry.ssfAmount !== '' ? currency(entry.ssfAmount) : '—'}
                          </td>
                          <td style={{ ...styles.td, ...styles.amountCell }}>
                            {entry.welfareAmount != null && entry.welfareAmount !== '' ? currency(entry.welfareAmount) : '—'}
                          </td>
                          <td style={{ ...styles.td, ...styles.amountCell }}>
                            {entry.insuranceAmount != null && entry.insuranceAmount !== '' ? currency(entry.insuranceAmount) : '—'}
                          </td>
                          <td style={{ ...styles.td, ...styles.amountCell, ...styles.balance }}>
                            {currency(entry.runningBalance)}
                          </td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              onClick={() => {
                                try { localStorage.setItem('daybook_focus_entry', String(entry.id)) } catch (e) {}
                                window.location.href = '/daybook-approval'
                              }}
                              style={{
                                ...styles.badge,
                                cursor: 'pointer',
                                background: entry.approval_status === 'approved' ? '#ecfdf5' : entry.approval_status === 'rejected' ? '#fee2e2' : '#fffbeb',
                                color: entry.approval_status === 'approved' ? '#047857' : entry.approval_status === 'rejected' ? '#b91c1c' : '#92400e',
                                border: 'none',
                                padding: '6px 10px',
                                fontWeight: 800,
                              }}
                            >
                              {entry.approval_status ? (entry.approval_status.charAt(0).toUpperCase() + entry.approval_status.slice(1)) : 'Approved'}
                            </button>
                          </td>
                          <td style={styles.td}>
                            {isEntryPastEditWindow(entry) && isRestrictedUser ? (
                              <button type="button" style={styles.rowEditButtonLocked} disabled>
                                Locked
                              </button>
                            ) : (
                              <button type="button" style={styles.rowEditButton} onClick={() => handleEditEntry(entry)}>
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {paymentLedgerRows.length > 0 && (
                    <tfoot>
                      <tr style={styles.footerRow}>
                        <td style={styles.td} colSpan={6}>Totals</td>
                        <td style={{ ...styles.td, ...styles.amountCell, ...styles.payment }}>{currency(visibleTotals.payments)}</td>
                        <td style={{ ...styles.td, ...styles.amountCell }}>{currency(visibleTotals.ssf)}</td>
                        <td style={{ ...styles.td, ...styles.amountCell }}>{currency(visibleTotals.welfare)}</td>
                        <td style={{ ...styles.td, ...styles.amountCell }}>{currency(visibleTotals.insurance)}</td>
                        <td style={{ ...styles.td, ...styles.amountCell, ...styles.balance }}>{currency(visibleTotals.closing)}</td>
                        <td style={styles.td}></td>
                        <td style={styles.td}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          <div style={styles.pagination}>
            <div style={styles.sheetMeta}>
              Showing {ledgerRows.length} row{ledgerRows.length === 1 ? '' : 's'} on page {pagination.current_page || currentPage}
            </div>
            <div style={styles.pagerGroup}>
              <button
                type="button"
                style={styles.pagerButton}
                onClick={() => loadEntries(Math.max(1, (pagination.current_page || currentPage) - 1))}
                disabled={(pagination.current_page || currentPage) <= 1}
              >
                Previous
              </button>
              <span style={styles.sheetMeta}>
                Page {pagination.current_page || currentPage} of {totalPages}
              </span>
              <button
                type="button"
                style={styles.pagerButton}
                onClick={() => loadEntries(Math.min(totalPages, (pagination.current_page || currentPage) + 1))}
                disabled={(pagination.current_page || currentPage) >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </SidebarLayout>
  )
}
