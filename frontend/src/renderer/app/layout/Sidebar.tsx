import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Plus,
  Users,
  Settings,
  Info,
  Loader2,
} from 'lucide-react'
import { currentUser, getInitials } from '../../store/mockData'
import { getStoredUser } from '../../lib/api/auth'
import { Modal } from '../../components/ui/Modal'
import { CreateMeetingForm } from '../../features/meetings/components/CreateMeetingForm'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const Sidebar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const storedUser = getStoredUser()
  const displayUser = storedUser || currentUser
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const handleCreateSuccess = (meetingId?: string) => {
    setIsCreateModalOpen(false)
    if (meetingId) {
      navigate(`/app/meetings/${meetingId}/detail`)
    }
  }

  const navItems: NavItem[] = [
    { path: '/app/meetings', label: 'Các cuộc họp', icon: <Users size={20} /> },
  ]

  const bottomNavItems: NavItem[] = [
    { path: '/app/settings', label: 'Cài đặt', icon: <Settings size={20} /> },
    { path: '/about', label: 'Giới thiệu', icon: <Info size={20} /> },
  ]

  return (
    <aside className="sidebar app-shell__sidebar">
      {/* Logo */}
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon" style={{ padding: 0, background: 'transparent' }}>
            <img
              src="/minute_icon.svg"
              alt="Minute"
              style={{ width: 40, height: 40, objectFit: 'contain' }}
            />
          </div>
          <span className="sidebar__logo-text">Minute</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {/* New Meeting Button */}
        <div className="sidebar__nav-section">
          <ul className="sidebar__nav-list">
            <li className="sidebar__nav-item">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="sidebar__nav-link sidebar__nav-link--action"
                style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }}
              >
                <span className="sidebar__nav-icon">
                  <Plus size={20} />
                </span>
                <span className="sidebar__nav-label">
                  Cuộc họp mới
                </span>
              </button>
            </li>
            {navItems.map((item) => (
              <li key={item.path} className="sidebar__nav-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) => {
                    const active = isActive || location.pathname.startsWith('/app/meetings/')
                    return `sidebar__nav-link ${active ? 'active' : ''}`
                  }}
                >
                  <span className="sidebar__nav-icon">{item.icon}</span>
                  <span className="sidebar__nav-label">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottom Navigation */}
        <div className="sidebar__nav-section">
          <ul className="sidebar__nav-list">
            {bottomNavItems.map((item) => (
              <li key={item.path} className="sidebar__nav-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar__nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  <span className="sidebar__nav-icon">{item.icon}</span>
                  <span className="sidebar__nav-label">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* User Profile */}
      <div className="sidebar__footer">
        <div className="sidebar__user">
          <div className="sidebar__avatar">
            {getInitials(displayUser.display_name || displayUser.displayName || 'U')}
          </div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{displayUser.display_name || displayUser.displayName}</div>
            <div className="sidebar__user-role">{displayUser.role || 'User'}</div>
          </div>
        </div>
      </div>

      {/* Create Meeting Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo phiên làm việc mới"
        size="lg"
      >
        <CreateMeetingForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>
    </aside>
  )
}

export default Sidebar


