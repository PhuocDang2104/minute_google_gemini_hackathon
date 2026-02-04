import { useState } from 'react'
import { Upload, X, Plus, Loader2 } from 'lucide-react'
import { knowledgeApi } from '../lib/api/knowledge'

export type UploadToastState = {
    status: 'pending' | 'success' | 'error'
    message: string
}

interface UploadDocumentModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    onUploadProgress?: (state: UploadToastState) => void
    projectId?: string
}

export const UploadDocumentModal = ({ isOpen, onClose, onSuccess, onUploadProgress, projectId }: UploadDocumentModalProps) => {
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
            message: 'Đang upload và vectorizing tài liệu...',
        })
        try {
            await knowledgeApi.upload({
                ...formData,
                tags: formData.tags,
                project_id: projectId,
            } as any, selectedFile || undefined)

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
                message: 'Upload & vector hóa hoàn tất!',
            })
            onSuccess()
        } catch (err) {
            console.error('Upload failed:', err)
            onUploadProgress?.({
                status: 'error',
                message: 'Không thể upload/vectorize. Vui lòng thử lại.',
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
                            <p className="upload-modal__subtitle">
                                {projectId ? 'Thêm tài liệu vào dự án' : 'Thêm tài liệu vào Knowledge Hub'}
                            </p>
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

export default UploadDocumentModal
