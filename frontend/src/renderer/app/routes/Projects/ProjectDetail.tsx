import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  FileText,
  FolderOpen,
  Plus,
  Edit3,
  Upload,
  AlertCircle,
} from 'lucide-react'
import { projectsApi } from '../../../lib/api/projects'
import { meetingsApi } from '../../../lib/api/meetings'
import { knowledgeApi, type KnowledgeDocument } from '../../../lib/api/knowledge'
import { formatDate, formatTime } from '../../../store/mockData'
import { Modal } from '../../../components/ui/Modal'
import { UploadDocumentModal } from '../../../components/UploadDocumentModal'
import type { Project } from '../../../shared/dto/project'
import type { Meeting } from '../../../shared/dto/meeting'
import { useChatContext } from '../../../contexts/ChatContext'
import CreateMeetingForm from '../../../features/meetings/components/CreateMeetingForm'

type TabKey = 'overview' | 'meetings' | 'documents'

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { setOverride, clearOverride } = useChatContext()

  const [project, setProject] = useState<Project | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateMeetingModal, setShowCreateMeetingModal] = useState(false)

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
      setError('Không thể tải thông tin dự án.')
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
      setError('Không thể cập nhật dự án.')
    }
  }

  if (isLoading) {
    return (
      <div className="project-detail__loading">
        <div className="spinner" style={{ width: 32, height: 32 }}></div>
        <p>Đang tải dự án...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="empty-state">
        <AlertCircle className="empty-state__icon" />
        <h3 className="empty-state__title">{error || 'Không tìm thấy dự án'}</h3>
        <button className="btn btn--secondary" onClick={() => navigate('/app/meetings')}>
          Quay lại
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
            {project.code || 'Dự án'}
          </div>
          <h1>{project.name}</h1>
          <p>{project.description || 'Chưa có mô tả. Bạn có thể cập nhật thêm.'}</p>
        </div>
        <div className="project-detail__actions">
          <button className="btn btn--secondary" onClick={() => setShowUploadModal(true)}>
            <Upload size={16} />
            Tải tài liệu
          </button>
          <button className="btn btn--secondary" onClick={() => setShowEditModal(true)}>
            <Edit3 size={16} />
            Chỉnh sửa
          </button>
          <button className="btn btn--primary" onClick={() => setShowCreateMeetingModal(true)}>
            <Plus size={16} />
            Tạo phiên
          </button>
        </div>
      </header>

      <section className="project-detail__stats">
        <div className="project-stat">
          <Calendar size={16} />
          <div>
            <span>{stats.meetings}</span>
            <small>Phiên họp</small>
          </div>
        </div>
        <div className="project-stat">
          <FileText size={16} />
          <div>
            <span>{stats.documents}</span>
            <small>Tài liệu</small>
          </div>
        </div>
      </section>

      <div className="project-tabs">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
          Tổng quan
        </button>
        <button className={activeTab === 'meetings' ? 'active' : ''} onClick={() => setActiveTab('meetings')}>
          Phiên họp
        </button>
        <button className={activeTab === 'documents' ? 'active' : ''} onClick={() => setActiveTab('documents')}>
          Tài liệu
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="project-overview">
          <div className="project-overview__card">
            <h3>Mục tiêu dự án</h3>
            <p>{project.objective || 'Chưa có mục tiêu cụ thể. Hãy bổ sung để đội ngũ thống nhất hướng đi.'}</p>
          </div>
          <div className="project-overview__card">
            <h3>Phiên họp gần đây</h3>
            {meetings.length === 0 ? (
              <div className="project-empty">Chưa có phiên nào. Tạo phiên đầu tiên cho dự án.</div>
            ) : (
              <div className="project-list">
                {meetings.slice(0, 4).map(meeting => (
                  <Link key={meeting.id} to={`/app/meetings/${meeting.id}/detail`} className="project-list__item">
                    <div>
                      <div className="project-list__title">{meeting.title}</div>
                      <div className="project-list__meta">
                        {meeting.start_time ? `${formatDate(new Date(meeting.start_time))} · ${formatTime(new Date(meeting.start_time))}` : 'Chưa có thời gian'}
                      </div>
                    </div>
                    <span className="project-list__cta">Mở</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="project-overview__card">
            <h3>Tài liệu chính</h3>
            {documents.length === 0 ? (
              <div className="project-empty">Chưa có tài liệu. Tải lên để dùng cho RAG và recap.</div>
            ) : (
              <div className="project-list">
                {documents.slice(0, 4).map(doc => (
                  <div key={doc.id} className="project-list__item">
                    <div>
                      <div className="project-list__title">{doc.title}</div>
                      <div className="project-list__meta">{doc.category || doc.source}</div>
                    </div>
                    {doc.file_url && (
                      <a className="project-list__cta" href={doc.file_url} target="_blank" rel="noreferrer">
                        Mở
                      </a>
                    )}
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
            <h3>Danh sách phiên họp</h3>
            <button className="btn btn--secondary" onClick={() => setShowCreateMeetingModal(true)}>
              <Plus size={14} />
              Tạo phiên
            </button>
          </div>
          {meetings.length === 0 ? (
            <div className="project-empty">Chưa có phiên nào.</div>
          ) : (
            <div className="project-table">
              {meetings.map(meeting => (
                <Link key={meeting.id} to={`/app/meetings/${meeting.id}/detail`} className="project-table__row">
                  <div>
                    <div className="project-table__title">{meeting.title}</div>
                    <div className="project-table__meta">
                      {meeting.start_time ? `${formatDate(new Date(meeting.start_time))} · ${formatTime(new Date(meeting.start_time))}` : 'Chưa có thời gian'}
                    </div>
                  </div>
                  <span className="project-table__status">{meeting.phase}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="project-panel">
          <div className="project-panel__header">
            <h3>Kho tài liệu dự án</h3>
            <button className="btn btn--secondary" onClick={() => setShowUploadModal(true)}>
              <Upload size={14} />
              Tải tài liệu
            </button>
          </div>
          {documents.length === 0 ? (
            <div className="project-empty">Chưa có tài liệu nào.</div>
          ) : (
            <div className="project-docs">
              {documents.map(doc => (
                <div key={doc.id} className="project-docs__card">
                  <div className="project-docs__meta">
                    <span className="project-docs__type">{doc.file_type.toUpperCase()}</span>
                    <span>{doc.category || doc.source}</span>
                  </div>
                  <h4>{doc.title}</h4>
                  <p>{doc.description || 'Chưa có mô tả.'}</p>
                  <div className="project-docs__footer">
                    <span>{doc.tags?.slice(0, 2).join(', ') || 'No tags'}</span>
                    {doc.file_url ? (
                      <a href={doc.file_url} target="_blank" rel="noreferrer">
                        Mở tài liệu
                      </a>
                    ) : (
                      <span>Không có link</span>
                    )}
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
        title="Chỉnh sửa dự án"
        size="lg"
      >
        <div className="project-modal">
          <div className="project-modal__grid">
            <label>
              <span>Tên dự án</span>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </label>
            <label>
              <span>Mã dự án</span>
              <input
                value={editForm.code}
                onChange={(e) => setEditForm(prev => ({ ...prev, code: e.target.value }))}
              />
            </label>
            <label className="project-modal__full">
              <span>Mô tả</span>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </label>
            <label className="project-modal__full">
              <span>Mục tiêu</span>
              <textarea
                rows={3}
                value={editForm.objective}
                onChange={(e) => setEditForm(prev => ({ ...prev, objective: e.target.value }))}
              />
            </label>
          </div>
          <div className="project-modal__actions">
            <button className="btn btn--secondary" onClick={() => setShowEditModal(false)}>
              Hủy
            </button>
            <button className="btn btn--primary" onClick={handleSaveProject} disabled={!editForm.name.trim()}>
              Lưu thay đổi
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
      />

      <Modal
        isOpen={showCreateMeetingModal}
        onClose={() => setShowCreateMeetingModal(false)}
        title="Tạo phiên làm việc mới"
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

export default ProjectDetail
