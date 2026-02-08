import { useMemo, useState } from 'react'
import { Upload, X, Plus, Loader2 } from 'lucide-react'
import { knowledgeApi } from '../lib/api/knowledge'
import { useLocaleText } from '../i18n/useLocaleText'

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
    meetingId?: string
    simpleMode?: boolean
}

const defaultFormData = {
    title: '',
    description: '',
    document_type: 'document',
    source: 'Uploaded',
    file_type: 'pdf',
    category: '',
    tags: [] as string[],
}

export const UploadDocumentModal = ({
    isOpen,
    onClose,
    onSuccess,
    onUploadProgress,
    projectId,
    meetingId,
    simpleMode = false,
}: UploadDocumentModalProps) => {
    const { lt } = useLocaleText()
    const [isUploading, setIsUploading] = useState(false)
    const [isDragOver, setIsDragOver] = useState(false)
    const [formData, setFormData] = useState(defaultFormData)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [tagInput, setTagInput] = useState('')

    const modalTitle = useMemo(
        () => (simpleMode ? lt('Tải tài liệu dự án', 'Upload project document') : lt('Upload tài liệu mới', 'Upload new document')),
        [lt, simpleMode],
    )

    const modalSubtitle = useMemo(() => {
        if (simpleMode) {
            return lt('Chọn file, đặt tên và tải lên nhanh.', 'Choose file, set title, and upload quickly.')
        }
        if (meetingId) return lt('Thêm tài liệu vào phiên', 'Add document to session')
        if (projectId) return lt('Thêm tài liệu vào dự án', 'Add document to project')
        return lt('Thêm tài liệu vào Knowledge Hub', 'Add document to Knowledge Hub')
    }, [lt, meetingId, projectId, simpleMode])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title.trim()) return
        if (simpleMode && !selectedFile) return

        setIsUploading(true)
        onUploadProgress?.({
            status: 'pending',
            message: lt('Đang upload và vectorizing tài liệu...', 'Uploading and vectorizing document...'),
        })
        try {
            const inferredFileType = selectedFile?.name.split('.').pop()?.toLowerCase() || formData.file_type
            await knowledgeApi.upload({
                title: formData.title.trim(),
                description: formData.description.trim() || undefined,
                document_type: simpleMode ? 'document' : formData.document_type,
                source: simpleMode ? 'Uploaded' : formData.source,
                file_type: inferredFileType,
                category: formData.category.trim() || undefined,
                tags: simpleMode ? [] : formData.tags,
                project_id: projectId,
                meeting_id: meetingId,
            } as any, selectedFile || undefined)

            // Reset form
            setFormData(defaultFormData)
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
            <div className={`upload-modal ${simpleMode ? 'upload-modal--simple' : ''}`} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="upload-modal__header">
                    <div className="upload-modal__header-content">
                        <div className="upload-modal__icon">
                            <Upload size={20} />
                        </div>
                        <div>
                            <h2 className="upload-modal__title">{modalTitle}</h2>
                            <p className="upload-modal__subtitle">{modalSubtitle}</p>
                        </div>
                    </div>
                    <button className="upload-modal__close" onClick={onClose} type="button">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className={`upload-modal__body ${simpleMode ? 'upload-modal__body--simple' : ''}`}>
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
                                    <span className="upload-dropzone__primary">{lt('Kéo thả file vào đây', 'Drop file here')}</span>
                                    <span className="upload-dropzone__secondary">
                                        {lt('hoặc ', 'or ')}
                                        <span className="upload-dropzone__link">{lt('chọn file', 'choose file')}</span>
                                    </span>
                                </div>
                                <span className="upload-dropzone__hint">{lt('PDF, DOCX, XLSX, PPTX, TXT, MD • Tối đa 50MB', 'PDF, DOCX, XLSX, PPTX, TXT, MD • Max 50MB')}</span>
                            </label>
                        )}
                    </div>

                    {/* Form Grid */}
                    <div className={`upload-form-grid ${simpleMode ? 'upload-form-grid--simple' : ''}`}>
                        <div className="upload-field upload-field--full">
                            <label className="upload-field__label">
                                {lt('Tên tài liệu', 'Document title')} <span className="upload-field__required">*</span>
                            </label>
                            <input
                                type="text"
                                className="upload-field__input"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder={lt(
                                    'VD: Biên bản họp sprint planning tuần 3',
                                    'e.g. Sprint planning notes week 3',
                                )}
                                required
                            />
                        </div>

                        <div className="upload-field upload-field--full">
                            <label className="upload-field__label">{lt('Mô tả', 'Description')}</label>
                            <textarea
                                className="upload-field__textarea"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder={lt('Mô tả ngắn gọn nội dung tài liệu...', 'Short description of this document...')}
                                rows={simpleMode ? 2 : 3}
                            />
                        </div>

                        {!simpleMode && (
                            <>
                                <div className="upload-field">
                                    <label className="upload-field__label">{lt('Loại tài liệu', 'Document type')}</label>
                                    <div className="upload-select">
                                        <select
                                            className="upload-select__input"
                                            value={formData.document_type}
                                            onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                                        >
                                            <option value="document">📄 {lt('Tài liệu chung', 'General document')}</option>
                                            <option value="regulation">📜 {lt('Quy định', 'Regulation')}</option>
                                            <option value="policy">📋 {lt('Chính sách', 'Policy')}</option>
                                            <option value="technical">⚙️ {lt('Kỹ thuật', 'Technical')}</option>
                                            <option value="template">📐 {lt('Template', 'Template')}</option>
                                            <option value="meeting_minutes">📝 {lt('Biên bản', 'Meeting minutes')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="upload-field">
                                    <label className="upload-field__label">{lt('Nguồn', 'Source')}</label>
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

                                <div className="upload-field upload-field--full">
                                    <label className="upload-field__label">{lt('Danh mục', 'Category')}</label>
                                    <input
                                        type="text"
                                        className="upload-field__input"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        placeholder={lt(
                                            'VD: Compliance, Technical, Security, Project...',
                                            'e.g. Compliance, Technical, Security, Project...',
                                        )}
                                    />
                                </div>

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
                                                placeholder={
                                                    formData.tags.length > 0
                                                        ? lt('Thêm tag...', 'Add tag...')
                                                        : lt('Nhập tag và nhấn Enter...', 'Type tag and press Enter...')
                                                }
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
                                    <span className="upload-field__hint">{lt('Nhấn Enter để thêm tag mới', 'Press Enter to add tag')}</span>
                                </div>
                            </>
                        )}
                    </div>
                </form>

                {/* Footer */}
                <div className="upload-modal__footer">
                    <button type="button" className="upload-btn upload-btn--ghost" onClick={onClose}>
                        {lt('Hủy bỏ', 'Cancel')}
                    </button>
                    <button
                        type="submit"
                        className="upload-btn upload-btn--primary"
                        disabled={!formData.title.trim() || isUploading || (simpleMode && !selectedFile)}
                        onClick={handleSubmit}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                {lt('Đang upload...', 'Uploading...')}
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                {lt('Upload tài liệu', 'Upload document')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default UploadDocumentModal
