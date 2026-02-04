import { useEffect, useState } from 'react'
import { PlusCircle, RefreshCw, Edit2, Trash2, Star, FileText, CheckCircle2, XCircle } from 'lucide-react'
import { minutesTemplateApi, type MinutesTemplate } from '../../lib/api/minutes_template'
import TemplateEditor from './Templates/TemplateEditor'

const TemplateManagement = () => {
  const [templates, setTemplates] = useState<MinutesTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MinutesTemplate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const res = await minutesTemplateApi.list({ limit: 200 })
      setTemplates(res.templates)
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const handleCreate = () => {
    setEditingTemplate(null)
    setShowEditor(true)
  }

  const handleEdit = (template: MinutesTemplate) => {
    setEditingTemplate(template)
    setShowEditor(true)
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Bạn có chắc muốn xóa template này?')) return

    setDeletingId(templateId)
    try {
      await minutesTemplateApi.delete(templateId)
      await loadTemplates()
    } catch (err) {
      console.error('Failed to delete template:', err)
      alert('Không thể xóa template. Có thể template đang được sử dụng.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSetDefault = async (templateId: string) => {
    try {
      await minutesTemplateApi.setDefault(templateId)
      await loadTemplates()
    } catch (err) {
      console.error('Failed to set default template:', err)
      alert('Không thể đặt template mặc định.')
    }
  }

  const handleEditorClose = () => {
    setShowEditor(false)
    setEditingTemplate(null)
  }

  const handleEditorSuccess = () => {
    handleEditorClose()
    loadTemplates()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-header__eyebrow">Templates</p>
          <h1 className="page-header__title">Quản lý Template Biên bản</h1>
          <p className="page-header__subtitle">
            Tạo và quản lý các template cho biên bản cuộc họp
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-outline" onClick={loadTemplates} disabled={loading}>
            <RefreshCw size={16} style={{ marginRight: 6 }} /> {loading ? 'Đang tải...' : 'Tải lại'}
          </button>
          <button className="btn btn--primary" onClick={handleCreate}>
            <PlusCircle size={16} style={{ marginRight: 6 }} /> Tạo template
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Danh sách templates</h3>
          <p className="card__subtitle">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        </div>

        {loading && templates.length === 0 ? (
          <div className="empty-state">
            <FileText className="empty-state__icon" />
            <h3 className="empty-state__title">Đang tải...</h3>
          </div>
        ) : templates.length === 0 ? (
          <div className="empty-state">
            <FileText className="empty-state__icon" />
            <h3 className="empty-state__title">Chưa có template nào</h3>
            <p className="empty-state__description">Bấm "Tạo template" để thêm template mới.</p>
          </div>
        ) : (
          <div className="meeting-list">
            {templates.map((template) => (
              <div key={template.id} className="meeting-item">
                <div className="meeting-item__content" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="meeting-item__title">{template.name}</div>
                    {template.is_default && (
                      <span
                        className="badge badge--primary"
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        <Star size={12} style={{ marginRight: 4 }} />
                        Mặc định
                      </span>
                    )}
                    {!template.is_active && (
                      <span
                        className="badge badge--ghost"
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        <XCircle size={12} style={{ marginRight: 4 }} />
                        Không hoạt động
                      </span>
                    )}
                    {template.is_active && !template.is_default && (
                      <span
                        className="badge badge--success"
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        <CheckCircle2 size={12} style={{ marginRight: 4 }} />
                        Hoạt động
                      </span>
                    )}
                  </div>
                  <div className="meeting-item__meta">
                    {template.code && (
                      <span className="meeting-item__meta-item">Mã: {template.code}</span>
                    )}
                    {template.meeting_types && template.meeting_types.length > 0 && (
                      <span className="meeting-item__meta-item">
                        Loại: {template.meeting_types.join(', ')}
                      </span>
                    )}
                    {template.created_at && (
                      <span className="meeting-item__meta-item">
                        {new Date(template.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <div className="meeting-item__meta" style={{ marginTop: 6 }}>
                      <span className="meeting-item__meta-item" style={{ color: 'var(--text-secondary)' }}>
                        {template.description}
                      </span>
                    </div>
                  )}
                  {template.structure?.sections && (
                    <div className="meeting-item__meta" style={{ marginTop: 6, fontSize: '12px' }}>
                      <span className="meeting-item__meta-item" style={{ color: 'var(--text-muted)' }}>
                        {template.structure.sections.length} section{template.structure.sections.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!template.is_default && (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleSetDefault(template.id)}
                      title="Đặt làm mặc định"
                    >
                      <Star size={16} />
                    </button>
                  )}
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleEdit(template)}
                    title="Chỉnh sửa"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleDelete(template.id)}
                    disabled={deletingId === template.id}
                    title="Xóa"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditor && (
        <TemplateEditor
          template={editingTemplate}
          onClose={handleEditorClose}
          onSuccess={handleEditorSuccess}
        />
      )}
    </div>
  )
}

export default TemplateManagement

