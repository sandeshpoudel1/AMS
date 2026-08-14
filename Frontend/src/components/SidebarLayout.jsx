import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/motherland-logo.svg'

// Helper function to check if user role matches any allowed roles
const hasRole = (userRole, allowedRoles) => {
  if (!userRole) return false
  // Normalize user role: convert to lowercase and replace spaces with underscores
  const normalizedUserRole = (userRole || '').toLowerCase().replace(/ /g, '_')
  // Superadmin should have access to everything
  if (normalizedUserRole === 'superadmin' || normalizedUserRole === 'super_admin') return true
  return allowedRoles.some(role => role.toLowerCase().replace(/ /g, '_') === normalizedUserRole)
}

export default function SidebarLayout({ children, title, headerExtra }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <div style={styles.page}>
      {/* Top Header */}
      <div style={styles.header_top}>
        <div style={styles.headerBrand}>
          <img src={logo} alt="Motherland logo" style={styles.headerLogo} />
          <span style={styles.headerBrandText}>Motherland Overseas Record Management System</span>
        </div>
        <div style={styles.headerUser}>
          <span style={styles.userBadge}>{user?.role_label || 'Admin'}</span>
          <span style={styles.userName}>{user?.full_name || user?.name}</span>
          <button style={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Main Layout with Sidebar */}
      <div style={styles.mainLayout}>
        {/* Left Sidebar */}
        <aside style={styles.sidebar}>
          <nav style={styles.sideNav}>
            <Link 
              to="/dashboard" 
              style={{...styles.sideNavLink, ...(isActive('/dashboard') ? styles.sideNavLinkActive : {})}}
            >
              📊 Dashboard
            </Link>

            {hasRole(user?.role || user?.role_label, ['admin', 'candidate_officer', 'management', 'documentation', 'documentation_head']) && (
              <div>
                <div style={styles.sectionHeading}>📄 Documentation</div>
                <Link 
                  to="/candidates" 
                  style={{...styles.sideNavLink, ...(isActive('/candidates') ? styles.sideNavLinkActive : {})}}
                >
                  🧑‍💼 Candidate Module
                </Link>
                <Link 
                  to="/document-controller" 
                  style={{...styles.sideNavLink, ...(isActive('/document-controller') ? styles.sideNavLinkActive : {})}}
                >
                  🗂 Document Controller
                </Link>
              </div>
            )}
            {/* Settings Section */}
            {(hasRole(user?.role || user?.role_label, ['admin', 'finance_officer', 'hr_officer', 'management', 'documentation', 'documentation_head', 'account'])) && (
              <div>
                <div style={styles.sectionHeading}>⚙️ Settings</div>
                {/* Candidates link moved to Documentation section */}
                {hasRole(user?.role || user?.role_label, ['admin']) && (
                  <Link 
                    to="/users" 
                    style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...(isActive('/users') ? styles.sideNavLinkActive : {})}}
                  >
                    👥 Users
                  </Link>
                )}
                {hasRole(user?.role || user?.role_label, ['admin', 'finance_officer', 'hr_officer', 'account']) && (
                  <Link 
                    to="/staff" 
                    style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...(isActive('/staff') ? styles.sideNavLinkActive : {})}}
                  >
                    👔 Staff
                  </Link>
                )}
                {hasRole(user?.role || user?.role_label, ['admin']) && (
                  <Link 
                    to="/clients" 
                    style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...((isActive('/clients') || isActive('/agencies')) ? styles.sideNavLinkActive : {})}}
                  >
                    🏢 Client
                  </Link>
                )}
                {hasRole(user?.role || user?.role_label, ['admin']) && (
                  <Link 
                    to="/bd" 
                    style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...(isActive('/bd') ? styles.sideNavLinkActive : {})}}
                  >
                    💼 BD
                  </Link>
                )}
                {hasRole(user?.role || user?.role_label, ['admin']) && (
                  <Link 
                    to="/project-settings" 
                    style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...(isActive('/project-settings') ? styles.sideNavLinkActive : {})}}
                  >
                    📁 Project
                  </Link>
                )}
                {hasRole(user?.role || user?.role_label, ['admin', 'documentation', 'documentation_head']) && (
                  <Link 
                    to="/settings/document-checklist" 
                    style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...(isActive('/settings/document-checklist') ? styles.sideNavLinkActive : {})}}
                  >
                    🗂 Status
                  </Link>
                )}
                {hasRole(user?.role || user?.role_label, ['admin', 'finance_officer', 'candidate_officer', 'documentation', 'documentation_head', 'account']) && (
                  <Link 
                    to="/reference" 
                    style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...(isActive('/reference') ? styles.sideNavLinkActive : {})}}
                  >
                    📎 Reference
                  </Link>
                )}
                {hasRole(user?.role || user?.role_label, ['admin', 'finance_officer', 'account']) && (
                  <Link 
                    to="/sub-head" 
                    style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...((isActive('/sub-head') || isActive('/expense-heads')) ? styles.sideNavLinkActive : {})}}
                  >
                    🧮 Sub Head
                  </Link>
                )}
              </div>
            )}
            
            {hasRole(user?.role || user?.role_label, ['admin', 'finance_officer', 'account']) && (
              <>
                <div style={styles.sectionHeading}>Visa Processing Section</div>
                <Link 
                  to="/candidate-flown" 
                  style={{...styles.sideNavLink, ...(isActive('/candidate-flown') ? styles.sideNavLinkActive : {})}}
                >
                    ✈️ Candidate Flown
                </Link>
                <div style={{ height: 8 }} />
                <div style={styles.sectionHeading}>Sourcing Report</div>
                <Link
                  to="/sourcing-report"
                  style={{...styles.sideNavLink, ...(isActive('/sourcing-report') ? styles.sideNavLinkActive : {})}}
                >
                  📍 Sourcing Report
                </Link>
              </>
            )}
            {hasRole(user?.role || user?.role_label, ['admin', 'candidate_officer', 'finance_officer']) && (
              <>
                <div style={{height:8}} />
                <div style={styles.sectionHeading}>Visa Tracking</div>
                <Link
                  to="/visa-details"
                  style={{...styles.sideNavLink, ...(isActive('/visa-details') ? styles.sideNavLinkActive : {})}}
                >
                  🛂 Visa Tracking
                </Link>
              </>
            )}
            {hasRole(user?.role || user?.role_label, ['admin', 'finance_officer', 'hr_officer', 'account']) && (
              <div>
                <div style={styles.sectionHeading}>💰 Finance</div>
                {hasRole(user?.role || user?.role_label, ['admin', 'finance_officer', 'account']) && (
                  <Link 
                    to="/daybook" 
                    style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...(isActive('/daybook') ? styles.sideNavLinkActive : {})}}
                  >
                    📖 Daily Daybook
                  </Link>
                )}
                {hasRole(user?.role || user?.role_label, ['admin']) && (
                  <Link
                    to="/daybook-approval"
                    style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...(isActive('/daybook-approval') ? styles.sideNavLinkActive : {})}}
                  >
                    ✅ Daybook Approval
                  </Link>
                )}
                <Link 
                  to="/payroll" 
                  style={{...styles.sideNavLink, ...styles.sideNavSubLink, ...(isActive('/payroll') ? styles.sideNavLinkActive : {})}}
                >
                  💼 Payroll
                </Link>
              </div>
            )}
            {hasRole(user?.role || user?.role_label, ['admin', 'finance_officer', 'account']) && (
              <Link 
                to="/reports" 
                style={{...styles.sideNavLink, ...(isActive('/reports') ? styles.sideNavLinkActive : {})}}
              >
                📈 Reports
              </Link>
            )}
            <Link
              to="/security"
              style={{...styles.sideNavLink, ...(isActive('/security') ? styles.sideNavLinkActive : {})}}
            >
              🔐 Security
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <div style={styles.mainContent}>
          <div style={styles.contentHeader}>
            <div>
              <h1 style={styles.title}>{title}</h1>
            </div>
            {headerExtra && <div>{headerExtra}</div>}
          </div>
          {children}
        </div>
      </div>
      <div style={styles.legalNotice}>
        © {new Date().getFullYear()} Motherland Overseas. All rights reserved.
        No part of this system may be used, copied, reproduced, or distributed
        without prior written permission.
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'transparent',
    fontFamily: "'Outfit', 'Segoe UI', sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  header_top: {
    background: 'linear-gradient(90deg, #0a3772 0%, #0f4d9d 55%, #1c6bd0 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.18)',
    padding: '0 24px',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    boxShadow: '0 12px 30px rgba(10, 55, 114, 0.24)',
  },
  headerBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  headerLogo: {
    width: 32,
    height: 32,
    objectFit: 'contain',
    filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.2))',
  },
  headerBrandText: {
    color: '#f7fbff',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.03em',
    maxWidth: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  headerUser: { display: 'flex', alignItems: 'center', gap: 10 },
  userBadge: {
    background: 'rgba(255,255,255,0.16)',
    color: '#e6f1ff',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.24)',
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  userName: { color: '#f6f9ff', fontSize: 13, fontWeight: 600 },
  logoutBtn: {
    background: 'linear-gradient(135deg, #fb7185, #dc2626)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    boxShadow: '0 10px 20px rgba(220, 38, 38, 0.28)',
  },
  mainLayout: { display: 'flex', flex: 1, overflow: 'hidden', padding: 16, gap: 14 },
  legalNotice: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    padding: '12px 16px',
    background: 'rgba(15, 39, 66, 0.92)',
    borderTop: '1px solid rgba(255,255,255,0.12)',
    marginTop: 'auto',
    lineHeight: 1.5,
    fontFamily: "'Outfit', 'Segoe UI', sans-serif",
  },
  sidebar: {
    width: 260,
    background: 'linear-gradient(170deg, rgba(12,44,86,0.95), rgba(18,63,120,0.92))',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20,
    overflowY: 'auto',
    padding: '16px 0',
    boxShadow: '0 22px 38px rgba(8, 34, 70, 0.25)',
  },
  sideNav: { display: 'flex', flexDirection: 'column', gap: 0 },
  sideNavLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#dbeafe',
    textDecoration: 'none',
    margin: '2px 10px',
    borderRadius: 12,
    padding: '11px 14px',
    fontSize: 14,
    fontWeight: 600,
    border: '1px solid transparent',
    transition: 'all 0.2s ease',
  },
  sideNavLinkActive: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))',
    color: '#ffffff',
    borderColor: 'rgba(255,255,255,0.25)',
    boxShadow: '0 8px 20px rgba(6, 24, 51, 0.24)',
  },
  sideNavSubLink: { marginLeft: 18, fontSize: 13 },
  sectionHeading: {
    color: '#9cc2f8',
    fontSize: 11,
    fontWeight: 800,
    padding: '16px 20px 8px 20px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginTop: 8,
  },
  mainContent: {
    flex: 1,
    overflow: 'auto',
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.72)',
    background: 'rgba(255,255,255,0.76)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    boxShadow: '0 16px 32px rgba(17, 34, 64, 0.08)',
    padding: 24,
  },
  contentHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottom: '1px solid #d9e3f1',
    paddingBottom: 14,
  },
  title: { fontSize: 28, fontWeight: 800, color: '#0f2a4f', margin: 0 },
}
