import { useEffect, useState } from 'react'
import { ShieldCheck, Users, FileText, Settings, Activity, FolderOpen, Bot, Database, AlertTriangle, RefreshCw, CheckCircle2, Ban, Trash2 } from 'lucide-react'
import { getStoredUser } from '../../lib/api/auth'
import { useLanguage } from '../../contexts/LanguageContext'
import { adminListUsers, adminUpdateUserRole, adminUpdateUserStatus, adminListDocuments, adminDeleteDocument, adminListMeetings, adminListActionItems, adminUpdateActionItem, adminUpdateMeeting, adminDeleteActionItem, adminCreateUser } from '../../lib/api/admin'
import { User } from '../../shared/dto/user'
import { Document } from '../../shared/dto/document'
import { Meeting } from '../../shared/dto/meeting'
import { ActionItemResponse } from '../../shared/dto/actionItem'
import { uploadFile as uploadDocumentFile } from '../../lib/api/documents'
import { API_URL } from '../../config/env'
import { adminListProjects, adminCreateProject } from '../../lib/api/admin'
import { Project } from '../../shared/dto/project'

const roles: User['role'][] = ['admin', 'PMO', 'chair', 'user']
const actionStatuses = ['proposed', 'confirmed', 'in_progress', 'completed', 'cancelled']

const SectionCard = ({ icon, title, description, items }: { icon: React.ReactNode, title: string, description: string, items: string[] }) => (
  <div className="admin-card">
    <div className="admin-card__header">
      <div className="admin-card__icon">{icon}</div>
      <div>
        <div className="admin-card__title">{title}</div>
        <div className="admin-card__desc">{description}</div>
      </div>
    </div>
    <ul className="admin-card__list">
      {items.map((item, idx) => (
        <li key={idx} className="admin-card__list-item">• {item}</li>
      ))}
    </ul>
  </div>
)

const AdminConsole = () => {
  const { t } = useLanguage()
  const user = getStoredUser()
  const isAdmin = (user?.role || '').toLowerCase() === 'admin'

  const [users, setUsers] = useState<User[]>([])
  const [docs, setDocs] = useState<Document[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [actions, setActions] = useState<ActionItemResponse[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [creatingUser, setCreatingUser] = useState<{ email: string; password: string; display_name: string; role: User['role'] }>({
    email: '',
    password: '',
    display_name: '',
    role: 'user',
  })
  const [uploading, setUploading] = useState(false)
  const [uploadMeta, setUploadMeta] = useState<{ meeting_id?: string; description?: string }>({})
  const [creatingProject, setCreatingProject] = useState<{ name: string; code?: string; description?: string }>({ name: '' })

  const loadAll = async () => {
    setLoading(true)
    try {
      const [u, d, m, a] = await Promise.all([
        adminListUsers({ limit: 200 }),
        adminListDocuments({ limit: 50 }),
        adminListMeetings({ limit: 50 }),
        adminListActionItems({ overdue_only: false }),
        adminListProjects({ limit: 100 }),
      ])
      setUsers(u.users)
      setDocs(d.documents)
      setMeetings(m)
      setActions(a.items)
      setProjects((await adminListProjects({ limit: 100 })).projects)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadAll()
    }
  }, [isAdmin])

  const handleRoleChange = async (userId: string, role: User['role']) => {
    await adminUpdateUserRole(userId, role)
    await loadAll()
  }

  const handleCreateProject = async () => {
    if (!creatingProject.name) return
    await adminCreateProject(creatingProject)
    setCreatingProject({ name: '', code: '', description: '' })
    await loadAll()
  }

  const handleStatusToggle = async (userId: string, current: boolean) => {
    await adminUpdateUserStatus(userId, !current)
    await loadAll()
  }

  const handleDeleteDoc = async (docId: string) => {
    await adminDeleteDocument(docId)
    await loadAll()
  }

  const getDocUrl = (doc: Document) => {
    if (!doc.file_url) return ''
    return doc.file_url.startsWith('http') ? doc.file_url : `${API_URL}${doc.file_url}`
  }

  const handleUploadFile = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try {
      await uploadDocumentFile(file, uploadMeta)
      setUploadMeta({})
      await loadAll()
    } finally {
      setUploading(false)
    }
  }

  const handleUpdateActionStatus = async (itemId: string, status: string) => {
    await adminUpdateActionItem(itemId, { status })
    await loadAll()
  }

  const handleDeleteAction = async (itemId: string) => {
    await adminDeleteActionItem(itemId)
    await loadAll()
  }

  const handleUpdateMeetingPhase = async (meetingId: string, phase?: string) => {
    if (!phase) return
    await adminUpdateMeeting(meetingId, { phase })
    await loadAll()
  }

  const handleCreateUser = async () => {
    if (!creatingUser.email || !creatingUser.password || !creatingUser.display_name) return
    await adminCreateUser(creatingUser)
    setCreatingUser({ email: '', password: '', display_name: '', role: 'user' })
    await loadAll()
  }

  if (!isAdmin) {
    return (
      <div className="admin-console">
        <div className="admin-console__header">
          <ShieldCheck size={28} />
          <div>
            <h1>{t('admin.title')}</h1>
            <p>{t('admin.noAccess')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-console">
      <div className="admin-console__header">
        <ShieldCheck size={28} />
        <div>
          <h1>{t('admin.title')}</h1>
          <p>{t('admin.subtitle')}</p>
        </div>
        <button className="btn btn-outline" onClick={loadAll} disabled={loading} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={16} style={{ marginRight: 6 }} /> {loading ? t('common.loading') : 'Reload'}
        </button>
      </div>

      <div className="admin-console__grid">
        <SectionCard
          icon={<Users size={20} />}
          title={t('admin.users.title')}
          description={t('admin.users.desc')}
          items={[
            t('admin.users.items.create'),
            t('admin.users.items.role'),
            t('admin.users.items.status'),
            t('admin.users.items.audit'),
          ]}
        />
        <SectionCard
          icon={<FileText size={20} />}
          title={t('admin.docs.title')}
          description={t('admin.docs.desc')}
          items={[
            t('admin.docs.items.upload'),
            t('admin.docs.items.labels'),
            t('admin.docs.items.visibility'),
            t('admin.docs.items.meetingScope'),
          ]}
        />
        <SectionCard
          icon={<FolderOpen size={20} />}
          title={t('admin.meetings.title')}
          description={t('admin.meetings.desc')}
          items={[
            t('admin.meetings.items.lifecycle'),
            t('admin.meetings.items.participants'),
            t('admin.meetings.items.docs'),
            t('admin.meetings.items.audit'),
          ]}
        />
        <SectionCard
          icon={<Activity size={20} />}
          title={t('admin.observability.title')}
          description={t('admin.observability.desc')}
          items={[
            t('admin.observability.items.metrics'),
            t('admin.observability.items.logs'),
            t('admin.observability.items.indexing'),
            t('admin.observability.items.security'),
          ]}
        />
      </div>

      {/* Users */}
      <div className="admin-card">
        <div className="admin-card__header">
          <div className="admin-card__icon"><Users size={18} /></div>
          <div className="admin-card__title">{t('admin.users.title')}</div>
        </div>
        <div className="admin-inline-form">
          <input placeholder="Email" value={creatingUser.email} onChange={e => setCreatingUser({ ...creatingUser, email: e.target.value })} />
          <input placeholder="Display name" value={creatingUser.display_name} onChange={e => setCreatingUser({ ...creatingUser, display_name: e.target.value })} />
          <input placeholder="Password" type="password" value={creatingUser.password} onChange={e => setCreatingUser({ ...creatingUser, password: e.target.value })} />
          <select value={creatingUser.role} onChange={e => setCreatingUser({ ...creatingUser, role: e.target.value as User['role'] })}>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="btn btn-xs" onClick={handleCreateUser}>Create</button>
        </div>
        <div className="admin-table">
          <div className="admin-table__head">
            <span>Email</span><span>Role</span><span>Status</span><span>Last login</span><span></span>
          </div>
          {users.map(u => (
            <div className="admin-table__row" key={u.id}>
              <span>{u.email}</span>
              <span>
                <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value as User['role'])}>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </span>
              <span>
                <button className="btn btn-xs" onClick={() => handleStatusToggle(u.id, u.is_active ?? true)}>
                  {u.is_active ?? true ? <CheckCircle2 size={14} color="#10b981" /> : <Ban size={14} color="#ef4444" />} {u.is_active ?? true ? 'Active' : 'Disabled'}
                </button>
              </span>
              <span>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '--'}</span>
              <span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Projects */}
      <div className="admin-card">
        <div className="admin-card__header">
          <div className="admin-card__icon"><FolderOpen size={18} /></div>
          <div className="admin-card__title">Projects</div>
        </div>
        <div className="admin-inline-form">
          <input placeholder="Name" value={creatingProject.name} onChange={e => setCreatingProject({ ...creatingProject, name: e.target.value })} />
          <input placeholder="Code" value={creatingProject.code || ''} onChange={e => setCreatingProject({ ...creatingProject, code: e.target.value || undefined })} />
          <input placeholder="Description" value={creatingProject.description || ''} onChange={e => setCreatingProject({ ...creatingProject, description: e.target.value || undefined })} />
          <button className="btn btn-xs" onClick={handleCreateProject}>Create</button>
        </div>
        <div className="admin-table">
          <div className="admin-table__head" style={{ gridTemplateColumns: '1.2fr 1fr 1.6fr' }}>
            <span>Name</span><span>Code</span><span>Description</span>
          </div>
          {projects.map(p => (
            <div className="admin-table__row" key={p.id} style={{ gridTemplateColumns: '1.2fr 1fr 1.6fr' }}>
              <span>{p.name}</span>
              <span>{p.code || '--'}</span>
              <span>{p.description || '--'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div className="admin-card">
        <div className="admin-card__header">
          <div className="admin-card__icon"><FileText size={18} /></div>
          <div className="admin-card__title">{t('admin.docs.title')}</div>
        </div>
        <div className="admin-inline-form">
          <input placeholder="Meeting ID (optional)" value={uploadMeta.meeting_id || ''} onChange={e => setUploadMeta({ ...uploadMeta, meeting_id: e.target.value || undefined })} />
          <input placeholder="Description (optional)" value={uploadMeta.description || ''} onChange={e => setUploadMeta({ ...uploadMeta, description: e.target.value || undefined })} />
          <input type="file" onChange={e => handleUploadFile(e.target.files?.[0])} />
        </div>
        <div className="admin-table">
          <div className="admin-table__head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr 0.8fr' }}>
            <span>Title</span><span>Meeting</span><span>Type</span><span>Size</span><span></span><span></span>
          </div>
          {docs.map(d => (
            <div className="admin-table__row" key={String(d.id)} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr 0.8fr' }}>
              <span>{d.title}</span>
              <span>{String(d.meeting_id)}</span>
              <span>{d.file_type}</span>
              <span>{d.file_size ? `${(d.file_size / 1024).toFixed(0)} KB` : '--'}</span>
              <span>
                {d.file_url && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a className="btn btn-xs" href={getDocUrl(d)} target="_blank" rel="noreferrer">Open</a>
                    <a className="btn btn-xs" href={getDocUrl(d)} download>Download</a>
                  </div>
                )}
              </span>
              <span><button className="btn btn-xs" onClick={() => handleDeleteDoc(String(d.id))}>Delete</button></span>
            </div>
          ))}
        </div>
      </div>

      {/* Meetings */}
      <div className="admin-card">
        <div className="admin-card__header">
          <div className="admin-card__icon"><FolderOpen size={18} /></div>
          <div className="admin-card__title">{t('admin.meetings.title')}</div>
        </div>
        <div className="admin-table">
          <div className="admin-table__head">
            <span>Title</span><span>Phase</span><span>Start</span><span>End</span>
          </div>
          {meetings.map(m => (
            <div className="admin-table__row" key={m.id}>
              <span>{m.title}</span>
              <span>
                <select value={m.phase} onChange={e => handleUpdateMeetingPhase(m.id, e.target.value)}>
                  {['pre', 'in', 'post'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </span>
              <span>{m.start_time ? new Date(m.start_time).toLocaleString() : '--'}</span>
              <span>{m.end_time ? new Date(m.end_time).toLocaleString() : '--'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action items */}
      <div className="admin-card">
        <div className="admin-card__header">
          <div className="admin-card__icon"><Activity size={18} /></div>
          <div className="admin-card__title">Action Items</div>
        </div>
        <div className="admin-table">
          <div className="admin-table__head">
            <span>Task</span><span>Owner</span><span>Status</span><span>Deadline</span><span></span>
          </div>
          {actions.map(a => (
            <div className="admin-table__row" key={a.id}>
              <span>{a.description}</span>
              <span>{a.owner_name || a.owner_user_id || '--'}</span>
              <span>
                <select value={a.status} onChange={e => handleUpdateActionStatus(a.id, e.target.value)}>
                  {actionStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </span>
              <span>{a.deadline ? a.deadline : '--'}</span>
              <span>
                <button className="btn btn-xs" onClick={() => handleDeleteAction(a.id)}>
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminConsole
