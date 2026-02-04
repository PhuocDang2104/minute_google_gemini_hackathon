import { useState, useEffect } from 'react'
import { minutesTemplateApi, type MinutesTemplate, type MinutesTemplateCreate, type MinutesTemplateUpdate } from '../../../lib/api/minutes_template'

type TemplateEditorProps = {
  template: MinutesTemplate | null // null = create new, non-null = edit
  onClose: () => void
  onSuccess: () => void
}

const DEFAULT_STRUCTURE = {
  sections: [
    {
      id: 'header',
      title: 'THÔNG TIN CUỘC HỌP',
      order: 1,
      required: true,
      fields: [
        {
          id: 'meeting_title',
          label: 'Tên cuộc họp',
          type: 'text',
          required: true,
          source: 'meeting.title',
        },
        {
          id: 'meeting_date',
          label: 'Ngày giờ họp',
          type: 'datetime',
          required: true,
          source: 'meeting.start_time',
        },
      ],
    },
  ],
  formatting: {
    style: 'formal',
    language: 'vi',
    date_format: 'dd/mm/yyyy',
    time_format: 'HH:mm',
  },
}

const TemplateEditor = ({ template, onClose, onSuccess }: TemplateEditorProps) => {
  const isEdit = template !== null

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    meeting_types: [] as string[],
    is_active: true,
    is_default: false,
  })

  const [structureJson, setStructureJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [meetingTypeInput, setMeetingTypeInput] = useState('')

  useEffect(() => {
    if (template) {
      setForm({
        name: template.name || '',
        code: template.code || '',
        description: template.description || '',
        meeting_types: template.meeting_types || [],
        is_active: template.is_active !== false,
        is_default: template.is_default || false,
      })
      setStructureJson(JSON.stringify(template.structure || DEFAULT_STRUCTURE, null, 2))
    } else {
      setForm({
        name: '',
        code: '',
        description: '',
        meeting_types: [],
        is_active: true,
        is_default: false,
      })
      setStructureJson(JSON.stringify(DEFAULT_STRUCTURE, null, 2))
    }
  }, [template])

  const validateJson = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr)
      if (!parsed.sections || !Array.isArray(parsed.sections)) {
        setJsonError('Structure must have "sections" array')
        return false
      }
      setJsonError(null)
      return true
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON')
      return false
    }
  }

  const handleStructureChange = (value: string) => {
    setStructureJson(value)
    validateJson(value)
  }

  const handleAddMeetingType = () => {
    const trimmed = meetingTypeInput.trim()
    if (trimmed && !form.meeting_types.includes(trimmed)) {
      setForm({ ...form, meeting_types: [...form.meeting_types, trimmed] })
      setMeetingTypeInput('')
    }
  }

  const handleRemoveMeetingType = (type: string) => {
    setForm({ ...form, meeting_types: form.meeting_types.filter((t) => t !== type) })
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      alert('Vui lòng nhập tên template')
      return
    }

    if (!validateJson(structureJson)) {
      alert('Structure JSON không hợp lệ. Vui lòng kiểm tra lại.')
      return
    }

    const structure = JSON.parse(structureJson)

    setSaving(true)
    try {
      if (isEdit && template) {
        const updateData: MinutesTemplateUpdate = {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          description: form.description.trim() || undefined,
          meeting_types: form.meeting_types.length > 0 ? form.meeting_types : undefined,
          is_active: form.is_active,
          is_default: form.is_default,
          structure: structure,
        }
        await minutesTemplateApi.update(template.id, updateData)
      } else {
        const createData: MinutesTemplateCreate = {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          description: form.description.trim() || undefined,
          meeting_types: form.meeting_types.length > 0 ? form.meeting_types : undefined,
          is_active: form.is_active,
          is_default: form.is_default,
          structure: structure,
        }
        await minutesTemplateApi.create(createData)
      }
      onSuccess()
    } catch (err: any) {
      console.error('Failed to save template:', err)
      alert(`Không thể lưu template: ${err.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 800, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal__header">
          <h3 className="modal__title">{isEdit ? 'Chỉnh sửa Template' : 'Tạo Template Mới'}</h3>
          <button className="modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Basic Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">
                Tên template <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                className="form-input"
                placeholder="VD: Biên bản Họp Thường kỳ"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mã template</label>
              <input
                className="form-input"
                placeholder="VD: DEFAULT_TEMPLATE"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Mô tả về template này..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Meeting Types */}
          <div className="form-group">
            <label className="form-label">Loại cuộc họp (optional)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                className="form-input"
                placeholder="VD: board, weekly, planning"
                value={meetingTypeInput}
                onChange={(e) => setMeetingTypeInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddMeetingType()
                  }
                }}
              />
              <button className="btn btn-outline" onClick={handleAddMeetingType}>
                Thêm
              </button>
            </div>
            {form.meeting_types.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {form.meeting_types.map((type) => (
                  <span key={type} className="badge badge--primary" style={{ fontSize: '12px', padding: '4px 8px' }}>
                    {type}
                    <button
                      onClick={() => handleRemoveMeetingType(type)}
                      style={{
                        marginLeft: 6,
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '14px',
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Flags */}
          <div style={{ display: 'flex', gap: 16 }}>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span>Hoạt động</span>
            </label>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              />
              <span>Đặt làm mặc định</span>
            </label>
          </div>

          {/* Structure JSON Editor */}
          <div className="form-group">
            <label className="form-label">
              Structure (JSON) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              className="form-textarea"
              rows={15}
              style={{
                fontFamily: 'monospace',
                fontSize: '13px',
                lineHeight: '1.5',
                ...(jsonError ? { borderColor: 'var(--danger)' } : {}),
              }}
              value={structureJson}
              onChange={(e) => handleStructureChange(e.target.value)}
              placeholder='{"sections": [...]}'
            />
            {jsonError && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: 4 }}>⚠️ {jsonError}</div>
            )}
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>
              Structure JSON định nghĩa các sections và fields của template. Xem example trong migration file để
              tham khảo.
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button
            className="btn btn--primary"
            disabled={saving || !form.name.trim() || !!jsonError}
            onClick={handleSubmit}
          >
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo template'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TemplateEditor

