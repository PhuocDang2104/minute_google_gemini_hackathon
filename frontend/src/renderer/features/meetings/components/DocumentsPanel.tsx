import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  ExternalLink,
  Check,
  X,
  Loader2,
  FolderOpen,
  Link as LinkIcon,
} from 'lucide-react';
import { aiApi } from '../../../lib/api/ai';
import { documentsApi, type DocumentCreate } from '../../../lib/api/documents';
import type { PrereadDocument, MeetingSuggestion } from '../../../shared/dto/ai';
import { SOURCE_ICONS } from '../../../shared/dto/ai';

interface DocumentsPanelProps {
  meetingId: string;
}

export const DocumentsPanel = ({ meetingId }: DocumentsPanelProps) => {
  const [documents, setDocuments] = useState<PrereadDocument[]>([]);
  const [suggestions, setSuggestions] = useState<MeetingSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSuggested, setHasSuggested] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleSuggest = async () => {
    setIsLoading(true);
    try {
      const [docsResponse, suggestionsResponse] = await Promise.all([
        aiApi.suggestDocuments(meetingId),
        aiApi.getSuggestions(meetingId),
      ]);
      setDocuments(docsResponse.documents);
      setSuggestions(suggestionsResponse.suggestions.filter(s => s.suggestion_type === 'document'));
      setHasSuggested(true);
    } catch (err) {
      console.error('Failed to get suggestions:', err);
      // Mock data
      setDocuments([
        {
          id: '1',
          meeting_id: meetingId,
          title: 'Project Charter - Core Banking Modernization',
          source: 'SharePoint',
          url: 'https://lpbank.sharepoint.com/docs/charter.pdf',
          snippet: 'Tài liệu Project Charter định nghĩa scope, objectives...',
          relevance_score: 0.95,
          status: 'suggested',
        },
        {
          id: '2',
          meeting_id: meetingId,
          title: 'Technical Architecture Document v2.1',
          source: 'SharePoint',
          url: 'https://lpbank.sharepoint.com/docs/arch.pdf',
          snippet: 'Kiến trúc kỹ thuật bao gồm system design...',
          relevance_score: 0.92,
          status: 'suggested',
        },
        {
          id: '3',
          meeting_id: meetingId,
          title: 'NHNN Circular 09/2020',
          source: 'Wiki',
          url: 'https://wiki.lpbank.vn/compliance',
          snippet: 'Thông tư quy định về quản lý rủi ro CNTT...',
          relevance_score: 0.88,
          status: 'suggested',
        },
      ]);
      setHasSuggested(true);
    } finally {
      setIsLoading(false);
    }
  };

  const updateDocStatus = (docId: string, status: 'accepted' | 'ignored') => {
    setDocuments(prev => prev.map(doc =>
      doc.id === docId ? { ...doc, status } : doc
    ));
  };

  const handleUpload = async (data: { title: string; description?: string; file_type: string; file_url?: string }) => {
    setIsUploading(true);
    try {
      const uploadData: DocumentCreate = {
        meeting_id: meetingId,
        title: data.title,
        file_type: data.file_type,
        description: data.description,
        file_url: data.file_url || `/uploads/${Date.now()}_${data.title}`,
      };

      await documentsApi.upload(uploadData);

      // Add to local documents list
      const newDoc: PrereadDocument = {
        id: Date.now().toString(),
        meeting_id: meetingId,
        title: data.title,
        source: 'Upload',
        url: data.file_url || '#',
        snippet: data.description || '',
        relevance_score: 1.0,
        status: 'accepted',
      };
      setDocuments(prev => [newDoc, ...prev]);
      setShowUploadModal(false);
    } catch (err) {
      console.error('Failed to upload document:', err);
      // Still add locally for demo
      const newDoc: PrereadDocument = {
        id: Date.now().toString(),
        meeting_id: meetingId,
        title: data.title,
        source: 'Upload',
        url: '#',
        snippet: data.description || '',
        relevance_score: 1.0,
        status: 'accepted',
      };
      setDocuments(prev => [newDoc, ...prev]);
      setShowUploadModal(false);
    } finally {
      setIsUploading(false);
    }
  };

  const acceptedDocs = documents.filter(d => d.status === 'accepted');
  const suggestedDocs = documents.filter(d => d.status === 'suggested');

  return (
    <div className="documents-panel">
      <div className="panel-header">
        <h3 className="panel-title">Tài liệu Pre-read</h3>
        <div className="panel-actions">
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => setShowUploadModal(true)}
          >
            <Upload size={14} />
            Tải lên
          </button>
          <button
            className="btn btn--accent btn--sm"
            onClick={handleSuggest}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="spinner" />
                Đang tìm...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                AI Gợi ý tài liệu
              </>
            )}
          </button>
        </div>
      </div>

      {/* Accepted Documents */}
      {acceptedDocs.length > 0 && (
        <div className="document-section">
          <h4 className="document-section__title">
            <Check size={14} />
            Tài liệu đã chọn ({acceptedDocs.length})
          </h4>
          <div className="document-list">
            {acceptedDocs.map(doc => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onAccept={() => { }}
                onIgnore={() => updateDocStatus(doc.id, 'suggested')}
                showActions={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      {suggestedDocs.length > 0 && (
        <div className="document-section">
          <h4 className="document-section__title">
            <Sparkles size={14} />
            AI Gợi ý ({suggestedDocs.length})
          </h4>
          <div className="document-list">
            {suggestedDocs.map(doc => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onAccept={() => updateDocStatus(doc.id, 'accepted')}
                onIgnore={() => updateDocStatus(doc.id, 'ignored')}
                showActions={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {documents.length === 0 && !isLoading && (
        <div className="empty-state">
          <FolderOpen className="empty-state__icon" />
          <h3 className="empty-state__title">Chưa có tài liệu</h3>
          <p className="empty-state__description">
            Bấm "AI Gợi ý tài liệu" để Minute tìm các tài liệu liên quan từ SharePoint, Wiki, và các nguồn nội bộ
          </p>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadDocumentModal
          onUpload={handleUpload}
          onClose={() => setShowUploadModal(false)}
          isUploading={isUploading}
        />
      )}
    </div>
  );
};

// Upload Document Modal
interface UploadDocumentModalProps {
  onUpload: (data: { title: string; description?: string; file_type: string; file_url?: string }) => void;
  onClose: () => void;
  isUploading: boolean;
}

const UploadDocumentModal = ({ onUpload, onClose, isUploading }: UploadDocumentModalProps) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    file_type: 'pdf',
    file_url: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFormData(prev => ({
        ...prev,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
        file_type: file.name.split('.').pop() || 'pdf',
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onUpload(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal__header">
          <h3>Tải lên tài liệu</h3>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            {/* File Select */}
            <div className="form-group">
              <label className="form-label">Chọn file</label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              />
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ width: '100%' }}
              >
                <Upload size={16} />
                {selectedFile ? selectedFile.name : 'Chọn file...'}
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Hỗ trợ: PDF, Word, Excel, PowerPoint, Text
              </p>
            </div>

            {/* Title */}
            <div className="form-group">
              <label className="form-label">Tiêu đề *</label>
              <input
                type="text"
                className="form-input"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Tên tài liệu..."
                required
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Mô tả</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả ngắn về nội dung..."
              />
            </div>

            {/* File Type */}
            <div className="form-group">
              <label className="form-label">Loại file</label>
              <select
                className="form-select"
                value={formData.file_type}
                onChange={e => setFormData(prev => ({ ...prev, file_type: e.target.value }))}
              >
                <option value="pdf">PDF</option>
                <option value="docx">Word (DOCX)</option>
                <option value="xlsx">Excel (XLSX)</option>
                <option value="pptx">PowerPoint (PPTX)</option>
                <option value="txt">Text</option>
              </select>
            </div>

            {/* URL (optional) */}
            <div className="form-group">
              <label className="form-label">URL (tùy chọn)</label>
              <input
                type="url"
                className="form-input"
                value={formData.file_url}
                onChange={e => setFormData(prev => ({ ...prev, file_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn--primary" disabled={isUploading || !formData.title.trim()}>
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Tải lên
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Document Card Component
interface DocumentCardProps {
  document: PrereadDocument;
  onAccept: () => void;
  onIgnore: () => void;
  showActions: boolean;
}

const DocumentCard = ({ document, onAccept, onIgnore, showActions }: DocumentCardProps) => {
  return (
    <div className="document-card">
      <div className="document-card__icon">
        {SOURCE_ICONS[document.source] || '📄'}
      </div>
      <div className="document-card__content">
        <div className="document-card__header">
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            className="document-card__title"
          >
            {document.title}
            <ExternalLink size={12} />
          </a>
          <span className="document-card__source">{document.source}</span>
        </div>
        <p className="document-card__snippet">{document.snippet}</p>
        <div className="document-card__footer">
          <span className="document-card__score">
            Độ phù hợp: {Math.round(document.relevance_score * 100)}%
          </span>
        </div>
      </div>
      {showActions && (
        <div className="document-card__actions">
          <button className="btn btn--icon btn--success" onClick={onAccept} title="Chấp nhận">
            <Check size={16} />
          </button>
          <button className="btn btn--icon btn--muted" onClick={onIgnore} title="Bỏ qua">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentsPanel;

