import { Link } from 'react-router-dom'
import SidebarLayout from '../components/SidebarLayout'

export default function Reports() {
  return (
    <SidebarLayout title="Reports">
      <div style={styles.container} className="reveal-up">
        <h2 style={styles.heading}>Reports</h2>
        <div style={styles.grid}>
          <Link to="/reports/company-profit-loss" style={styles.card}>
            <div style={styles.cardTitle}>Company Profit and Loss</div>
            <div style={styles.cardDesc}>Open the company profit and loss report for daily, weekly, and monthly totals.</div>
          </Link>

          <Link to="/reports/candidate" style={styles.card}>
            <div style={styles.cardTitle}>Candidate Wise Report</div>
            <div style={styles.cardDesc}>View reports grouped by candidate and their payment/history.</div>
          </Link>

          <Link to="/reports/client" style={styles.card}>
            <div style={styles.cardTitle}>Client Wise Report</div>
            <div style={styles.cardDesc}>View reports per client, invoices, and balances.</div>
          </Link>

          <Link to="/reports/project" style={styles.card}>
            <div style={styles.cardTitle}>Project Wise Report</div>
            <div style={styles.cardDesc}>View reports grouped by project and office totals.</div>
          </Link>
        </div>
      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: { display: 'grid', gap: 12, padding: 6 },
  heading: { margin: 0, fontSize: 20, color: '#0f2742' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 8 },
  card: { display: 'block', padding: 14, background: 'white', border: '1px solid #e6eef9', borderRadius: 12, textDecoration: 'none', color: '#0f2742' },
  cardTitle: { fontWeight: 800, fontSize: 15 },
  cardDesc: { marginTop: 6, fontSize: 13, color: '#5f779b' },
}

