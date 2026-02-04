/**
 * Post-Meeting Tab V2 - Notion AI Style
 * Editable, clean, professional meeting minutes editor
 */
import { useEffect, useState } from 'react';
import {
  Sparkles,
  Edit3,
  Check,
  X,
  Copy,
  Download,
  Mail,
  RefreshCw,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import type { MeetingWithParticipants } from '../../../../shared/dto/meeting';
import { minutesApi, type MeetingMinutes } from '../../../../lib/api/minutes';
import { itemsApi, type ActionItem, type DecisionItem, type RiskItem } from '../../../../lib/api/items';
import { transcriptsApi } from '../../../../lib/api/transcripts';
import { meetingsApi } from '../../../../lib/api/meetings';

interface PostMeetTabV2Props {
  meeting: MeetingWithParticipants;
  onRefresh: () => void;
}

export const PostMeetTabV2 = ({ meeting }: PostMeetTabV2Props) => {
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [enableDiarization, setEnableDiarization] = useState(true);

  useEffect(() => {
    loadMinutes();
  }, [meeting.id]);

  const loadMinutes = async () => {
    setIsLoading(true);
    try {
      const data = await minutesApi.getLatest(meeting.id);
      setMinutes(data);
    } catch (err) {
      console.error('Load minutes failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // 1. Check/Generate Transcript
      try {
        const transcriptList = await transcriptsApi.list(meeting.id);
        if (!transcriptList.chunks || transcriptList.chunks.length === 0) {
          console.log('No transcripts found. Triggering inference...');
          const inferenceResult = await meetingsApi.triggerInference(meeting.id, enableDiarization);
          if (!inferenceResult.transcript_count) {
            console.warn('Inference finished but no transcripts created?');
          }
        }
      } catch (infErr: any) {
        console.error('Auto-transcript generation failed:', infErr);
        // Continue anyway? Or ask? For now, we continue but warn
        if (!confirm('Không tìm thấy transcript và không thể tự động tạo. Bạn có muốn tiếp tục tạo biên bản không?')) {
          setIsGenerating(false);
          return;
        }
      }

      // 2. Generate Minutes
      const generated = await minutesApi.generate({
        meeting_id: meeting.id,
        include_transcript: true,
        include_actions: true,
        include_decisions: true,
        include_risks: true,
        format: 'markdown',
      });
      setMinutes(generated);
    } catch (err) {
      console.error('Generate failed:', err);
      alert('Không thể tạo biên bản. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="notion-editor">
        <div className="notion-editor__loading">
          <div className="spinner" />
          <p>Đang tải biên bản họp...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notion-editor">
      {/* Header Actions */}
      <div className="notion-editor__header">
        <div className="notion-editor__header-left">
          <h1 className="notion-editor__title">📝 Biên bản họp</h1>
          <div className="notion-editor__meta">
            {minutes ? (
              <>
                <StatusBadge status={minutes.status} />
                <span className="notion-editor__meta-item">
                  v{minutes.version} • {new Date(minutes.created_at).toLocaleString('vi-VN')}
                </span>
              </>
            ) : (
              <span className="notion-editor__meta-item">Chưa có biên bản</span>
            )}
          </div>
        </div>

        <div className="notion-editor__header-actions">
          {minutes && (
            <>
              <ActionButton icon={<Copy size={16} />} label="Copy" onClick={() => {
                navigator.clipboard.writeText(minutes.minutes_markdown || '');
                alert('Đã copy biên bản!');
              }} />
              <ActionButton icon={<Download size={16} />} label="Export" onClick={() => {
                // TODO: Implement export
                alert('Export PDF/DOCX coming soon!');
              }} />
              <ActionButton icon={<Mail size={16} />} label="Gửi" onClick={() => {
                // TODO: Implement email
                alert('Email distribution coming soon!');
              }} />
            </>
          )}

          <button
            className="btn btn--primary"
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{ marginLeft: 8 }}
          >
            <Sparkles size={16} style={{ marginRight: 6 }} />
            {isGenerating ? 'Đang tạo...' : minutes ? 'Tạo lại' : 'Tạo biên bản'}
          </button>
        </div>
      </div>

      {/* Content */}
      {!minutes ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableDiarization}
                onChange={(e) => setEnableDiarization(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Kích hoạt nhận dạng người nói (Diarization)
              </span>
            </label>
          </div>
          <EmptyState onGenerate={handleGenerate} isGenerating={isGenerating} />
        </>
      ) : (
        <div className="notion-editor__content">
          {/* Executive Summary */}
          <EditableBlock
            title="Tóm tắt"
            icon="📋"
            content={minutes.executive_summary || ''}
            onSave={async (content) => {
              await minutesApi.update(minutes.id, { executive_summary: content });
              setMinutes({ ...minutes, executive_summary: content });
            }}
            placeholder="AI sẽ tạo tóm tắt ngắn gọn về cuộc họp..."
          />

          {/* Main Minutes */}
          <EditableBlock
            title="Biên bản chi tiết"
            icon="📄"
            content={minutes.minutes_markdown || ''}
            onSave={async (content) => {
              await minutesApi.update(minutes.id, { minutes_markdown: content });
              setMinutes({ ...minutes, minutes_markdown: content });
            }}
            placeholder="AI sẽ tạo biên bản đầy đủ từ transcript..."
            isMarkdown
            large
          />

          {/* Action Items */}
          <ActionItemsBlockV2 meetingId={meeting.id} />

          {/* Decisions */}
          <DecisionsBlockV2 meetingId={meeting.id} />

          {/* Risks */}
          <RisksBlockV2 meetingId={meeting.id} />

          {/* Highlights */}
          {minutes.highlights && (
            <EditableBlock
              title="Highlights"
              icon="✨"
              content={JSON.stringify(minutes.highlights, null, 2)}
              onSave={async (content) => {
                try {
                  const parsed = JSON.parse(content);
                  await minutesApi.update(minutes.id, { highlights: parsed });
                  setMinutes({ ...minutes, highlights: parsed });
                } catch (err) {
                  alert('Invalid JSON format');
                }
              }}
              placeholder="Key moments and quotes..."
            />
          )}
        </div>
      )}
    </div>
  );
};

// ==================== Empty State ====================
const EmptyState = ({ onGenerate, isGenerating }: { onGenerate: () => void; isGenerating: boolean }) => {
  return (
    <div className="notion-empty-state">
      <div className="notion-empty-state__icon">
        <Sparkles size={48} strokeWidth={1.5} />
      </div>
      <h3 className="notion-empty-state__title">Tạo biên bản với AI</h3>
      <p className="notion-empty-state__description">
        AI sẽ phân tích transcript và tạo biên bản đầy đủ bao gồm:
        <br />Tóm tắt • Action Items • Decisions • Risks • Highlights
      </p>
      <button className="btn btn--primary btn--lg" onClick={onGenerate} disabled={isGenerating}>
        <Sparkles size={18} style={{ marginRight: 8 }} />
        {isGenerating ? 'Đang tạo biên bản...' : 'Tạo biên bản với AI'}
      </button>
    </div>
  );
};

// ==================== Status Badge ====================
const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    draft: { label: 'Nháp', color: '#6b7280', icon: <Edit3 size={12} /> },
    reviewed: { label: 'Đã duyệt', color: '#3b82f6', icon: <CheckCircle size={12} /> },
    approved: { label: 'Phê duyệt', color: '#10b981', icon: <CheckCircle size={12} /> },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

  return (
    <div
      className="status-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: `${config.color}15`,
        color: config.color,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {config.icon}
      {config.label}
    </div>
  );
};

// ==================== Action Button ====================
const ActionButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => {
  return (
    <button className="notion-action-btn" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
};

// ==================== Editable Block ====================
interface EditableBlockProps {
  title: string;
  icon: string;
  content: string;
  onSave: (content: string) => Promise<void>;
  placeholder?: string;
  isMarkdown?: boolean;
  large?: boolean;
}

const EditableBlock = ({ title, icon, content, onSave, placeholder, isMarkdown, large }: EditableBlockProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setEditContent(content);
  }, [content]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editContent);
      setIsEditing(false);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Lưu thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  return (
    <div
      className={`notion-block ${large ? 'notion-block--large' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Block Header */}
      <div className="notion-block__header">
        <div className="notion-block__title">
          <span className="notion-block__icon">{icon}</span>
          <span className="notion-block__title-text">{title}</span>
        </div>

        {/* Hover Actions */}
        {!isEditing && isHovered && content && (
          <div className="notion-block__actions">
            <button className="notion-icon-btn" onClick={() => setIsEditing(true)} title="Chỉnh sửa">
              <Edit3 size={14} />
            </button>
            <button
              className="notion-icon-btn"
              onClick={() => {
                navigator.clipboard.writeText(content);
                alert('Đã copy!');
              }}
              title="Copy"
            >
              <Copy size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Block Content */}
      <div className="notion-block__content">
        {isEditing ? (
          <>
            <textarea
              className="notion-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder={placeholder}
              rows={large ? 20 : 10}
              autoFocus
            />
            <div className="notion-block__edit-actions">
              <button className="btn btn--sm btn--ghost" onClick={handleCancel} disabled={isSaving}>
                <X size={14} style={{ marginRight: 4 }} />
                Hủy
              </button>
              <button className="btn btn--sm btn--primary" onClick={handleSave} disabled={isSaving}>
                <Check size={14} style={{ marginRight: 4 }} />
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </>
        ) : (
          <div
            className={`notion-content ${!content ? 'notion-content--empty' : ''}`}
            onClick={() => !content && setIsEditing(true)}
          >
            {content ? (
              isMarkdown ? (
                <MarkdownRenderer content={content} />
              ) : (
                <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>
              )
            ) : (
              <p className="notion-content__placeholder">{placeholder}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== Markdown Renderer ====================
const MarkdownRenderer = ({ content }: { content: string }) => {
  // Simple markdown rendering (có thể thay bằng library như react-markdown)
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        return (
          <h3 key={i} style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>
            {line.replace('### ', '')}
          </h3>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={i} style={{ fontSize: 18, fontWeight: 700, marginTop: 24, marginBottom: 12 }}>
            {line.replace('## ', '')}
          </h2>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h1 key={i} style={{ fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 16 }}>
            {line.replace('# ', '')}
          </h1>
        );
      }

      // Lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={i} style={{ marginLeft: 20, marginBottom: 4 }}>
            {line.replace(/^[\\-\\*] /, '')}
          </li>
        );
      }

      // Bold text
      const boldText = line.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');

      // Empty line
      if (!line.trim()) {
        return <br key={i} />;
      }

      // Regular paragraph
      return (
        <p key={i} style={{ marginBottom: 8, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: boldText }} />
      );
    });
  };

  return <div className="notion-markdown">{renderMarkdown(content)}</div>;
};

// ==================== Action Items Block ====================
interface ActionItemsBlockV2Props {
  meetingId: string;
}

const ActionItemsBlockV2 = ({ meetingId }: ActionItemsBlockV2Props) => {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', owner_user_id: '', due_date: '', priority: 'medium' as const });

  useEffect(() => {
    loadItems();
  }, [meetingId]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await itemsApi.listActions(meetingId);
      setItems(data.items || []);
    } catch (err) {
      console.error('Load actions failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newItem.title.trim()) return;

    try {
      await itemsApi.createAction({
        meeting_id: meetingId,
        title: newItem.title.trim(),
        owner_user_id: newItem.owner_user_id || undefined,
        due_date: newItem.due_date || undefined,
        priority: newItem.priority,
      });
      await loadItems();
      setNewItem({ title: '', owner_user_id: '', due_date: '', priority: 'medium' });
      setIsAdding(false);
    } catch (err) {
      console.error('Add action failed:', err);
      alert('Thêm action thất bại');
    }
  };

  const handleToggleStatus = async (item: ActionItem) => {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    try {
      await itemsApi.updateAction(item.id, { status: newStatus });
      setItems(items.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)));
    } catch (err) {
      console.error('Update status failed:', err);
    }
  };

  return (
    <div className="notion-block">
      <div className="notion-block__header" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <div className="notion-block__title">
          <button className="notion-toggle-btn">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="notion-block__icon">✅</span>
          <span className="notion-block__title-text">Action Items</span>
          <span className="notion-block__count">{items.length}</span>
        </div>

        {isExpanded && (
          <button
            className="notion-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(true);
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="notion-block__content">
          {isLoading ? (
            <div className="notion-block__loading">
              <div className="spinner spinner--sm" />
              <span>Đang tải...</span>
            </div>
          ) : (
            <>
              {/* Items List */}
              <div className="notion-checklist">
                {items.map((item) => (
                  <NotionChecklistItem key={item.id} item={item} onToggle={() => handleToggleStatus(item)} />
                ))}
              </div>

              {/* Add New Item */}
              {isAdding && (
                <div className="notion-add-item">
                  <input
                    className="notion-input"
                    placeholder="Tiêu đề action item..."
                    value={newItem.title}
                    onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                    autoFocus
                  />
                  <div className="notion-add-item__row">
                    <input
                      className="notion-input notion-input--sm"
                      placeholder="Người phụ trách"
                      value={newItem.owner_user_id}
                      onChange={(e) => setNewItem({ ...newItem, owner_user_id: e.target.value })}
                    />
                    <input
                      className="notion-input notion-input--sm"
                      type="date"
                      value={newItem.due_date}
                      onChange={(e) => setNewItem({ ...newItem, due_date: e.target.value })}
                    />
                    <select
                      className="notion-select notion-select--sm"
                      value={newItem.priority}
                      onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as any })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="notion-add-item__actions">
                    <button className="btn btn--sm btn--ghost" onClick={() => setIsAdding(false)}>
                      Hủy
                    </button>
                    <button className="btn btn--sm btn--primary" onClick={handleAdd}>
                      Thêm
                    </button>
                  </div>
                </div>
              )}

              {items.length === 0 && !isAdding && (
                <div className="notion-empty-hint" onClick={() => setIsAdding(true)}>
                  Click để thêm action item...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== Checklist Item ====================
const NotionChecklistItem = ({ item, onToggle }: { item: ActionItem; onToggle: () => void }) => {
  const isCompleted = item.status === 'completed';
  const isOverdue = item.due_date && new Date(item.due_date) < new Date() && !isCompleted;

  return (
    <div className={`notion-checklist-item ${isCompleted ? 'notion-checklist-item--completed' : ''}`}>
      <button className="notion-checkbox" onClick={onToggle}>
        {isCompleted && <Check size={14} strokeWidth={3} />}
      </button>

      <div className="notion-checklist-item__content">
        <span className="notion-checklist-item__text">{item.title}</span>

        <div className="notion-checklist-item__meta">
          {item.owner_user_id && <span className="notion-tag">👤 {item.owner_user_id}</span>}

          {item.due_date && (
            <span className={`notion-tag ${isOverdue ? 'notion-tag--error' : ''}`}>
              <Clock size={12} />
              {new Date(item.due_date).toLocaleDateString('vi-VN')}
            </span>
          )}

          {item.priority && item.priority !== 'medium' && (
            <span className={`notion-tag notion-tag--${item.priority}`}>{item.priority.toUpperCase()}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== Decisions Block ====================
const DecisionsBlockV2 = ({ meetingId }: { meetingId: string }) => {
  const [items, setItems] = useState<DecisionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadItems();
  }, [meetingId]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await itemsApi.listDecisions(meetingId);
      setItems(data.items || []);
    } catch (err) {
      console.error('Load decisions failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="notion-block">
      <div className="notion-block__header" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <div className="notion-block__title">
          <button className="notion-toggle-btn">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="notion-block__icon">💡</span>
          <span className="notion-block__title-text">Decisions</span>
          <span className="notion-block__count">{items.length}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="notion-block__content">
          {isLoading ? (
            <div className="notion-block__loading">
              <div className="spinner spinner--sm" />
            </div>
          ) : items.length === 0 ? (
            <div className="notion-empty-hint">Không có quyết định nào được ghi nhận</div>
          ) : (
            <div className="notion-list">
              {items.map((item) => (
                <div key={item.id} className="notion-list-item">
                  <div className="notion-list-item__number">{items.indexOf(item) + 1}</div>
                  <div className="notion-list-item__content">
                    <div className="notion-list-item__title">{item.title}</div>
                    {item.rationale && (
                      <div className="notion-list-item__subtitle">Lý do: {item.rationale}</div>
                    )}
                    {item.impact && (
                      <div className="notion-list-item__subtitle">Impact: {item.impact}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== Risks Block ====================
const RisksBlockV2 = ({ meetingId }: { meetingId: string }) => {
  const [items, setItems] = useState<RiskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadItems();
  }, [meetingId]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await itemsApi.listRisks(meetingId);
      setItems(data.items || []);
    } catch (err) {
      console.error('Load risks failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const severityConfig = {
    low: { color: '#10b981', icon: '🟢' },
    medium: { color: '#f59e0b', icon: '🟡' },
    high: { color: '#ef4444', icon: '🔴' },
    critical: { color: '#dc2626', icon: '🔴🔴' },
  };

  return (
    <div className="notion-block">
      <div className="notion-block__header" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <div className="notion-block__title">
          <button className="notion-toggle-btn">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="notion-block__icon">⚠️</span>
          <span className="notion-block__title-text">Risks</span>
          <span className="notion-block__count">{items.length}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="notion-block__content">
          {isLoading ? (
            <div className="notion-block__loading">
              <div className="spinner spinner--sm" />
            </div>
          ) : items.length === 0 ? (
            <div className="notion-empty-hint">Không có rủi ro nào được ghi nhận</div>
          ) : (
            <div className="notion-list">
              {items.map((item) => {
                const config = severityConfig[item.severity as keyof typeof severityConfig] || severityConfig.medium;
                return (
                  <div key={item.id} className="notion-list-item">
                    <div className="notion-list-item__icon" style={{ color: config.color }}>
                      {config.icon}
                    </div>
                    <div className="notion-list-item__content">
                      <div className="notion-list-item__title">{item.title}</div>
                      {item.mitigation && (
                        <div className="notion-list-item__subtitle">Giải pháp: {item.mitigation}</div>
                      )}
                      <div className="notion-list-item__meta">
                        <span className="notion-tag" style={{ background: `${config.color}20`, color: config.color }}>
                          {item.severity}
                        </span>
                        {item.owner_user_id && <span className="notion-tag">👤 {item.owner_user_id}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostMeetTabV2;

