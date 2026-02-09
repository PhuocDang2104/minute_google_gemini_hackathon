import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  MoreVertical,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'
import { meetings as mockMeetings, formatDate } from '../../../store/mockData'
import { meetingsApi } from '../../../lib/api/meetings'
import { projectsApi } from '../../../lib/api/projects'
import { USE_API } from '../../../config/env'
import type { Meeting, MeetingPhase } from '../../../shared/dto/meeting'
import type { Project } from '../../../shared/dto/project'
import { Modal } from '../../../components/ui/Modal'
import { useLocaleText } from '../../../i18n/useLocaleText'

const getSessionTypeLabel = (meeting: Meeting) => (
  meeting.meeting_type === 'study_session' ? 'Course' : 'Meeting'
)

const Meetings = () => {
  const { lt } = useLocaleText()
  const [projects, setProjects] = useState<Project[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [sessionsOpen, setSessionsOpen] = useState(true)
  const [openMenu, setOpenMenu] = useState<{ type: 'project' | 'session'; id: string } | null>(null)
  const [renameModal, setRenameModal] = useState<{
    type: 'project' | 'session'
    id: string
    label: string
    value: string
  } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  useEffect(() => {
    if (!openMenu) return
    const handleClick = () => setOpenMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [openMenu])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!USE_API) {
        const mappedMeetings: Meeting[] = mockMeetings.map(m => ({
          id: m.id,
          title: m.title,
          description: m.description,
          meeting_type: m.meetingType as any,
          phase: m.phase as MeetingPhase,
          start_time: m.startTime.toISOString(),
          end_time: m.endTime.toISOString(),
          created_at: m.startTime.toISOString(),
          location: m.location,
          project_id: m.project ? `mock-${m.project.toLowerCase().replace(/\\s+/g, '-')}` : undefined,
        }))

        const mockProjects: Project[] = Array.from(
          new Map(
            mockMeetings
              .filter(m => m.project)
              .map((m, idx) => {
                const id = `mock-${m.project.toLowerCase().replace(/\\s+/g, '-')}`
                return [
                  id,
                  {
                    id,
                    name: m.project,
                    code: `PR-${idx + 1}`,
                    description: `Workspace dự án ${m.project}`,
                    meeting_count: mockMeetings.filter(mm => mm.project === m.project).length,
                    document_count: Math.max(1, idx % 4),
                    member_count: 4 + (idx % 6),
                  },
                ]
              }),
          ).values(),
        )

        setMeetings(mappedMeetings)
        setProjects(mockProjects)
        setIsLoading(false)
        return
      }

      const [projectRes, meetingRes] = await Promise.allSettled([
        projectsApi.list({ limit: 200 }),
        meetingsApi.list({ limit: 400 }),
      ])

      let meetingFailed = false
      let projectFailed = false

      if (meetingRes.status === 'fulfilled') {
        setMeetings(meetingRes.value.meetings || [])
      } else {
        meetingFailed = true
        setMeetings([])
      }

      if (projectRes.status === 'fulfilled') {
        setProjects(projectRes.value.projects || [])
      } else {
        projectFailed = true
        setProjects([])
      }

      if (meetingFailed) {
        setError(lt('Không thể tải dữ liệu cuộc họp. Vui lòng thử lại.', 'Unable to load meeting data. Please try again.'))
      } else if (projectFailed) {
        setError(lt('Không thể tải danh sách dự án. Các phiên lẻ vẫn hiển thị.', 'Unable to load projects. Standalone sessions are still shown.'))
      }
    } catch (err) {
      console.error('Failed to load meetings workspace:', err)
      setError(lt('Không thể tải dữ liệu cuộc họp. Vui lòng thử lại.', 'Unable to load meeting data. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const normalizedSearch = search.trim().toLowerCase()
  const projectNameById = useMemo(
    () => new Map(projects.map(project => [project.id, project.name])),
    [projects],
  )

  const filteredProjects = useMemo(() => {
    if (!normalizedSearch) return projects
    return projects.filter(project => (
      project.name?.toLowerCase().includes(normalizedSearch)
      || project.code?.toLowerCase().includes(normalizedSearch)
      || project.description?.toLowerCase().includes(normalizedSearch)
      || project.objective?.toLowerCase().includes(normalizedSearch)
    ))
  }, [projects, normalizedSearch])

  const filteredMeetings = useMemo(() => {
    if (!normalizedSearch) return meetings
    return meetings.filter(meeting => (
      meeting.title?.toLowerCase().includes(normalizedSearch)
      || meeting.description?.toLowerCase().includes(normalizedSearch)
      || getSessionTypeLabel(meeting).toLowerCase().includes(normalizedSearch)
      || (meeting.project_id ? (projectNameById.get(meeting.project_id) || '').toLowerCase().includes(normalizedSearch) : false)
    ))
  }, [meetings, normalizedSearch, projectNameById])

  const recentMeetings = useMemo(() => (
    filteredMeetings
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a.start_time || '').getTime()
        const timeB = new Date(b.created_at || b.start_time || '').getTime()
        return timeB - timeA
      })
  ), [filteredMeetings])

  const toggleMenu = (type: 'project' | 'session', id: string) => {
    setOpenMenu((prev) => {
      if (prev && prev.type === type && prev.id === id) return null
      return { type, id }
    })
  }

  const closeMenu = () => setOpenMenu(null)

  const openRenameModal = (type: 'project' | 'session', id: string, label: string) => {
    setRenameError(null)
    setIsRenaming(false)
    setRenameModal({ type, id, label, value: label })
    closeMenu()
  }

  const closeRenameModal = () => {
    setRenameModal(null)
    setRenameError(null)
    setIsRenaming(false)
  }

  const handleRenameSubmit = async () => {
    if (!renameModal) return
    const nextName = renameModal.value.trim()
    if (!nextName) {
      setRenameError(lt('Vui lòng nhập tên mới.', 'Please enter a new name.'))
      return
    }
    setIsRenaming(true)
    setRenameError(null)
    try {
      if (renameModal.type === 'project') {
        const project = projects.find(p => p.id === renameModal.id)
        if (!project) return
        if (USE_API) {
          const updated = await projectsApi.update(project.id, { name: nextName })
          setProjects(prev => prev.map(p => (p.id === project.id ? { ...p, ...updated } : p)))
        } else {
          setProjects(prev => prev.map(p => (p.id === project.id ? { ...p, name: nextName } : p)))
        }
      } else {
        const meeting = meetings.find(m => m.id === renameModal.id)
        if (!meeting) return
        if (USE_API) {
          const updated = await meetingsApi.update(meeting.id, { title: nextName })
          setMeetings(prev => prev.map(m => (m.id === meeting.id ? { ...m, ...updated } : m)))
        } else {
          setMeetings(prev => prev.map(m => (m.id === meeting.id ? { ...m, title: nextName } : m)))
        }
      }
      closeRenameModal()
    } catch (err) {
      console.error('Rename failed:', err)
      setRenameError(lt('Không thể đổi tên. Vui lòng thử lại.', 'Unable to rename. Please try again.'))
    } finally {
      setIsRenaming(false)
    }
  }

  const handleDeleteProject = async (project: Project) => {
    const confirmed = window.confirm(
      lt(`Xóa dự án "${project.name}"? Hành động này không thể hoàn tác.`, `Delete project "${project.name}"? This action cannot be undone.`),
    )
    if (!confirmed) {
      closeMenu()
      return
    }
    try {
      if (USE_API) {
        await projectsApi.delete(project.id)
      }
      setProjects(prev => prev.filter(p => p.id !== project.id))
    } catch (err) {
      console.error('Delete project failed:', err)
      setError(lt('Không thể xóa dự án. Vui lòng thử lại.', 'Unable to delete project. Please try again.'))
    } finally {
      closeMenu()
    }
  }

  const handleDeleteSession = async (meeting: Meeting) => {
    const confirmed = window.confirm(
      lt(`Xóa phiên "${meeting.title}"? Hành động này không thể hoàn tác.`, `Delete session "${meeting.title}"? This action cannot be undone.`),
    )
    if (!confirmed) {
      closeMenu()
      return
    }
    try {
      if (USE_API) {
        await meetingsApi.delete(meeting.id)
      }
      setMeetings(prev => prev.filter(m => m.id !== meeting.id))
    } catch (err) {
      console.error('Delete session failed:', err)
      setError(lt('Không thể xóa phiên. Vui lòng thử lại.', 'Unable to delete session. Please try again.'))
    } finally {
      closeMenu()
    }
  }

  return (
    <div className="drive-page">
      <div className="drive-toolbar">
        <div className="drive-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in Drive"
          />
        </div>
        <button className="btn btn--ghost drive-refresh" onClick={loadData} disabled={isLoading} title="Làm mới">
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <header className="drive-welcome">
        <h1>Workspace</h1>
        <p>
          {lt(
            'Không gian làm việc tập trung để quản trị phiên họp, tài liệu và dự án xuyên suốt.',
            'A focused workspace to manage sessions, documents, and projects end-to-end.',
          )}
        </p>
      </header>

      {error && (
        <div className="drive-banner drive-banner--error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="drive-loading">
          <div className="spinner" style={{ width: 28, height: 28 }}></div>
          <p>Đang tải dữ liệu...</p>
        </div>
      )}

      {!isLoading && (
        <>
          <section className="drive-section">
            <button
              type="button"
              className="drive-section__title"
              onClick={() => setProjectsOpen(prev => !prev)}
            >
              {projectsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Projects
            </button>

            {projectsOpen && (
              <>
                {filteredProjects.length === 0 ? (
                  <div className="drive-empty">
                    <FolderOpen size={28} />
                    <div>
                      <h3>Chưa có dự án</h3>
                      <p>Tạo dự án mới để gom các phiên liên quan.</p>
                    </div>
                  </div>
                ) : (
                  <div className="drive-folders">
                    {filteredProjects.map(project => (
                      <Link key={project.id} to={`/app/projects/${project.id}`} className="drive-folder">
                        <div className="drive-folder__icon">
                          <FolderOpen size={18} />
                        </div>
                        <div className="drive-folder__info">
                          <div className="drive-folder__name">{project.name}</div>
                          <div className="drive-folder__meta">In Workspace</div>
                        </div>
                        <div
                          className="drive-menu-wrapper"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                        >
                          <button
                            type="button"
                            className="drive-menu-trigger"
                            aria-label="Project menu"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleMenu('project', project.id)
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openMenu?.type === 'project' && openMenu.id === project.id && (
                            <DriveContextMenu
                              onRename={() => openRenameModal('project', project.id, project.name)}
                              onRemove={() => handleDeleteProject(project)}
                              onClose={closeMenu}
                            />
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="drive-section">
            <button
              type="button"
              className="drive-section__title"
              onClick={() => setSessionsOpen(prev => !prev)}
            >
              {sessionsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Sessions
            </button>

            {sessionsOpen && (
              <>
                {recentMeetings.length === 0 ? (
                  <div className="drive-empty">
                    <FileText size={26} />
                    <div>
                      <h3>{lt('Chưa có phiên nào', 'No sessions yet')}</h3>
                      <p>{lt('Tất cả phiên sẽ hiển thị tại đây theo thứ tự mới nhất.', 'All sessions will appear here sorted by recency.')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="drive-table">
                    <div className="drive-table__header">
                      <div>{lt('Tên phiên', 'Session')}</div>
                      <div>{lt('Loại', 'Type')}</div>
                      <div>{lt('Ngày tạo', 'Created')}</div>
                      <div></div>
                    </div>
                    {recentMeetings.map(meeting => (
                      <DriveSuggestedRow
                        key={meeting.id}
                        meeting={meeting}
                        projectName={meeting.project_id ? projectNameById.get(meeting.project_id) : undefined}
                        isMenuOpen={openMenu?.type === 'session' && openMenu.id === meeting.id}
                        onToggleMenu={() => toggleMenu('session', meeting.id)}
                        onCloseMenu={closeMenu}
                        onRename={() => openRenameModal('session', meeting.id, meeting.title)}
                        onRemove={() => handleDeleteSession(meeting)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      <Modal
        isOpen={!!renameModal}
        onClose={closeRenameModal}
        title={renameModal?.type === 'project' ? 'Đổi tên dự án' : 'Đổi tên phiên'}
        size="sm"
      >
        <div className="rename-modal">
          {renameError && (
            <div className="form-error">
              {renameError}
            </div>
          )}
          <label className="rename-modal__label">
            Tên mới
            <input
              className="rename-modal__input"
              value={renameModal?.value || ''}
              onChange={(e) => setRenameModal(prev => (prev ? { ...prev, value: e.target.value } : prev))}
              placeholder="Nhập tên mới..."
            />
          </label>
          <div className="rename-modal__actions">
            <button className="btn btn--secondary" onClick={closeRenameModal} disabled={isRenaming}>
              Hủy
            </button>
            <button className="btn btn--primary" onClick={handleRenameSubmit} disabled={isRenaming || !(renameModal?.value || '').trim()}>
              {isRenaming ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const DriveSuggestedRow = ({
  meeting,
  projectName,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onRename,
  onRemove,
}: {
  meeting: Meeting
  projectName?: string
  isMenuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onRename: () => void
  onRemove: () => void
}) => {
  const createdDate = meeting.created_at
    ? new Date(meeting.created_at)
    : (meeting.start_time ? new Date(meeting.start_time) : new Date())
  const isCourse = meeting.meeting_type === 'study_session'
  const typeLabel = getSessionTypeLabel(meeting)
  const createdLabel = formatDate(createdDate)
  const Icon = isCourse ? BookOpen : Users
  const { lt } = useLocaleText()

  return (
    <Link to={`/app/meetings/${meeting.id}/detail`} className="drive-table__row">
      <div className="drive-table__cell drive-table__name">
        <div className="drive-table__name-main">
          <div className={`drive-file-icon ${isCourse ? 'drive-file-icon--course' : 'drive-file-icon--meeting'}`}>
            <Icon size={16} />
          </div>
          <div>
            <div className="drive-file-title">{meeting.title}</div>
            {projectName && (
              <div className="drive-file-meta drive-file-meta--project">
                <FolderOpen size={12} />
                <span>{lt('Dự án', 'Project')}: {projectName}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="drive-table__cell">{typeLabel}</div>
      <div className="drive-table__cell">{createdLabel}</div>
      <div className="drive-table__cell drive-table__cell--menu">
        <div
          className="drive-menu-wrapper"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <button
            type="button"
            className="drive-menu-trigger"
            aria-label="Session menu"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleMenu()
            }}
          >
            <MoreVertical size={16} />
          </button>
          {isMenuOpen && (
            <DriveContextMenu
              onRename={onRename}
              onRemove={onRemove}
              onClose={onCloseMenu}
            />
          )}
        </div>
      </div>
    </Link>
  )
}

const DriveContextMenu = ({ onRename, onRemove, onClose }: { onRename: () => void; onRemove: () => void; onClose: () => void }) => (
  <div
    className="drive-menu"
    onClick={(e) => {
      e.preventDefault()
      e.stopPropagation()
    }}
  >
    <div className="drive-menu__item drive-menu__item--submenu">
      <span>Share</span>
      <ChevronRight size={14} />
      <div className="drive-menu__submenu">
        <button type="button" className="drive-menu__action" onClick={onClose}>Copy link</button>
        <button type="button" className="drive-menu__action" onClick={onClose}>Invite people</button>
      </div>
    </div>
    <div className="drive-menu__item drive-menu__item--submenu">
      <span>Organize</span>
      <ChevronRight size={14} />
      <div className="drive-menu__submenu">
        <button type="button" className="drive-menu__action" onClick={onClose}>Move to…</button>
        <button type="button" className="drive-menu__action" onClick={onClose}>Add shortcut</button>
      </div>
    </div>
    <button type="button" className="drive-menu__item" onClick={onRename}>
      Rename
    </button>
    <button type="button" className="drive-menu__item drive-menu__item--danger" onClick={onRemove}>
      Remove
    </button>
  </div>
)

export default Meetings
