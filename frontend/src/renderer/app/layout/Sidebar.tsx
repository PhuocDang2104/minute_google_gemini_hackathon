import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Plus,
  LayoutGrid,
  Settings,
  Info,
  FolderPlus,
  Calendar,
} from 'lucide-react'
import { currentUser, getInitials } from '../../store/mockData'
import { getStoredUser } from '../../lib/api/auth'
import { Modal } from '../../components/ui/Modal'
import { CreateMeetingForm } from '../../features/meetings/components/CreateMeetingForm'
import { projectsApi } from '../../lib/api/projects'
import { USE_API } from '../../config/env'

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

  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false)
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [createProjectForm, setCreateProjectForm] = useState({
    name: '',
    code: '',
    description: '',
    objective: '',
  })

  const handleCreateSuccess = (meetingId?: string) => {
    setIsMeetingModalOpen(false)
    if (meetingId) {
      navigate(`/app/meetings/${meetingId}/detail`)
    }
  }

  const openNewProject = () => {
    setIsCreateMenuOpen(false)
    setProjectError(null)
    setIsProjectModalOpen(true)
  }

  const openNewSession = () => {
    setIsCreateMenuOpen(false)
    setIsMeetingModalOpen(true)
  }

  const handleCreateProject = async () => {
    if (!createProjectForm.name.trim()) return
    setIsCreatingProject(true)
    setProjectError(null)

    try {
      if (!USE_API) {
        setIsProjectModalOpen(false)
        setCreateProjectForm({ name: '', code: '', description: '', objective: '' })
        return
      }

      const created = await projectsApi.create({
        name: createProjectForm.name.trim(),
        code: createProjectForm.code.trim() || undefined,
        description: createProjectForm.description.trim() || undefined,
        objective: createProjectForm.objective.trim() || undefined,
      })
      setIsProjectModalOpen(false)
      setCreateProjectForm({ name: '', code: '', description: '', objective: '' })
      navigate(`/app/projects/${created.id}`)
    } catch (err) {
      console.error('Create project failed:', err)
      setProjectError('Không thể tạo dự án. Vui lòng thử lại.')
    } finally {
      setIsCreatingProject(false)
    }
  }

  const navItems: NavItem[] = [
    { path: '/app/meetings', label: 'Workspace', icon: <LayoutGrid size={20} /> },
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
        <div className="sidebar__nav-section">
          <ul className="sidebar__nav-list">
            <li className="sidebar__nav-item">
              <button
                onClick={() => setIsCreateMenuOpen(true)}
                className="sidebar__nav-link sidebar__nav-link--action"
                style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }}
              >
                <span className="sidebar__nav-icon">
                  <Plus size={20} />
                </span>
                <span className="sidebar__nav-label">
                  Tạo mới
                </span>
              </button>
            </li>
            {navItems.map((item) => (
              <li key={item.path} className="sidebar__nav-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) => {
                    const active = isActive || location.pathname.startsWith(`${item.path}/`)
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

        <div style={{ flex: 1 }} />

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

      {/* Create Menu */}
      <Modal
        isOpen={isCreateMenuOpen}
        onClose={() => setIsCreateMenuOpen(false)}
        title="Tạo mới"
        size="sm"
      >
        <div className="create-menu">
          <button className="create-menu__item" onClick={openNewProject}>
            <div className="create-menu__icon">
              <FolderPlus size={18} />
            </div>
            <div className="create-menu__content">
              <div className="create-menu__title">Dự án mới</div>
              <div className="create-menu__desc">Tạo folder dự án mới</div>
            </div>
          </button>
          <button className="create-menu__item" onClick={openNewSession}>
            <div className="create-menu__icon create-menu__icon--alt">
              <Calendar size={18} />
            </div>
            <div className="create-menu__content">
              <div className="create-menu__title">Phiên mới</div>
              <div className="create-menu__desc">Tạo phiên làm việc mới</div>
            </div>
          </button>
        </div>
      </Modal>

      {/* Create Meeting Modal */}
      <Modal
        isOpen={isMeetingModalOpen}
        onClose={() => setIsMeetingModalOpen(false)}
        title="Tạo phiên làm việc mới"
        size="lg"
      >
        <CreateMeetingForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setIsMeetingModalOpen(false)}
        />
      </Modal>

      {/* Create Project Modal */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        title="Tạo dự án mới"
        size="lg"
      >
        <div className="project-modal">
          {projectError && (
            <div className="form-error">
              {projectError}
            </div>
          )}
          <div className="project-modal__grid">
            <label>
              <span>Tên dự án *</span>
              <input
                value={createProjectForm.name}
                onChange={(e) => setCreateProjectForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="VD: Core Banking Modernization"
              />
            </label>
            <label>
              <span>Mã dự án</span>
              <input
                value={createProjectForm.code}
                onChange={(e) => setCreateProjectForm(prev => ({ ...prev, code: e.target.value }))}
                placeholder="CB-2024"
              />
            </label>
            <label className="project-modal__full">
              <span>Mô tả</span>
              <textarea
                rows={3}
                value={createProjectForm.description}
                onChange={(e) => setCreateProjectForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Tóm tắt dự án, phạm vi, stakeholder..."
              />
            </label>
            <label className="project-modal__full">
              <span>Mục tiêu</span>
              <textarea
                rows={3}
                value={createProjectForm.objective}
                onChange={(e) => setCreateProjectForm(prev => ({ ...prev, objective: e.target.value }))}
                placeholder="Mô tả các OKR, goal chính..."
              />
            </label>
          </div>
          <div className="project-modal__actions">
            <button className="btn btn--secondary" onClick={() => setIsProjectModalOpen(false)} disabled={isCreatingProject}>
              Hủy
            </button>
            <button className="btn btn--primary" onClick={handleCreateProject} disabled={!createProjectForm.name.trim() || isCreatingProject}>
              {isCreatingProject ? 'Đang tạo...' : 'Tạo dự án'}
            </button>
          </div>
        </div>
      </Modal>
    </aside>
  )
}

export default Sidebar
