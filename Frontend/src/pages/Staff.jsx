import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import SidebarLayout from '../components/SidebarLayout'
import api from '../api'

export default function Staff() {
  const { user } = useAuth()
  const roleLower = (user?.role || user?.role_label || '').toLowerCase().replace(/ /g, '_')
  const isFinanceOfficer = roleLower === 'finance_officer'
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [departments, setDepartments] = useState([])
  const [sortField, setSortField] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    position: '',
    employment_type: 'full_time',
    hire_date: '',
    department: '',
    base_salary: '',
    status: 'active',
    notes: '',
  })

  useEffect(() => {
    fetchStaff()
  }, [search, filterStatus, filterDepartment, currentPage])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        per_page: 15,
        page: currentPage,
      })
      if (search) params.append('search', search)
      if (filterStatus) params.append('status', filterStatus)
      if (filterDepartment) params.append('department', filterDepartment)

      const response = await api.get(`/staff?${params.toString()}`)
      const payload = response?.data?.data
      const staffRows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.staff)
          ? payload.staff
          : Array.isArray(payload?.data)
            ? payload.data
            : []

      setStaff(staffRows)
      extractDepartments(staffRows)
    } catch (error) {
      console.error('Error fetching staff:', error)
      setStaff([])
      setDepartments([])
    } finally {
      setLoading(false)
    }
  }

  const extractDepartments = (staffList) => {
    const depts = [...new Set(staffList.map(s => s.department).filter(Boolean))]
    setDepartments(depts)
  }

  const handleSort = (field) => {
    if (field !== 'name') return

    setSortDirection((current) => {
      if (sortField !== field) return 'asc'
      return current === 'asc' ? 'desc' : 'asc'
    })
    setSortField(field)
  }

  const sortedStaff = useMemo(() => {
    const rows = [...staff]

    rows.sort((left, right) => {
      const leftName = String(left?.full_name || '').trim().toLowerCase()
      const rightName = String(right?.full_name || '').trim().toLowerCase()

      if (sortField === 'name') {
        return sortDirection === 'asc'
          ? leftName.localeCompare(rightName)
          : rightName.localeCompare(leftName)
      }

      return 0
    })

    return rows
  }, [staff, sortField, sortDirection])

  const getSortIndicator = () => {
    if (sortField !== 'name') return ''
    return sortDirection === 'asc' ? ' ▲' : ' ▼'
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const saveStaff = async () => {
    if (!formData.full_name || !formData.employment_type) {
      alert('Please fill in required fields')
      return
    }

    try {
      if (selectedStaff) {
        // Update
        const response = await api.put(`/staff/${selectedStaff.id}`, {
          ...formData,
          base_salary: formData.base_salary ? parseFloat(formData.base_salary) : null,
        })

        if (response.data.success) {
          alert('Staff member updated successfully')
          resetForm()
          fetchStaff()
        }
      } else {
        // Create
        const confirmed = window.confirm('Are you sure you want to create this record?')
        if (!confirmed) {
          return
        }

        const response = await api.post('/staff', {
          ...formData,
          base_salary: formData.base_salary ? parseFloat(formData.base_salary) : null,
        })

        if (response.data.success) {
          alert('Staff member created successfully')
          resetForm()
          fetchStaff()
        }
      }
    } catch (error) {
      console.error('Error saving staff:', error)
      alert(error.response?.data?.message || 'Error saving staff member')
    }
  }

  const deleteStaff = async (staffId) => {
    if (!confirm('Are you sure you want to delete this staff member?')) {
      return
    }

    try {
      const response = await api.delete(`/staff/${staffId}`)
      if (response.data.success) {
        alert('Staff member deleted successfully')
        fetchStaff()
        if (selectedStaff?.id === staffId) {
          setSelectedStaff(null)
        }
      }
    } catch (error) {
      console.error('Error deleting staff:', error)
      alert(error.response?.data?.message || 'Error deleting staff member')
    }
  }

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      position: '',
      employment_type: 'full_time',
      hire_date: '',
      department: '',
      base_salary: '',
      status: 'active',
      notes: '',
    })
    setSelectedStaff(null)
    setShowForm(false)
  }

  const editStaff = (staffMember) => {
    setSelectedStaff(staffMember)
    setFormData({
      full_name: staffMember.full_name,
      email: staffMember.email || '',
      phone: staffMember.phone || '',
      position: staffMember.position || '',
      employment_type: staffMember.employment_type || 'full_time',
      hire_date: staffMember.hire_date || '',
      department: staffMember.department || '',
      base_salary: staffMember.base_salary || '',
      status: staffMember.status || 'active',
      notes: staffMember.notes || '',
    })
    setShowForm(true)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#22c55e'
      case 'inactive':
        return '#ef4444'
      case 'on_leave':
        return '#eab308'
      case 'terminated':
        return '#6b7280'
      default:
        return '#94a3b8'
    }
  }

  return (
    <SidebarLayout title="Staff Management" headerExtra={
      <button style={styles.addBtn} onClick={() => {
        resetForm()
        setShowForm(true)
      }}>
        + Add Staff
      </button>
    }>
      <div style={styles.container}>
        {/* Filters and Search */}
        <div style={styles.filterBar}>
          <input
            type="text"
            placeholder="Search staff by name, email, or position..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            style={styles.searchInput}
          />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setCurrentPage(1)
            }}
            style={styles.selectInput}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="on_leave">On Leave</option>
            <option value="terminated">Terminated</option>
          </select>
          <select
            value={filterDepartment}
            onChange={(e) => {
              setFilterDepartment(e.target.value)
              setCurrentPage(1)
            }}
            style={styles.selectInput}
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {/* Create/Edit Form */}
        {showForm && (
          <div style={styles.formContainer}>
            <h3 style={styles.formTitle}>{selectedStaff ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label>Full Name *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleFormChange}
                  placeholder="Enter full name"
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  placeholder="staff@mopl.test"
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  placeholder="+353 1 234 5678"
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Position</label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleFormChange}
                  placeholder="e.g., Senior Technician"
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Employment Type *</label>
                <select
                  name="employment_type"
                  value={formData.employment_type}
                  onChange={handleFormChange}
                  style={styles.formInput}
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="temporary">Temporary</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label>Hire Date</label>
                <input
                  type="date"
                  name="hire_date"
                  value={formData.hire_date}
                  onChange={handleFormChange}
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Department</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleFormChange}
                  placeholder="e.g., Operations"
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Base Salary</label>
                <input
                  type="number"
                  name="base_salary"
                  value={formData.base_salary}
                  onChange={handleFormChange}
                  placeholder="0.00"
                  step="0.01"
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Status *</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  style={styles.formInput}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              <div style={{...styles.formGroup, gridColumn: 'span 3'}}>
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleFormChange}
                  placeholder="Additional information..."
                  style={{...styles.formInput, minHeight: 80}}
                />
              </div>
            </div>

            <div style={styles.formActions}>
              <button style={styles.saveBtn} onClick={saveStaff}>
                {selectedStaff ? 'Update Staff' : 'Create Staff'}
              </button>
              <button style={styles.cancelBtn} onClick={resetForm}>Cancel</button>
            </div>
          </div>
        )}

        {/* Staff Table */}
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.tableCell}><button style={styles.sortButton} onClick={() => handleSort('name')}>Name{getSortIndicator()}</button></th>
                <th style={styles.tableCell}>Email</th>
                <th style={styles.tableCell}>Position</th>
                <th style={styles.tableCell}>Department</th>
                <th style={styles.tableCell}>Employment Type</th>
                <th style={styles.tableCell}>Base Salary</th>
                <th style={styles.tableCell}>Status</th>
                <th style={styles.tableCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{...styles.tableCell, textAlign: 'center'}}>Loading...</td>
                </tr>
              ) : sortedStaff.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{...styles.tableCell, textAlign: 'center', color: '#999'}}>No staff members found</td>
                </tr>
              ) : (
                sortedStaff.map(s => (
                  <tr key={s.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>
                      <strong>{s.full_name}</strong>
                    </td>
                    <td style={styles.tableCell}>{s.email || '-'}</td>
                    <td style={styles.tableCell}>{s.position || '-'}</td>
                    <td style={styles.tableCell}>{s.department || '-'}</td>
                    <td style={styles.tableCell}>
                      <span style={styles.badge}>
                        {s.employment_type?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      NPR {parseFloat(s.base_salary || 0).toFixed(2)}
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{
                        background: getStatusColor(s.status),
                        color: '#fff',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {s.status?.toUpperCase().replace('_', ' ')}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      <button
                        style={styles.editBtn}
                        onClick={() => editStaff(s)}
                      >
                        Edit
                      </button>
                      {!isFinanceOfficer && (
                        <button
                          style={styles.deleteBtn}
                          onClick={() => deleteStaff(s.id)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SidebarLayout>
  )
}

const styles = {
  container: { padding: 0 },
  addBtn: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  filterBar: { display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 },
  selectInput: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 },
  formContainer: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 },
  formTitle: { margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#1e293b' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  formInput: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' },
  formActions: { display: 'flex', gap: 12 },
  saveBtn: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
  cancelBtn: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
  tableWrapper: { overflowX: 'auto', marginBottom: 20 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' },
  tableRow: { borderBottom: '1px solid #e5e7eb', ':hover': { background: '#f9fafb' } },
  tableCell: { padding: '12px', textAlign: 'left', fontSize: 14, color: '#374151' },
  sortButton: { background: 'transparent', border: 'none', padding: 0, color: '#1e293b', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' },
  badge: { background: '#e5e7eb', color: '#374151', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 },
  editBtn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12, marginRight: 4 },
  deleteBtn: { background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 },
}
