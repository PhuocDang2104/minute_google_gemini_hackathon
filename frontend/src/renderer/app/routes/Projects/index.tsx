import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  FileText,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { projectsApi } from '../../../lib/api/projects'
import { meetingsApi } from '../../../lib/api/meetings'
import { USE_API } from '../../../config/env'
import type { Project } from '../../../shared/dto/project'
import { Modal } from '../../../components/ui/Modal'
import { meetings as mockMeetings } from '../../../store/mockData'
import { useLocaleText } from '../../../i18n/useLocaleText'

const palette = [
  { hue: '#f7a745', bg: 'linear-gradient(135deg, rgba(247, 167, 69, 0.2), rgba(247, 167, 69, 0.02))' },
  { hue: '#3b82f6', bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(59, 130, 246, 0.02))' },
  { hue: '#10b981', bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(16, 185, 129, 0.02))' },
  { hue: '#f97316', bg: 'linear-gradient(135deg, rgba(249, 115, 22, 0.18), rgba(249, 115, 22, 0.02))' },
  { hue: '#ec4899', bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.16), rgba(236, 72, 153, 0.02))' },
  { hue: '#6366f1', bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(99, 102, 241, 0.02))' },
]

const hashKey = (value: string) => value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

const getPalette = (key: string) => {
  const idx = Math.abs(hashKey(key)) % palette.length
  return palette[idx]
}

const Projects = () => {
  const navigate = useNavigate()
  const { lt } = useLocaleText()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [standaloneCount, setStandaloneCount] = useState(0)

  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    description: '',
    objective: '',
  })

  const totalProjects = projects.length
  const totalMeetings = projects.reduce((sum, p) => sum + (p.meeting_count || 0), 0)
  const totalDocuments = projects.reduce((sum, p) => sum + (p.document_count || 0), 0)

  const loadProjects = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!USE_API) {
        const names = Array.from(new Set(mockMeetings.map(m => m.project).filter(Boolean)))
        const mockProjects = names.map((name, idx) => ({
          id: `mock-${idx}`,
          name,
          code: `PR-${idx + 1}`,
          description: `Không gian dự án ${name}`,
          meeting_count: mockMeetings.filter(m => m.project === name).length,
          document_count: Math.max(1, idx % 3),
          member_count: 4 + (idx % 5),
        })) as Project[]
        setProjects(mockProjects)
        setStandaloneCount(0)
        setIsLoading(false)
        return
      }

      const response = await projectsApi.list({ search, limit: 200 })
      setProjects(response.projects)

      const meetingSummary = await meetingsApi.list({ limit: 1 })
      const total = meetingSummary.total || meetingSummary.meetings.length
      const grouped = response.projects.reduce((sum, p) => sum + (p.meeting_count || 0), 0)
      setStandaloneCount(Math.max(0, total - grouped))
    } catch (err) {
      console.error('Failed to load projects:', err)
      setError(lt('Không thể tải danh sách dự án. Vui lòng thử lại.', 'Unable to load project list. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }, [lt, search])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleCreateProject = async () => {
    if (!createForm.name.trim()) return
    try {
      const created = await projectsApi.create({
        name: createForm.name.trim(),
        code: createForm.code.trim() || undefined,
        description: createForm.description.trim() || undefined,
        objective: createForm.objective.trim() || undefined,
      })
      setShowCreateModal(false)
      setCreateForm({ name: '', code: '', description: '', objective: '' })
      setProjects(prev => [created, ...prev])
    } catch (err) {
      console.error('Create project failed:', err)
      setError(lt('Không thể tạo dự án. Vui lòng thử lại.', 'Unable to create project. Please try again.'))
    }
  }

  const heroStats = useMemo(() => ([
    { label: lt('Dự án', 'Projects'), value: totalProjects },
    { label: lt('Phiên', 'Sessions'), value: totalMeetings },
    { label: lt('Tài liệu', 'Documents'), value: totalDocuments },
  ]), [lt, totalProjects, totalMeetings, totalDocuments])

  return (
    <div className="projects-page">
      <header className="projects-hero">
        <div className="projects-hero__content">
          <div className="projects-hero__eyebrow">
            <Sparkles size={14} />
            Workspace
          </div>
          <h1>{lt('Dự án', 'Projects')}</h1>
          <p>{lt('Tạo không gian làm việc theo dòng dự án, tổ chức phiên họp và quản lý tài liệu tập trung.', 'Create focused workspaces for projects, sessions, and documents.')}</p>
          <div className="projects-hero__actions">
            <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              {lt('Tạo dự án', 'Create project')}
            </button>
            <button className="btn btn--secondary" onClick={() => navigate('/app/meetings')}>
              <FolderOpen size={16} />
              {lt('Xem tất cả phiên', 'View all sessions')}
            </button>
          </div>
        </div>
        <div className="projects-hero__meta">
          {heroStats.map(stat => (
            <div key={stat.label} className="projects-hero__stat">
              <div className="projects-hero__stat-value">{stat.value}</div>
              <div className="projects-hero__stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </header>

      <section className="projects-toolbar">
        <div className="projects-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lt('Tìm theo tên dự án, mã code...', 'Search by project name or code...')}
          />
        </div>
        <button className="btn btn--ghost" onClick={loadProjects} title={lt('Làm mới', 'Refresh')} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </section>

      {error && (
        <div className="projects-banner projects-banner--error">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="projects-loading">
          <div className="spinner" style={{ width: 32, height: 32 }}></div>
          <p>{lt('Đang tải dự án...', 'Loading projects...')}</p>
        </div>
      )}

      {!isLoading && (
        <div className="projects-grid">
          <div className="project-card project-card--standalone">
            <div className="project-card__cover">
              <div className="project-card__icon">
                <FolderOpen size={20} />
              </div>
              <span>{lt('Phiên lẻ', 'Standalone')}</span>
            </div>
            <div className="project-card__body">
              <h3>{lt('Phiên làm việc độc lập', 'Standalone sessions')}</h3>
              <p>{lt('Các phiên chưa thuộc bất kỳ dự án nào.', 'Sessions not yet linked to any project.')}</p>
              <div className="project-card__stats">
                <span>
                  <Calendar size={14} />
                  {standaloneCount} {lt('phiên', 'sessions')}
                </span>
              </div>
              <button className="btn btn--secondary" onClick={() => navigate('/app/meetings')}>
                {lt('Xem danh sách', 'View list')}
              </button>
            </div>
          </div>

          {projects.map(project => {
            const style = getPalette(project.id || project.name)
            return (
              <Link
                key={project.id}
                to={`/app/projects/${project.id}`}
                className="project-card"
                style={{ borderColor: style.hue }}
              >
                <div className="project-card__cover" style={{ background: style.bg }}>
                  <div className="project-card__icon" style={{ color: style.hue }}>
                    <FolderOpen size={20} />
                  </div>
                  <span>{project.code || 'PROJECT'}</span>
                </div>
                <div className="project-card__body">
                  <h3>{project.name}</h3>
                  <p>{project.description || lt('Chưa có mô tả. Bạn có thể cập nhật thêm.', 'No description yet. You can update this project.')}</p>
                  <div className="project-card__stats">
                    <span>
                      <Calendar size={14} />
                      {project.meeting_count ?? 0} {lt('phiên', 'sessions')}
                    </span>
                    <span>
                      <FileText size={14} />
                      {project.document_count ?? 0} {lt('tài liệu', 'documents')}
                    </span>
                  </div>
                  <div className="project-card__cta">{lt('Mở dự án', 'Open project')}</div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={lt('Tạo dự án mới', 'Create new project')}
        size="lg"
      >
        <div className="project-modal">
          <div className="project-modal__grid">
            <label>
              <span>{lt('Tên dự án *', 'Project name *')}</span>
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={lt('VD: Core Banking Modernization', 'e.g. Core Banking Modernization')}
              />
            </label>
            <label>
              <span>{lt('Mã dự án', 'Project code')}</span>
              <input
                value={createForm.code}
                onChange={(e) => setCreateForm(prev => ({ ...prev, code: e.target.value }))}
                placeholder="CB-2024"
              />
            </label>
            <label className="project-modal__full">
              <span>{lt('Mô tả', 'Description')}</span>
              <textarea
                rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder={lt('Tóm tắt dự án, pháp vi, stakeholder...', 'Project summary, scope, stakeholders...')}
              />
            </label>
            <label className="project-modal__full">
              <span>{lt('Mục tiêu', 'Objective')}</span>
              <textarea
                rows={3}
                value={createForm.objective}
                onChange={(e) => setCreateForm(prev => ({ ...prev, objective: e.target.value }))}
                placeholder={lt('Mô tả các OKR, goal chính...', 'Describe key OKRs and goals...')}
              />
            </label>
          </div>
          <div className="project-modal__actions">
            <button className="btn btn--secondary" onClick={() => setShowCreateModal(false)}>
              {lt('Hủy', 'Cancel')}
            </button>
            <button className="btn btn--primary" onClick={handleCreateProject} disabled={!createForm.name.trim()}>
              {lt('Tạo dự án', 'Create project')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Projects
