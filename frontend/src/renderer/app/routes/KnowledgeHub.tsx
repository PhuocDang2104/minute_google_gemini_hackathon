import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  BookOpen,
  FileText,
  Send,
  ExternalLink,
  Clock,
  FolderOpen,
  Upload,
  Loader2,
  Plus,
  X,
  CheckCircle,
  Trash2,
} from 'lucide-react'
import { knowledgeApi, type KnowledgeDocument, type RecentQuery } from '../../lib/api/knowledge'
import { meetingsApi } from '../../lib/api/meetings'
import type { Meeting } from '../../shared/dto/meeting'
import { API_URL } from '../../config/env'
import { useLocaleText } from '../../i18n/useLocaleText'

type UploadToastState = {
  status: 'pending' | 'success' | 'error'
  message: string
}

const KnowledgeHub = () => {
  const { lt, dateLocale } = useLocaleText()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<KnowledgeDocument[]>([])
  const [meetingResults, setMeetingResults] = useState<Meeting[]>([])
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([])
  const [suggestedDocs, setSuggestedDocs] = useState<KnowledgeDocument[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadToast, setUploadToast] = useState<UploadToastState | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const qp = searchParams.get('query')
    if (qp) {
      setQuery(qp)
      handleSearch(qp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (uploadToast && uploadToast.status !== 'pending') {
      const timer = setTimeout(() => setUploadToast(null), 2200)
      return () => clearTimeout(timer)
    }
  }, [uploadToast])

  const loadData = async () => {
    setIsLoadingDocs(true)
    try {
      const [docs, recent] = await Promise.all([
        knowledgeApi.list({ limit: 10 }),
        knowledgeApi.getRecentQueries(5),
      ])
      setSuggestedDocs(docs.documents)
      setRecentQueries(recent.queries)
    } catch (err) {
      console.error('Failed to load knowledge data:', err)
    } finally {
      setIsLoadingDocs(false)
    }
  }

  const handleSearch = async (q?: string) => {
    const searchText = (q ?? query).trim()
    if (!searchText || isSearching) return

    setIsSearching(true)
    try {
      const result = await knowledgeApi.search({ query: searchText })
      setSearchResults(result.documents)
      // Meetings: fetch and filter client-side (title/description)
      try {
        const meetingsResp = await meetingsApi.list({ limit: 200 })
        const filtered = (meetingsResp.meetings || []).filter(m =>
          (m.title || '').toLowerCase().includes(searchText.toLowerCase()) ||
          (m.description || '').toLowerCase().includes(searchText.toLowerCase())
        )
        setMeetingResults(filtered)
      } catch (err) {
        console.error('Meeting search failed:', err)
        setMeetingResults([])
      }
      // Refresh recent queries
      const recent = await knowledgeApi.getRecentQueries(5)
      setRecentQueries(recent.queries)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const displayDocs = searchResults.length > 0 ? searchResults : suggestedDocs

  const handleDelete = async (docId: string) => {
    const ok = window.confirm(lt('Bạn có chắc muốn xóa tài liệu này?', 'Are you sure you want to delete this document?'));
    if (!ok) return;
    try {
      await knowledgeApi.delete(docId);
      await loadData();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(lt('Xóa tài liệu thất bại. Vui lòng thử lại.', 'Delete failed. Please try again.'));
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Knowledge Hub</h1>
          <p className="page-header__subtitle">{lt('Tìm kiếm tài liệu và hỏi đáp với AI', 'Search documents and ask AI')}</p>
        </div>
        <button 
          className="btn btn--primary"
          onClick={() => setShowUploadModal(true)}
        >
          <Upload size={16} />
          {lt('Upload tài liệu', 'Upload document')}
        </button>
      </div>

      {/* Search Section */}
      <div className="card mb-6">
        <div className="card__body">
          <div style={{ 
            display: 'flex', 
            gap: 'var(--space-md)',
            padding: 'var(--space-md)',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)'
          }}>
            <Search size={20} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={lt('Tìm kiếm tài liệu theo từ khóa...', 'Search documents by keyword...')}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '15px',
                outline: 'none',
              }}
            />
            <button 
              className="btn btn--primary"
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {lt('Tìm kiếm', 'Search')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="knowledge-hub-layout knowledge-hub-layout--single">
        <div className="knowledge-hub-layout__main">
          <div className="card mb-4">
            <div className="card__header">
              <h3 className="card__title">
                <BookOpen size={18} className="card__title-icon" />
                {searchResults.length > 0
                  ? lt(`Kết quả tìm kiếm (${searchResults.length})`, `Search results (${searchResults.length})`)
                  : lt('Tài liệu phổ biến', 'Popular documents')}
              </h3>
            </div>
            <div className="card__body">
              {isLoadingDocs ? (
                <div className="section-loading">
                  <Loader2 size={20} className="animate-spin" />
                  <span>{lt('Đang tải...', 'Loading...')}</span>
                </div>
              ) : displayDocs.length === 0 ? (
                <div className="empty-state-mini">
                  <FileText size={24} />
                  <p>{lt('Không tìm thấy tài liệu', 'No documents found')}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {displayDocs.map((doc) => (
                    <div 
                      key={doc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-md)',
                        padding: 'var(--space-md)',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-surface-hover)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-surface)'
                      }}
                      onClick={() => {
                        if (doc.file_url) {
                          window.open(doc.file_url, '_blank')
                        }
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        background: 'var(--accent-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <FileText size={18} className="text-accent" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{doc.title}</div>
                        {doc.description && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {doc.description}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginTop: '4px' }}>
                          <FolderOpen size={12} />
                          {doc.source}
                          <span>•</span>
                          {doc.category || doc.document_type}
                          {doc.tags && doc.tags.length > 0 && (
                            <>
                              <span>•</span>
                              {doc.tags.slice(0, 2).join(', ')}
                            </>
                          )}
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                          {doc.file_url && (
                            <>
                              <a
                                className="btn btn-xs"
                                href={doc.file_url.startsWith('http') ? doc.file_url : `${API_URL}${doc.file_url}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {lt('Mở', 'Open')}
                              </a>
                              <a
                                className="btn btn-xs"
                                href={doc.file_url.startsWith('http') ? doc.file_url : `${API_URL}${doc.file_url}`}
                                download
                                onClick={(e) => e.stopPropagation()}
                              >
                                {lt('Tải xuống', 'Download')}
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                        <button
                          className="btn btn--ghost btn--icon btn--sm"
                          style={{ padding: '6px', width: '32px', height: '32px' }}
                          title={lt('Xóa', 'Delete')}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc.id);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {meetingResults.length > 0 && (
            <div className="card">
              <div className="card__header">
                <h3 className="card__title">
                  <Search size={16} className="card__title-icon" />
                  {lt(`Cuộc họp phù hợp (${meetingResults.length})`, `Relevant meetings (${meetingResults.length})`)}
                </h3>
              </div>
              <div className="card__body">
                <div className="tool-panel__list">
                  {meetingResults.map((m) => (
                    <div key={m.id} className="tool-card tool-card--compact">
                      <div className="tool-card__icon">
                        <Clock size={14} />
                      </div>
                      <div className="tool-card__body">
                        <div className="tool-card__title">{m.title}</div>
                        <div className="tool-card__detail">
                          {m.start_time ? new Date(m.start_time).toLocaleString(dateLocale) : lt('Chưa có lịch', 'No schedule yet')}
                        </div>
                      </div>
                      <Link to={`/app/meetings/${m.id}/detail`} className="btn btn--ghost btn--icon btn--sm">
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Queries */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">
                <Clock size={18} className="card__title-icon" />
                {lt('Tìm kiếm gần đây', 'Recent searches')}
              </h3>
            </div>
            <div className="card__body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {recentQueries.length > 0 ? recentQueries.map((item, index) => (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-sm) var(--space-md)',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setQuery(item.query)
                      setTimeout(() => handleSearch(), 100)
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <Search size={14} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '13px' }}>{item.query}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.timestamp}</span>
                  </div>
                )) : (
                  <div className="empty-state-mini">
                    <Clock size={24} />
                    <p>{lt('Chưa có tìm kiếm nào', 'No searches yet')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Upload Document Modal */}
      <UploadDocumentModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          setShowUploadModal(false)
          loadData()
        }}
        onUploadProgress={(state) => setUploadToast(state)}
      />

      {/* Upload toast (bottom-right) */}
      {uploadToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 14px',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            borderRadius: '12px',
            boxShadow: '0 12px 35px rgba(0,0,0,0.28)',
            border: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 260,
            zIndex: 9999,
          }}
        >
          {uploadToast.status === 'pending' && <Loader2 size={18} className="animate-spin" />}
          {uploadToast.status === 'success' && <CheckCircle size={18} color="var(--success)" />}
          {uploadToast.status === 'error' && <X size={18} color="var(--danger)" />}
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{uploadToast.message}</div>
        </div>
      )}
    </div>
  )
}

// Upload Document Modal Component - Modern Design
interface UploadDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onUploadProgress?: (state: UploadToastState) => void
}

const UploadDocumentModal = ({ isOpen, onClose, onSuccess, onUploadProgress }: UploadDocumentModalProps) => {
  const { lt } = useLocaleText()
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    document_type: 'document',
    source: 'Uploaded',
    file_type: 'pdf',
    category: '',
    tags: [] as string[],
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [tagInput, setTagInput] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setIsUploading(true)
    onUploadProgress?.({
      status: 'pending',
      message: lt('Đang upload và vectorizing tài liệu...', 'Uploading and vectorizing document...'),
    })
    try {
      await knowledgeApi.upload({
        ...formData,
        tags: formData.tags,
      }, selectedFile || undefined)
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        document_type: 'document',
        source: 'Uploaded',
        file_type: 'pdf',
        category: '',
        tags: [],
      })
      setSelectedFile(null)
      setTagInput('')
      onUploadProgress?.({
        status: 'success',
        message: lt('Upload & vector hóa hoàn tất!', 'Upload & vectorization completed!'),
      })
      onSuccess()
    } catch (err) {
      console.error('Upload failed:', err)
      onUploadProgress?.({
        status: 'error',
        message: lt('Không thể upload/vectorize. Vui lòng thử lại.', 'Unable to upload/vectorize. Please try again.'),
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] })
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) })
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    setFormData(prev => ({ 
      ...prev, 
      file_type: ext,
      title: prev.title || nameWithoutExt
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (ext: string) => {
    const icons: Record<string, string> = {
      pdf: '📄', docx: '📝', xlsx: '📊', pptx: '📊', 
      txt: '📃', md: '📋', default: '📁'
    }
    return icons[ext] || icons.default
  }

  if (!isOpen) return null

  return (
    <div className="upload-modal-overlay" onClick={onClose}>
      <div className="upload-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="upload-modal__header">
          <div className="upload-modal__header-content">
            <div className="upload-modal__icon">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="upload-modal__title">Upload tài liệu mới</h2>
              <p className="upload-modal__subtitle">Thêm tài liệu vào Knowledge Hub</p>
            </div>
          </div>
          <button className="upload-modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="upload-modal__body">
          {/* Drag & Drop Zone */}
          <div 
            className={`upload-dropzone ${isDragOver ? 'upload-dropzone--active' : ''} ${selectedFile ? 'upload-dropzone--has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              id="file-upload"
              className="upload-dropzone__input"
              onChange={handleFileChange}
              accept=".pdf,.docx,.xlsx,.pptx,.txt,.md"
            />
            
            {selectedFile ? (
              <div className="upload-dropzone__file">
                <span className="upload-dropzone__file-icon">{getFileIcon(formData.file_type)}</span>
                <div className="upload-dropzone__file-info">
                  <span className="upload-dropzone__file-name">{selectedFile.name}</span>
                  <span className="upload-dropzone__file-size">{formatFileSize(selectedFile.size)}</span>
                </div>
                <button 
                  type="button" 
                  className="upload-dropzone__file-remove"
                  onClick={() => setSelectedFile(null)}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label htmlFor="file-upload" className="upload-dropzone__content">
                <div className="upload-dropzone__icon">
                  <Upload size={32} />
                </div>
                <div className="upload-dropzone__text">
                  <span className="upload-dropzone__primary">Kéo thả file vào đây</span>
                  <span className="upload-dropzone__secondary">hoặc <span className="upload-dropzone__link">chọn file</span></span>
                </div>
                <span className="upload-dropzone__hint">PDF, DOCX, XLSX, PPTX, TXT, MD • Tối đa 50MB</span>
              </label>
            )}
          </div>

          {/* Form Grid */}
          <div className="upload-form-grid">
            {/* Title - Full width */}
            <div className="upload-field upload-field--full">
              <label className="upload-field__label">
                Tên tài liệu <span className="upload-field__required">*</span>
              </label>
              <input
                type="text"
                className="upload-field__input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="VD: Thông tư 09/2020 - Quản lý rủi ro CNTT"
                required
              />
            </div>

            {/* Description - Full width */}
            <div className="upload-field upload-field--full">
              <label className="upload-field__label">Mô tả</label>
              <textarea
                className="upload-field__textarea"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả ngắn gọn nội dung và mục đích của tài liệu..."
                rows={3}
              />
            </div>

            {/* Document Type & Source - 2 columns */}
            <div className="upload-field">
              <label className="upload-field__label">Loại tài liệu</label>
              <div className="upload-select">
                <select
                  className="upload-select__input"
                  value={formData.document_type}
                  onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                >
                  <option value="document">📄 Tài liệu chung</option>
                  <option value="regulation">📜 Quy định</option>
                  <option value="policy">📋 Chính sách</option>
                  <option value="technical">⚙️ Kỹ thuật</option>
                  <option value="template">📐 Template</option>
                  <option value="meeting_minutes">📝 Biên bản</option>
                </select>
              </div>
            </div>

            <div className="upload-field">
              <label className="upload-field__label">Nguồn</label>
              <div className="upload-select">
                <select
                  className="upload-select__input"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                >
                  <option value="Uploaded">📤 Uploaded</option>
                  <option value="SharePoint">📁 SharePoint</option>
                  <option value="Wiki">📖 Wiki</option>
                  <option value="LOffice">🏢 LOffice</option>
                  <option value="NHNN">🏛️ NHNN</option>
                </select>
              </div>
            </div>

            {/* Category - Full width */}
            <div className="upload-field upload-field--full">
              <label className="upload-field__label">Danh mục</label>
              <input
                type="text"
                className="upload-field__input"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="VD: Compliance, Technical, Security, Project..."
              />
            </div>

            {/* Tags - Full width */}
            <div className="upload-field upload-field--full">
              <label className="upload-field__label">Tags</label>
              <div className="upload-tags">
                {formData.tags.length > 0 && (
                  <div className="upload-tags__list">
                    {formData.tags.map((tag, idx) => (
                      <span key={idx} className="upload-tag">
                        <span className="upload-tag__text">{tag}</span>
                        <button
                          type="button"
                          className="upload-tag__remove"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="upload-tags__input-wrapper">
                  <input
                    type="text"
                    className="upload-tags__input"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddTag()
                      }
                    }}
                    placeholder={formData.tags.length > 0 ? "Thêm tag..." : "Nhập tag và nhấn Enter..."}
                  />
                  {tagInput.trim() && (
                    <button 
                      type="button" 
                      className="upload-tags__add"
                      onClick={handleAddTag}
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>
              <span className="upload-field__hint">Nhấn Enter để thêm tag mới</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="upload-modal__footer">
          <button type="button" className="upload-btn upload-btn--ghost" onClick={onClose}>
            Hủy bỏ
          </button>
          <button 
            type="submit" 
            className="upload-btn upload-btn--primary"
            disabled={!formData.title.trim() || isUploading}
            onClick={handleSubmit}
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Đang upload...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload tài liệu
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeHub
