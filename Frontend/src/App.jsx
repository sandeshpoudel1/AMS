import { Suspense, lazy } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Users = lazy(() => import('./pages/Users'))
const Staff = lazy(() => import('./pages/Staff'))
const Agencies = lazy(() => import('./pages/Agencies'))
const Reference = lazy(() => import('./pages/Reference'))
const BD = lazy(() => import('./pages/BD'))
const Candidates = lazy(() => import('./pages/Candidates'))
const CandidateDetail = lazy(() => import('./pages/CandidateDetail'))
const Finance = lazy(() => import('./pages/Finance'))
const ProjectSettings = lazy(() => import('./pages/ProjectSettings'))
const ExpenseHeads = lazy(() => import('./pages/ExpenseHeads'))
const Daybook = lazy(() => import('./pages/Daybook'))
const DaybookApproval = lazy(() => import('./pages/DaybookApproval'))
const Payroll = lazy(() => import('./pages/Payroll'))
const DocumentController = lazy(() => import('./pages/DocumentController'))
const DocumentChecklistSettings = lazy(() => import('./pages/DocumentChecklistSettings'))
const Reports = lazy(() => import('./pages/Reports'))
const CompanyProfitLossReport = lazy(() => import('./pages/CompanyProfitLossReport'))
const CandidateReport = lazy(() => import('./pages/CandidateReport'))
const ClientReport = lazy(() => import('./pages/ClientReport'))
const ProjectReport = lazy(() => import('./pages/ProjectReport'))
const VisaProcessingReport = lazy(() => import('./pages/VisaProcessingReport'))
const VisaPipeline = lazy(() => import('./pages/VisaPipeline'))
const SourcingDetails = lazy(() => import('./pages/SourcingDetails'))
const VisaDetails = lazy(() => import('./pages/VisaDetails'))
const Security = lazy(() => import('./pages/Security'))

const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter

const ADMIN_ROLES = ['admin']
const CANDIDATE_MODULE_ROLES = ['admin', 'candidate_officer', 'management', 'finance_officer', 'documentation', 'documentation_head']
const DOCUMENT_CONTROLLER_ROLES = ['admin', 'candidate_officer', 'management', 'finance_officer', 'documentation', 'documentation_head']
const STATUS_ROLES = ['admin', 'documentation', 'documentation_head']
const REFERENCE_ROLES = ['admin', 'finance_officer', 'candidate_officer', 'documentation', 'documentation_head']
const CANDIDATE_FLOWN_ROLES = ['admin', 'finance_officer', 'account']
const VISA_DETAILS_ROLES = ['admin', 'candidate_officer', 'finance_officer']
const FINANCE_MODULE_ROLES = ['admin', 'finance_officer']
const REPORTS_MODULE_ROLES = ['admin', 'finance_officer', 'account']
const DAYBOOK_MODULE_ROLES = ['admin', 'finance_officer', 'account']
const STAFF_PAYROLL_ROLES = ['admin', 'finance_officer', 'hr_officer', 'account']

const suspenseFallback = (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#0f2742', fontWeight: 700 }}>
    Loading...
  </div>
)

function Protected({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function ProtectedRole({ children, roles }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Case-insensitive role check - prefer `role`, fallback to `role_label`
  const normalize = (r = '') => String(r).toLowerCase().replace(/ /g, '_')
  const userRole = normalize(user.role || user.role_label)

  // Superadmin should have access to everything
  if (userRole === 'superadmin' || userRole === 'super_admin') {
    return children
  }

  const hasAccess = roles.some(role => normalize(role) === userRole)

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={suspenseFallback}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/users" element={<ProtectedRole roles={ADMIN_ROLES}><Users /></ProtectedRole>} />
            <Route path="/staff" element={<ProtectedRole roles={STAFF_PAYROLL_ROLES}><Staff /></ProtectedRole>} />
            <Route path="/clients" element={<ProtectedRole roles={ADMIN_ROLES}><Agencies /></ProtectedRole>} />
            <Route path="/agencies" element={<Navigate to="/clients" replace />} />
            <Route path="/reference" element={<ProtectedRole roles={REFERENCE_ROLES}><Reference /></ProtectedRole>} />
            <Route path="/bd" element={<ProtectedRole roles={ADMIN_ROLES}><BD /></ProtectedRole>} />
            <Route path="/candidates" element={<ProtectedRole roles={CANDIDATE_MODULE_ROLES}><Candidates /></ProtectedRole>} />
            <Route path="/candidates/:id" element={<ProtectedRole roles={CANDIDATE_MODULE_ROLES}><CandidateDetail /></ProtectedRole>} />
            <Route path="/finance" element={<ProtectedRole roles={FINANCE_MODULE_ROLES}><Finance /></ProtectedRole>} />
            <Route path="/project-settings" element={<ProtectedRole roles={ADMIN_ROLES}><ProjectSettings /></ProtectedRole>} />
            <Route path="/sub-head" element={<ProtectedRole roles={[...ADMIN_ROLES, 'finance_officer', 'account']}><ExpenseHeads /></ProtectedRole>} />
            <Route path="/expense-heads" element={<ProtectedRole roles={[...ADMIN_ROLES, 'finance_officer', 'account']}><ExpenseHeads /></ProtectedRole>} />
            <Route path="/document-controller" element={<ProtectedRole roles={DOCUMENT_CONTROLLER_ROLES}><DocumentController /></ProtectedRole>} />
            <Route path="/settings/document-checklist" element={<ProtectedRole roles={STATUS_ROLES}><DocumentChecklistSettings /></ProtectedRole>} />
            <Route path="/candidate-flown" element={<ProtectedRole roles={CANDIDATE_FLOWN_ROLES}><VisaPipeline /></ProtectedRole>} />
            <Route path="/sourcing-report" element={<ProtectedRole roles={CANDIDATE_FLOWN_ROLES}><SourcingDetails /></ProtectedRole>} />
            <Route path="/visa-details" element={<ProtectedRole roles={VISA_DETAILS_ROLES}><VisaDetails /></ProtectedRole>} />
            <Route path="/daybook" element={<ProtectedRole roles={DAYBOOK_MODULE_ROLES}><Daybook /></ProtectedRole>} />
            <Route path="/daybook-approval" element={<ProtectedRole roles={['admin']}><DaybookApproval /></ProtectedRole>} />
            <Route path="/payroll" element={<ProtectedRole roles={STAFF_PAYROLL_ROLES}><Payroll /></ProtectedRole>} />
            <Route path="/reports" element={<ProtectedRole roles={REPORTS_MODULE_ROLES}><Reports /></ProtectedRole>} />
            <Route path="/reports/company-profit-loss" element={<ProtectedRole roles={REPORTS_MODULE_ROLES}><CompanyProfitLossReport /></ProtectedRole>} />
            <Route path="/reports/candidate" element={<ProtectedRole roles={REPORTS_MODULE_ROLES}><CandidateReport /></ProtectedRole>} />
            <Route path="/reports/client" element={<ProtectedRole roles={REPORTS_MODULE_ROLES}><ClientReport /></ProtectedRole>} />
            <Route path="/reports/project" element={<ProtectedRole roles={REPORTS_MODULE_ROLES}><ProjectReport /></ProtectedRole>} />
            <Route path="/reports/visa-processing" element={<ProtectedRole roles={REPORTS_MODULE_ROLES}><VisaProcessingReport /></ProtectedRole>} />
            <Route path="/security" element={<Protected><Security /></Protected>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  )
}

export default App
