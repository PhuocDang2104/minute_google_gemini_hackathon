import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  FileText,
  FolderOpen,
  Plus,
  MoreVertical,
  ChevronRight,
  Edit3,
  Upload,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { projectsApi } from '../../../lib/api/projects'
import { meetingsApi } from '../../../lib/api/meetings'
import { knowledgeApi, type KnowledgeDocument } from '../../../lib/api/knowledge'
import { Modal } from '../../../components/ui/Modal'
import { UploadDocumentModal } from '../../../components/UploadDocumentModal'
import type { Project } from '../../../shared/dto/project'
import type { Meeting } from '../../../shared/dto/meeting'
import { useChatContext } from '../../../contexts/ChatContext'
import CreateMeetingForm from '../../../features/meetings/components/CreateMeetingForm'
import { USE_API } from '../../../config/env'
import { useLocaleText } from '../../../i18n/useLocaleText'

type TabKey = 'overview' | 'meetings' | 'documents'

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { setOverride, clearOverride } = useChatContext()
  const { lt, dateLocale, timeLocale } = useLocaleText()

  const [project, setProject] = useState<Project | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateMeetingModal, setShowCreateMeetingModal] = useState(false)
  const [openMeetingMenuId, setOpenMeetingMenuId] = useState<string | null>(null)
  const [renameMeetingModal, setRenameMeetingModal] = useState<Meeting | null>(null)
  const [renameMeetingValue, setRenameMeetingValue] = useState('')
  const [renameMeetingError, setRenameMeetingError] = useState<string | null>(null)
  const [isRenamingMeeting, setIsRenamingMeeting] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    description: '',
    objective: '',
  })

  useEffect(() => {
    if (project) {
      setOverride({
        scope: 'project',
        projectId: project.id,
        title: project.name,
        subtitle: project.code ? `Mã dự án: ${project.code}` : undefined,
      })
    }
  }, [project, setOverride])

  useEffect(() => {
    return () => clearOverride()
  }, [clearOverride])

  useEffect(() => {
    if (!openMeetingMenuId) return
    const handleClick = () => setOpenMeetingMenuId(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [openMeetingMenuId])

  const loadProject = async () => {
    if (!projectId) return
    setIsLoading(true)
    setError(null)
    try {
      const [projectRes, meetingsRes, documentsRes] = await Promise.all([
        projectsApi.get(projectId),
        meetingsApi.list({ project_id: projectId, limit: 200 }),
        knowledgeApi.list({ project_id: projectId, limit: 100 }),
      ])
      setProject(projectRes)
      setMeetings(meetingsRes.meetings || [])
      setDocuments(documentsRes.documents || [])
      setEditForm({
        name: projectRes.name || '',
        code: projectRes.code || '',
        description: projectRes.description || '',
        objective: projectRes.objective || '',
      })
    } catch (err) {
      console.error('Failed to load project detail:', err)
      setError(lt('Không thể tải thông tin dự án.', 'Unable to load project detail.'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProject()
  }, [projectId])

  const stats = useMemo(() => ({
    meetings: project?.meeting_count ?? meetings.length,
    documents: project?.document_count ?? documents.length,
  }), [project, meetings, documents])

  const handleCreateMeetingSuccess = (meetingId: string) => {
    setShowCreateMeetingModal(false)
    loadProject()
    navigate(`/app/meetings/${meetingId}/detail`)
  }

  const openRenameMeeting = (meeting: Meeting) => {
    setRenameMeetingModal(meeting)
    setRenameMeetingValue(meeting.title)
    setRenameMeetingError(null)
    setIsRenamingMeeting(false)
    setOpenMeetingMenuId(null)
  }

  const handleRenameMeetingSubmit = async () => {
    if (!renameMeetingModal) return
    const nextTitle = renameMeetingValue.trim()
    if (!nextTitle) {
      setRenameMeetingError('Vui lòng nhập tên mới.')
      return
    }
    setIsRenamingMeeting(true)
    setRenameMeetingError(null)
    try {
      if (USE_API) {
        const updated = await meetingsApi.update(renameMeetingModal.id, { title: nextTitle })
        setMeetings(prev => prev.map(m => (m.id === renameMeetingModal.id ? { ...m, ...updated } : m)))
      } else {
        setMeetings(prev => prev.map(m => (m.id === renameMeetingModal.id ? { ...m, title: nextTitle } : m)))
      }
      setRenameMeetingModal(null)
    } catch (err) {
      console.error('Rename meeting failed:', err)
      setRenameMeetingError(lt('Không thể đổi tên phiên. Vui lòng thử lại.', 'Unable to rename session. Please try again.'))
    } finally {
      setIsRenamingMeeting(false)
    }
  }

  const handleDeleteMeeting = async (meeting: Meeting) => {
    const confirmed = window.confirm(
      lt(`Xóa phiên "${meeting.title}"? Hành động này không thể hoàn tác.`, `Delete session "${meeting.title}"? This action cannot be undone.`),
    )
    if (!confirmed) {
      setOpenMeetingMenuId(null)
      return
    }
    try {
      if (USE_API) {
        await meetingsApi.delete(meeting.id)
      }
      setMeetings(prev => prev.filter(m => m.id !== meeting.id))
      setProject(prev => {
        if (!prev) return prev
        const current = prev.meeting_count ?? meetings.length
        return { ...prev, meeting_count: Math.max(0, current - 1) }
      })
    } catch (err) {
      console.error('Delete meeting failed:', err)
      setError(lt('Không thể xóa phiên. Vui lòng thử lại.', 'Unable to delete session. Please try again.'))
    } finally {
      setOpenMeetingMenuId(null)
    }
  }

  const handleSaveProject = async () => {
    if (!projectId) return
    try {
      const updated = await projectsApi.update(projectId, {
        name: editForm.name.trim() || undefined,
        code: editForm.code.trim() || undefined,
        description: editForm.description.trim() || undefined,
        objective: editForm.objective.trim() || undefined,
      })
      setProject(updated)
      setShowEditModal(false)
    } catch (err) {
      console.error('Failed to update project:', err)
      setError(lt('Không thể cập nhật dự án.', 'Unable to update project.'))
    }
  }

  const handleDeleteDocument = async (doc: KnowledgeDocument) => {
    const confirmed = window.confirm(
      lt(`Xóa tài liệu "${doc.title}"? Hành động này không thể hoàn tác.`, `Delete document "${doc.title}"? This action cannot be undone.`),
    )
    if (!confirmed) return
    setDeletingDocumentId(doc.id)
    try {
      if (USE_API) {
        await knowledgeApi.delete(doc.id)
      }
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      setProject(prev => {
        if (!prev) return prev
        const current = prev.document_count ?? documents.length
        return { ...prev, document_count: Math.max(0, current - 1) }
      })
    } catch (err) {
      console.error('Delete document failed:', err)
      setError(lt('Không thể xóa tài liệu. Vui lòng thử lại.', 'Unable to delete document. Please try again.'))
    } finally {
      setDeletingDocumentId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="project-detail__loading">
        <div className="spinner" style={{ width: 32, height: 32 }}></div>
        <p>{lt('Đang tải dự án...', 'Loading project...')}</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="empty-state">
        <AlertCircle className="empty-state__icon" />
        <h3 className="empty-state__title">{error || lt('Không tìm thấy dự án', 'Project not found')}</h3>
        <button className="btn btn--secondary" onClick={() => navigate('/app/meetings')}>
          {lt('Quay lại', 'Back')}
        </button>
      </div>
    )
  }

  return (
    <div className="project-detail">
      <header className="project-detail__hero">
        <button className="btn btn--ghost btn--icon" onClick={() => navigate('/app/meetings')}>
          <ArrowLeft size={18} />
        </button>
        <div className="project-detail__info">
          <div className="project-detail__eyebrow">
            <FolderOpen size={14} />
            {project.code || lt('Dự án', 'Project')}
          </div>
          <h1>{project.name}</h1>
          <p>{project.description || lt('Chưa có mô tả. Bạn có thể cập nhật thêm.', 'No description yet. You can update it.')}</p>
        </div>
        <div className="project-detail__actions">
          <button className="btn btn--secondary" onClick={() => setShowUploadModal(true)}>
            <Upload size={16} />
            {lt('Tải tài liệu', 'Upload document')}
          </button>
          <button className="btn btn--secondary" onClick={() => setShowEditModal(true)}>
            <Edit3 size={16} />
            {lt('Chỉnh sửa', 'Edit')}
          </button>
          <button className="btn btn--primary" onClick={() => setShowCreateMeetingModal(true)}>
            <Plus size={16} />
            {lt('Tạo phiên', 'Create session')}
          </button>
        </div>
      </header>

      <section className="project-detail__stats">
        <div className="project-stat">
          <Calendar size={16} />
          <div>
            <span>{stats.meetings}</span>
            <small>{lt('Phiên họp/học', 'Sessions')}</small>
          </div>
        </div>
        <div className="project-stat">
          <FileText size={16} />
          <div>
            <span>{stats.documents}</span>
            <small>{lt('Tài liệu', 'Documents')}</small>
          </div>
        </div>
      </section>

      <div className="project-tabs">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
          {lt('Tổng quan', 'Overview')}
        </button>
        <button className={activeTab === 'meetings' ? 'active' : ''} onClick={() => setActiveTab('meetings')}>
          {lt('Phiên họp/học', 'Sessions')}
        </button>
        <button className={activeTab === 'documents' ? 'active' : ''} onClick={() => setActiveTab('documents')}>
          {lt('Tài liệu', 'Documents')}
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="project-overview">
          <div className="project-overview__card">
            <h3>{lt('Mục tiêu dự án', 'Project objective')}</h3>
            <p>{project.objective || lt('Chưa có mục tiêu cụ thể. Hãy bổ sung để đội ngũ thống nhất hướng đi.', 'No objective yet. Add one to align the team.')}</p>
          </div>
          <div className="project-overview__card">
            <h3>{lt('Phiên họp/học gần đây', 'Recent sessions')}</h3>
            {meetings.length === 0 ? (
              <div className="project-empty">{lt('Chưa có phiên nào. Tạo phiên đầu tiên cho dự án.', 'No sessions yet. Create the first one for this project.')}</div>
            ) : (
              <div className="project-list">
                {meetings.slice(0, 4).map(meeting => (
                  <Link key={meeting.id} to={`/app/meetings/${meeting.id}/detail`} className="project-list__item">
                    <div>
                      <div className="project-list__title">{meeting.title}</div>
                      <div className="project-list__meta">
                        {meeting.start_time
                          ? `${new Date(meeting.start_time).toLocaleDateString(dateLocale)} · ${new Date(meeting.start_time).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}`
                          : lt('Chưa có thời gian', 'No schedule yet')}
                      </div>
                    </div>
                    <div className="project-list__actions">
                      <span className="project-list__cta">{lt('Mở', 'Open')}</span>
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
                          aria-label={lt('Menu phiên', 'Session menu')}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setOpenMeetingMenuId(prev => (prev === meeting.id ? null : meeting.id))
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMeetingMenuId === meeting.id && (
                          <ProjectMeetingMenu
                            onRename={() => openRenameMeeting(meeting)}
                            onRemove={() => handleDeleteMeeting(meeting)}
                            onClose={() => setOpenMeetingMenuId(null)}
                          />
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="project-overview__card">
            <h3>{lt('Tài liệu chính', 'Main documents')}</h3>
            {documents.length === 0 ? (
              <div className="project-empty">{lt('Chưa có tài liệu. Tải lên để dùng cho RAG và recap.', 'No documents yet. Upload to use for RAG and recap.')}</div>
            ) : (
              <div className="project-list">
                {documents.slice(0, 4).map(doc => (
                  <div key={doc.id} className="project-list__item">
                    <div>
                      <div className="project-list__title">{doc.title}</div>
                      <div className="project-list__meta">{doc.category || doc.source}</div>
                    </div>
                    <div className="project-list__actions">
                      {doc.file_url ? (
                        <a className="project-list__cta" href={doc.file_url} target="_blank" rel="noreferrer">
                          {lt('Mở', 'Open')}
                        </a>
                      ) : (
                        <span className="project-list__meta">{lt('Không có link', 'No link')}</span>
                      )}
                      <button
                        type="button"
                        className="project-list__icon-action project-list__icon-action--danger"
                        title={lt('Xóa', 'Delete')}
                        onClick={() => handleDeleteDocument(doc)}
                        disabled={deletingDocumentId === doc.id}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'meetings' && (
        <div className="project-panel">
          <div className="project-panel__header">
            <h3>{lt('Danh sách phiên họp', 'Session list')}</h3>
            <button className="btn btn--secondary" onClick={() => setShowCreateMeetingModal(true)}>
              <Plus size={14} />
              {lt('Tạo phiên', 'Create session')}
            </button>
          </div>
          {meetings.length === 0 ? (
            <div className="project-empty">{lt('Chưa có phiên nào.', 'No sessions yet.')}</div>
          ) : (
            <div className="project-table">
              {meetings.map(meeting => (
                <Link key={meeting.id} to={`/app/meetings/${meeting.id}/detail`} className="project-table__row">
                  <div>
                    <div className="project-table__title">{meeting.title}</div>
                    <div className="project-table__meta">
                      {meeting.start_time
                        ? `${new Date(meeting.start_time).toLocaleDateString(dateLocale)} · ${new Date(meeting.start_time).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}`
                        : lt('Chưa có thời gian', 'No schedule yet')}
                    </div>
                  </div>
                  <div className="project-table__actions">
                    <span className="project-table__status">{meeting.phase}</span>
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
                        aria-label={lt('Menu phiên', 'Session menu')}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setOpenMeetingMenuId(prev => (prev === meeting.id ? null : meeting.id))
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openMeetingMenuId === meeting.id && (
                        <ProjectMeetingMenu
                          onRename={() => openRenameMeeting(meeting)}
                          onRemove={() => handleDeleteMeeting(meeting)}
                          onClose={() => setOpenMeetingMenuId(null)}
                        />
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="project-panel">
          <div className="project-panel__header">
            <h3>{lt('Kho tài liệu dự án', 'Project document hub')}</h3>
            <button className="btn btn--secondary" onClick={() => setShowUploadModal(true)}>
              <Upload size={14} />
              {lt('Tải tài liệu', 'Upload document')}
            </button>
          </div>
          {documents.length === 0 ? (
            <div className="project-empty">{lt('Chưa có tài liệu nào.', 'No documents yet.')}</div>
          ) : (
            <div className="project-docs">
              {documents.map(doc => (
                <div key={doc.id} className="project-docs__card">
                  <div className="project-docs__meta">
                    <span className="project-docs__type">{doc.file_type.toUpperCase()}</span>
                    <span>{doc.category || doc.source}</span>
                  </div>
                  <h4>{doc.title}</h4>
                  <p>{doc.description || lt('Chưa có mô tả.', 'No description.')}</p>
                  <div className="project-docs__footer">
                    <span>{doc.tags?.slice(0, 2).join(', ') || lt('Không có tag', 'No tags')}</span>
                    <div className="project-docs__actions">
                      {doc.file_url ? (
                        <a href={doc.file_url} target="_blank" rel="noreferrer">
                          {lt('Mở tài liệu', 'Open document')}
                        </a>
                      ) : (
                        <span>{lt('Không có link', 'No link')}</span>
                      )}
                      <button
                        type="button"
                        className="project-docs__danger-btn"
                        onClick={() => handleDeleteDocument(doc)}
                        disabled={deletingDocumentId === doc.id}
                        title={lt('Xóa', 'Delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={lt('Chỉnh sửa dự án', 'Edit project')}
        size="lg"
      >
        <div className="project-modal">
          <div className="project-modal__grid">
            <label>
              <span>{lt('Tên dự án', 'Project name')}</span>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </label>
            <label>
              <span>{lt('Mã dự án', 'Project code')}</span>
              <input
                value={editForm.code}
                onChange={(e) => setEditForm(prev => ({ ...prev, code: e.target.value }))}
              />
            </label>
            <label className="project-modal__full">
              <span>{lt('Mô tả', 'Description')}</span>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </label>
            <label className="project-modal__full">
              <span>{lt('Mục tiêu', 'Objective')}</span>
              <textarea
                rows={3}
                value={editForm.objective}
                onChange={(e) => setEditForm(prev => ({ ...prev, objective: e.target.value }))}
              />
            </label>
          </div>
          <div className="project-modal__actions">
            <button className="btn btn--secondary" onClick={() => setShowEditModal(false)}>
              {lt('Hủy', 'Cancel')}
            </button>
            <button className="btn btn--primary" onClick={handleSaveProject} disabled={!editForm.name.trim()}>
              {lt('Lưu thay đổi', 'Save changes')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!renameMeetingModal}
        onClose={() => setRenameMeetingModal(null)}
        title={lt('Đổi tên phiên', 'Rename session')}
        size="sm"
      >
        <div className="rename-modal">
          {renameMeetingError && (
            <div className="form-error">
              {renameMeetingError}
            </div>
          )}
          <label className="rename-modal__label">
            {lt('Tên mới', 'New name')}
            <input
              className="rename-modal__input"
              value={renameMeetingValue}
              onChange={(e) => setRenameMeetingValue(e.target.value)}
              placeholder={lt('Nhập tên mới...', 'Enter new name...')}
            />
          </label>
          <div className="rename-modal__actions">
            <button className="btn btn--secondary" onClick={() => setRenameMeetingModal(null)} disabled={isRenamingMeeting}>
              {lt('Hủy', 'Cancel')}
            </button>
            <button className="btn btn--primary" onClick={handleRenameMeetingSubmit} disabled={isRenamingMeeting || !renameMeetingValue.trim()}>
              {isRenamingMeeting ? lt('Đang lưu...', 'Saving...') : lt('Lưu', 'Save')}
            </button>
          </div>
        </div>
      </Modal>

      <UploadDocumentModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          setShowUploadModal(false)
          loadProject()
        }}
        projectId={project.id}
        simpleMode
      />

      <Modal
        isOpen={showCreateMeetingModal}
        onClose={() => setShowCreateMeetingModal(false)}
        title={lt('Tạo phiên làm việc mới', 'Create new session')}
        size="lg"
      >
        <CreateMeetingForm
          onSuccess={handleCreateMeetingSuccess}
          onCancel={() => setShowCreateMeetingModal(false)}
          projectId={project.id}
        />
      </Modal>
    </div>
  )
}

const ProjectMeetingMenu = ({ onRename, onRemove, onClose }: { onRename: () => void; onRemove: () => void; onClose: () => void }) => {
  const { lt } = useLocaleText()
  return (
    <div
      className="drive-menu"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div className="drive-menu__item drive-menu__item--submenu">
        <span>{lt('Chia sẻ', 'Share')}</span>
        <ChevronRight size={14} />
        <div className="drive-menu__submenu">
          <button type="button" className="drive-menu__action" onClick={onClose}>{lt('Sao chép link', 'Copy link')}</button>
          <button type="button" className="drive-menu__action" onClick={onClose}>{lt('Mời người tham gia', 'Invite people')}</button>
        </div>
      </div>
      <div className="drive-menu__item drive-menu__item--submenu">
        <span>{lt('Tổ chức', 'Organize')}</span>
        <ChevronRight size={14} />
        <div className="drive-menu__submenu">
          <button type="button" className="drive-menu__action" onClick={onClose}>{lt('Di chuyển tới…', 'Move to…')}</button>
          <button type="button" className="drive-menu__action" onClick={onClose}>{lt('Thêm lối tắt', 'Add shortcut')}</button>
        </div>
      </div>
      <button type="button" className="drive-menu__item" onClick={onRename}>
        {lt('Đổi tên', 'Rename')}
      </button>
      <button type="button" className="drive-menu__item drive-menu__item--danger" onClick={onRemove}>
        {lt('Xóa', 'Remove')}
      </button>
    </div>
  )
}

export default ProjectDetail
